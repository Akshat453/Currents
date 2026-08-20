import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, assert } from "../lib/errors.js";
import { ok } from "../lib/response.js";
import { auth } from "../middleware/auth.js";
import { activeMultiplier } from "../services/pricing.service.js";

export const stationRouter = Router();
stationRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const lat = Number(req.query.lat || 12.9716);
    const lng = Number(req.query.lng || 77.5946);
    const radius = Math.min(Number(req.query.radius_km || 10), 50);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const nearby = await prisma.$queryRaw(Prisma.sql`
    SELECT id, (6371 * acos(least(1, cos(radians(${lat})) * cos(radians(latitude::float8)) * cos(radians(longitude::float8) - radians(${lng})) + sin(radians(${lat})) * sin(radians(latitude::float8))))) AS distance
    FROM charging_stations WHERE status = 'active' AND approval_status = 'approved'
    AND (6371 * acos(least(1, cos(radians(${lat})) * cos(radians(latitude::float8)) * cos(radians(longitude::float8) - radians(${lng})) + sin(radians(${lat})) * sin(radians(latitude::float8))))) <= ${radius}
    ORDER BY distance ASC`);
    const ids = nearby.map((v) => v.id);
    const distances = Object.fromEntries(nearby.map((v) => [v.id, Number(v.distance)]));
    const stations = ids.length
      ? await prisma.chargingStation.findMany({
          where: {
            id: { in: ids },
            ...(req.query.min_rating && { rating: { gte: Number(req.query.min_rating) } }),
            chargers: {
              some: {
                ...(req.query.connector_type && { connectorType: req.query.connector_type }),
                ...(req.query.min_power && { maxPowerKw: { gte: Number(req.query.min_power) } }),
                ...(req.query.availability === "true" && { status: "available" })
              }
            }
          },
          include: { chargers: true }
        })
      : [];
    let data = stations
      .map((station) => ({
        ...station,
        distanceKm: distances[station.id],
        availableChargers: station.chargers.filter((c) => c.status === "available").length,
        totalChargers: station.chargers.length
      }))
      .filter((s) => !req.query.availability || s.availableChargers > 0);
    data.sort(
      req.query.sort === "price"
        ? (a, b) => Number(a.basePricePerKwh) - Number(b.basePricePerKwh)
        : req.query.sort === "rating"
          ? (a, b) => Number(b.rating) - Number(a.rating)
          : (a, b) => a.distanceKm - b.distanceKm
    );
    const total = data.length;
    data = data.slice((page - 1) * limit, page * limit);
    return ok(res, data, { page, limit, total });
  })
);
stationRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const station = await prisma.chargingStation.findUnique({
      where: { id: req.params.id },
      include: {
        chargers: { orderBy: { chargerIdentifier: "asc" } },
        pricingRules: { where: { isActive: true } },
        reviews: {
          take: 8,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { fullName: true, profileImageUrl: true } } }
        }
      }
    });
    assert(station, 404, "NOT_FOUND", "Station not found");
    return ok(res, { ...station, activeMultiplier: await activeMultiplier(prisma, station.id) });
  })
);
stationRouter.get(
  "/:id/reviews",
  asyncRoute(async (req, res) => {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = 10;
    const [data, total] = await prisma.$transaction([
      prisma.review.findMany({
        where: { stationId: req.params.id },
        include: { user: { select: { fullName: true, profileImageUrl: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.review.count({ where: { stationId: req.params.id } })
    ]);
    return ok(res, data, { page, limit, total });
  })
);

export const reviewRouter = Router();
reviewRouter.use(auth);
reviewRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const rating = Number(req.body.rating);
    assert(rating >= 1 && rating <= 5, 400, "BAD_RATING", "Rating must be between 1 and 5");
    const session = await prisma.chargingSession.findFirst({
      where: { id: req.body.sessionId, userId: req.user.sub, status: "completed" },
      include: { charger: true }
    });
    assert(session?.charger, 403, "SESSION_REQUIRED", "Complete a session before reviewing");
    const review = await prisma.$transaction(async (tx) => {
      const item = await tx.review.create({
        data: {
          userId: req.user.sub,
          stationId: session.charger.stationId,
          sessionId: session.id,
          rating,
          comment: req.body.comment?.trim() || null
        }
      });
      const aggregate = await tx.review.aggregate({
        where: { stationId: session.charger.stationId },
        _avg: { rating: true },
        _count: true
      });
      await tx.chargingStation.update({
        where: { id: session.charger.stationId },
        data: { rating: aggregate._avg.rating || 0, totalReviews: aggregate._count }
      });
      return item;
    });
    return ok(res, review, undefined, 201);
  })
);

export const favoriteRouter = Router();
favoriteRouter.use(auth);
favoriteRouter.get(
  "/",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.favorite.findMany({
        where: { userId: req.user.sub },
        include: { station: { include: { chargers: true } } },
        orderBy: { createdAt: "desc" }
      })
    )
  )
);
favoriteRouter.post(
  "/",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.favorite.upsert({
        where: { userId_stationId: { userId: req.user.sub, stationId: req.body.stationId } },
        update: {},
        create: { userId: req.user.sub, stationId: req.body.stationId }
      }),
      undefined,
      201
    )
  )
);
favoriteRouter.delete(
  "/:stationId",
  asyncRoute(async (req, res) => {
    await prisma.favorite.deleteMany({
      where: { userId: req.user.sub, stationId: req.params.stationId }
    });
    return ok(res, { deleted: true });
  })
);
