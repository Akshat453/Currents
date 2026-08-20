import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, assert } from "../lib/errors.js";
import { ok } from "../lib/response.js";
import { auth } from "../middleware/auth.js";
import { activeMultiplier } from "../services/pricing.service.js";
import { notify } from "../services/notification.service.js";
import { emitCharger, emitSession } from "../realtime.js";
export const sessionRouter = Router();
sessionRouter.use(auth);
sessionRouter.get(
  "/",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.chargingSession.findMany({
        where: { userId: req.user.sub },
        include: { charger: { include: { station: true } }, vehicle: true, payments: true },
        orderBy: { startTime: "desc" }
      })
    )
  )
);
sessionRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const item = await prisma.chargingSession.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      include: {
        charger: { include: { station: true } },
        vehicle: true,
        sessionLogs: { take: 60, orderBy: { timestamp: "desc" } },
        payments: true
      }
    });
    assert(item, 404, "NOT_FOUND", "Session not found");
    return ok(res, item);
  })
);
sessionRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const item = await prisma.$transaction(
      async (tx) => {
        const booking = req.body.bookingId
          ? await tx.booking.findFirst({
              where: { id: req.body.bookingId, userId: req.user.sub, status: "confirmed" }
            })
          : null;
        const chargerId = booking?.chargerId || req.body.chargerId;
        const charger = await tx.charger.findUnique({ where: { id: chargerId } });
        assert(
          charger && (booking || charger.status === "available"),
          409,
          "CHARGER_BUSY",
          "Charger cannot be started"
        );
        const session = await tx.chargingSession.create({
          data: {
            userId: req.user.sub,
            bookingId: booking?.id,
            chargerId,
            vehicleId: booking?.vehicleId || req.body.vehicleId,
            status: "charging",
            startTime: new Date(),
            startBatteryPercent: Number(req.body.batteryPercent || 20),
            endBatteryPercent: Number(req.body.batteryPercent || 20),
            sessionData: { targetPercent: Number(req.body.targetPercent || 80) }
          }
        });
        await tx.charger.update({
          where: { id: chargerId },
          data: { status: "in_use", currentSessionId: session.id }
        });
        if (booking)
          await tx.booking.update({ where: { id: booking.id }, data: { status: "active" } });
        return { session, charger };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    emitCharger({ ...item.charger, status: "in_use" });
    emitSession(item.session, item.charger.stationId, item.charger.id);
    await notify(
      req.user.sub,
      "charging_started",
      "Charging started",
      "Power is flowing. We’ll keep you updated.",
      { sessionId: item.session.id }
    );
    return ok(res, item.session, undefined, 201);
  })
);
sessionRouter.patch(
  "/:id/stop",
  asyncRoute(async (req, res) => {
    const current = await prisma.chargingSession.findFirst({
      where: { id: req.params.id, userId: req.user.sub, status: "charging" },
      include: { charger: { include: { station: true } }, booking: true }
    });
    assert(current?.charger, 404, "ACTIVE_SESSION_NOT_FOUND", "Active session not found");
    const multiplier = await activeMultiplier(prisma, current.charger.stationId);
    const totalCost =
      Number(current.energyDeliveredKwh) *
      Number(current.charger.station.basePricePerKwh) *
      multiplier;
    const session = await prisma.$transaction(async (tx) => {
      const updated = await tx.chargingSession.update({
        where: { id: current.id },
        data: { status: "completed", endTime: new Date(), totalCost, paymentStatus: "pending" }
      });
      await tx.charger.update({
        where: { id: current.charger.id },
        data: { status: "available", currentSessionId: null }
      });
      if (current.booking)
        await tx.booking.update({
          where: { id: current.booking.id },
          data: { status: "completed" }
        });
      return updated;
    });
    emitCharger({ ...current.charger, status: "available" });
    emitSession(session, current.charger.stationId, current.charger.id);
    await notify(
      req.user.sub,
      "charging_completed",
      "Charge complete",
      `${Number(session.energyDeliveredKwh).toFixed(1)} kWh delivered.`,
      { sessionId: session.id }
    );
    return ok(res, session);
  })
);
