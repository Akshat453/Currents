import { Router } from "express";
import { bookingSchema } from "@currents/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, assert } from "../lib/errors.js";
import { ok } from "../lib/response.js";
import { auth } from "../middleware/auth.js";
import { activeMultiplier } from "../services/pricing.service.js";
import { notify } from "../services/notification.service.js";
import { emitCharger } from "../realtime.js";
export const bookingRouter = Router();
bookingRouter.use(auth);
bookingRouter.get(
  "/",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.booking.findMany({
        where: { userId: req.user.sub },
        include: { station: true, charger: true, vehicle: true },
        orderBy: { startTime: "desc" }
      })
    )
  )
);
bookingRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const input = bookingSchema.parse(req.body);
    const booking = await prisma.$transaction(
      async (tx) => {
        const [charger, vehicle, overlap] = await Promise.all([
          tx.charger.findFirst({
            where: { id: input.chargerId, stationId: input.stationId },
            include: { station: true }
          }),
          tx.userVehicle.findFirst({ where: { id: input.vehicleId, userId: req.user.sub } }),
          tx.booking.findFirst({
            where: {
              chargerId: input.chargerId,
              status: { in: ["confirmed", "active"] },
              startTime: { lt: input.endTime },
              endTime: { gt: input.startTime }
            }
          })
        ]);
        assert(charger && vehicle, 404, "NOT_FOUND", "Charger or vehicle not found");
        assert(
          !overlap && !["faulted", "unavailable", "in_use"].includes(charger.status),
          409,
          "CHARGER_BUSY",
          "This charger is not available for that window"
        );
        const hours = (input.endTime - input.startTime) / 36e5;
        const estimatedKwh = Math.max(
          1,
          Math.min(
            Number(charger.maxPowerKw) * hours,
            Number(vehicle.batteryCapacityKwh || 60) * 0.8
          )
        );
        const multiplier = await activeMultiplier(tx, input.stationId, input.startTime);
        const priceEstimate = estimatedKwh * Number(charger.station.basePricePerKwh) * multiplier;
        const item = await tx.booking.create({
          data: {
            ...input,
            userId: req.user.sub,
            status: "confirmed",
            bookingTime: new Date(),
            estimatedKwh,
            priceEstimate
          }
        });
        if (input.startTime.getTime() - Date.now() <= 15 * 60e3)
          await tx.charger.update({ where: { id: charger.id }, data: { status: "reserved" } });
        return item;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    await notify(
      req.user.sub,
      "booking_confirmed",
      "Charging slot confirmed",
      "Your charger is reserved and ready when you arrive.",
      { bookingId: booking.id }
    );
    return ok(res, booking, undefined, 201);
  })
);
bookingRouter.patch(
  "/:id/cancel",
  asyncRoute(async (req, res) => {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      include: { charger: true }
    });
    assert(booking, 404, "NOT_FOUND", "Booking not found");
    assert(
      booking.status === "confirmed" && booking.startTime.getTime() - Date.now() > 30 * 60e3,
      409,
      "TOO_LATE",
      "Bookings can only be cancelled more than 30 minutes before start"
    );
    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "cancelled", cancellationReason: req.body.reason || null }
      });
      if (booking.charger?.status === "reserved")
        await tx.charger.update({
          where: { id: booking.charger.id },
          data: { status: "available" }
        });
      return b;
    });
    if (booking.charger) emitCharger({ ...booking.charger, status: "available" });
    return ok(res, updated);
  })
);
