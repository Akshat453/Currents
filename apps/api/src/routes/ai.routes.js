import { Router } from "express";
import rateLimit from "express-rate-limit";
import { recommendationSchema } from "@currents/shared";
import { prisma } from "../lib/prisma.js";
import { asyncRoute } from "../lib/errors.js";
import { ok } from "../lib/response.js";
import { auth } from "../middleware/auth.js";
import { activeMultiplier } from "../services/pricing.service.js";
import { haversineKm, recommendStations } from "../services/ai.service.js";
import { addGroqExplanations } from "../services/groq.service.js";
export const aiRouter = Router();
aiRouter.use(auth, rateLimit({ windowMs: 60_000, limit: 20 }));
aiRouter.post(
  "/recommend-station",
  asyncRoute(async (req, res) => {
    const input = recommendationSchema.parse(req.body);
    const all = await prisma.chargingStation.findMany({
      where: {
        status: "active",
        approvalStatus: "approved",
        chargers: {
          some: { connectorType: input.connectorType, status: "available" }
        }
      },
      include: {
        chargers: {
          where: { connectorType: input.connectorType, status: "available" }
        }
      }
    });
    let candidates = [];
    let radius = 30;
    for (const current of [5, 15, 30]) {
      candidates = all.filter(
        (s) => haversineKm(input.lat, input.lng, Number(s.latitude), Number(s.longitude)) <= current
      );
      radius = current;
      if (candidates.length >= 3) break;
    }
    const shaped = await Promise.all(
      candidates.map(async (s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        basePricePerKwh: Number(s.basePricePerKwh),
        rating: Number(s.rating),
        multiplier: await activeMultiplier(prisma, s.id),
        chargers: s.chargers.map((c) => ({
          id: c.id,
          status: c.status,
          maxPowerKw: Number(c.maxPowerKw)
        })),
        queueMinutes: s.chargers.some((c) => c.status === "available") ? 0 : 35
      }))
    );
    const scored = recommendStations(shaped, input);
    const recommendations = await addGroqExplanations(scored, input, req.log);
    return ok(res, recommendations, {
      searchedRadiusKm: radius,
      targetBatteryPercent: 80,
      scoringEngine: "currents-deterministic-v1",
      explanationProvider: recommendations.some((item) => item.explanationSource === "groq")
        ? "groq"
        : "deterministic"
    });
  })
);
