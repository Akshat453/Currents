import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, assert } from "../lib/errors.js";
import { ok } from "../lib/response.js";
import { auth, allowRoles } from "../middleware/auth.js";
import { emitCharger } from "../realtime.js";
export const operatorRouter = Router();
operatorRouter.use(auth, allowRoles("operator", "admin"));
const ownedStation = async (id, user) => {
  const item = await prisma.chargingStation.findFirst({
    where: { id, ...(user.role === "operator" && { operatorId: user.sub }) }
  });
  assert(item, 404, "NOT_FOUND", "Station not found");
  return item;
};
operatorRouter.get(
  "/stations",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.chargingStation.findMany({
        where: req.user.role === "operator" ? { operatorId: req.user.sub } : {},
        include: { chargers: true },
        orderBy: { createdAt: "desc" }
      })
    )
  )
);
operatorRouter.post(
  "/stations",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.chargingStation.create({
        data: {
          operatorId: req.user.sub,
          name: req.body.name,
          description: req.body.description,
          address: req.body.address,
          city: req.body.city,
          state: req.body.state,
          postalCode: req.body.postalCode,
          country: req.body.country || "India",
          latitude: Number(req.body.latitude),
          longitude: Number(req.body.longitude),
          basePricePerKwh: Number(req.body.basePricePerKwh),
          amenities: req.body.amenities || [],
          images: req.body.images || [],
          is24x7: Boolean(req.body.is24x7),
          approvalStatus: "approved",
          approvedAt: new Date()
        }
      }),
      undefined,
      201
    )
  )
);
operatorRouter.patch(
  "/stations/:id",
  asyncRoute(async (req, res) => {
    const station = await ownedStation(req.params.id, req.user);
    const allowed = Object.fromEntries(
      [
        "name",
        "description",
        "address",
        "city",
        "state",
        "postalCode",
        "country",
        "status",
        "amenities",
        "images",
        "is24x7",
        "latitude",
        "longitude",
        "basePricePerKwh"
      ]
        .filter((k) => req.body[k] !== undefined)
        .map((k) => [k, req.body[k]])
    );
    return ok(
      res,
      await prisma.chargingStation.update({ where: { id: station.id }, data: allowed })
    );
  })
);
operatorRouter.delete(
  "/stations/:id",
  asyncRoute(async (req, res) => {
    const station = await ownedStation(req.params.id, req.user);
    await prisma.chargingStation.delete({ where: { id: station.id } });
    return ok(res, { deleted: true });
  })
);
operatorRouter.post(
  "/stations/:id/chargers",
  asyncRoute(async (req, res) => {
    const station = await ownedStation(req.params.id, req.user);
    return ok(
      res,
      await prisma.charger.create({
        data: {
          stationId: station.id,
          chargerIdentifier: req.body.chargerIdentifier,
          connectorType: req.body.connectorType,
          maxPowerKw: Number(req.body.maxPowerKw),
          chargingSpeed: req.body.chargingSpeed
        }
      }),
      undefined,
      201
    );
  })
);
operatorRouter.patch(
  "/stations/:stationId/chargers/:id",
  asyncRoute(async (req, res) => {
    await ownedStation(req.params.stationId, req.user);
    const charger = await prisma.charger.findFirst({
      where: { id: req.params.id, stationId: req.params.stationId }
    });
    assert(charger, 404, "NOT_FOUND", "Charger not found");
    const updated = await prisma.charger.update({ where: { id: charger.id }, data: req.body });
    emitCharger(updated);
    return ok(res, updated);
  })
);
operatorRouter.delete(
  "/stations/:stationId/chargers/:id",
  asyncRoute(async (req, res) => {
    await ownedStation(req.params.stationId, req.user);
    await prisma.charger.deleteMany({
      where: { id: req.params.id, stationId: req.params.stationId }
    });
    return ok(res, { deleted: true });
  })
);
operatorRouter.get(
  "/analytics/dashboard",
  asyncRoute(async (req, res) => {
    const stations = await prisma.chargingStation.findMany({
      where: req.user.role === "operator" ? { operatorId: req.user.sub } : {},
      select: { id: true }
    });
    const ids = stations.map((s) => s.id);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const sessions = await prisma.chargingSession.findMany({
      where: { charger: { stationId: { in: ids } }, startTime: { gte: start } }
    });
    const activeChargers = await prisma.charger.count({
      where: { stationId: { in: ids }, status: "in_use" }
    });
    return ok(res, {
      sessionsToday: sessions.length,
      revenueToday: sessions.reduce((sum, s) => sum + Number(s.totalCost || 0), 0),
      activeChargers,
      averageSessionMinutes: sessions
        .filter((s) => s.endTime)
        .reduce((sum, s, _i, arr) => sum + (s.endTime - s.startTime) / 6e4 / arr.length, 0)
    });
  })
);
operatorRouter.get(
  "/analytics/revenue",
  asyncRoute(async (req, res) => {
    const days = { "7d": 7, "30d": 30, "90d": 90 }[req.query.range] || 7;
    const stations = await prisma.chargingStation.findMany({
      where: req.user.role === "operator" ? { operatorId: req.user.sub } : {},
      select: { id: true }
    });
    const since = new Date(Date.now() - days * 864e5);
    const rows = await prisma.chargingSession.findMany({
      where: {
        charger: { stationId: { in: stations.map((s) => s.id) } },
        status: "completed",
        endTime: { gte: since }
      },
      select: { endTime: true, totalCost: true }
    });
    const series = Object.values(
      rows.reduce((acc, row) => {
        const date = row.endTime.toISOString().slice(0, 10);
        acc[date] ??= { date, revenue: 0 };
        acc[date].revenue += Number(row.totalCost || 0);
        return acc;
      }, {})
    );
    return ok(res, series);
  })
);
operatorRouter.get(
  "/sessions",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.chargingSession.findMany({
        where: {
          charger: { station: req.user.role === "operator" ? { operatorId: req.user.sub } : {} },
          status: { in: ["charging", "paused"] }
        },
        include: {
          charger: { include: { station: true } },
          user: { select: { fullName: true } },
          vehicle: true
        },
        orderBy: { startTime: "asc" }
      })
    )
  )
);
operatorRouter.post(
  "/sessions/:id/force-stop",
  asyncRoute(async (req, res) => {
    const session = await prisma.chargingSession.findUnique({
      where: { id: req.params.id },
      include: { charger: { include: { station: true } } }
    });
    assert(
      session?.charger &&
        (req.user.role === "admin" || session.charger.station.operatorId === req.user.sub),
      404,
      "NOT_FOUND",
      "Session not found"
    );
    await prisma.$transaction([
      prisma.chargingSession.update({
        where: { id: session.id },
        data: {
          status: "failed",
          endTime: new Date(),
          sessionData: { forceStopReason: req.body.reason || "Stopped by operator" }
        }
      }),
      prisma.charger.update({
        where: { id: session.charger.id },
        data: { status: "available", currentSessionId: null }
      })
    ]);
    emitCharger({ ...session.charger, status: "available" });
    return ok(res, { stopped: true });
  })
);
operatorRouter.get(
  "/stations/:id/pricing-rules",
  asyncRoute(async (req, res) => {
    await ownedStation(req.params.id, req.user);
    return ok(res, await prisma.pricingRule.findMany({ where: { stationId: req.params.id } }));
  })
);
operatorRouter.post(
  "/stations/:id/pricing-rules",
  asyncRoute(async (req, res) => {
    await ownedStation(req.params.id, req.user);
    const date = (time) => new Date(`1970-01-01T${time}:00.000Z`);
    return ok(
      res,
      await prisma.pricingRule.create({
        data: {
          stationId: req.params.id,
          name: req.body.name,
          startTime: date(req.body.startTime),
          endTime: date(req.body.endTime),
          daysOfWeek: req.body.daysOfWeek,
          priceMultiplier: Number(req.body.priceMultiplier),
          isActive: req.body.isActive !== false
        }
      }),
      undefined,
      201
    );
  })
);
operatorRouter.delete(
  "/pricing-rules/:id",
  asyncRoute(async (req, res) => {
    const rule = await prisma.pricingRule.findUnique({
      where: { id: req.params.id },
      include: { station: true }
    });
    assert(
      rule && (req.user.role === "admin" || rule.station.operatorId === req.user.sub),
      404,
      "NOT_FOUND",
      "Pricing rule not found"
    );
    await prisma.pricingRule.delete({ where: { id: rule.id } });
    return ok(res, { deleted: true });
  })
);
