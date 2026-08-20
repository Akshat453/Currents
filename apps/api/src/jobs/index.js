import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { emitCharger, emitSession } from "../realtime.js";

export function startJobs() {
  const jobs = [];
  jobs.push(
    cron.schedule("*/20 * * * * *", async () => {
      const chargers = await prisma.charger.findMany({
        where: { status: { in: ["available", "faulted"] }, currentSessionId: null },
        take: 25
      });
      for (const charger of chargers)
        if (Math.random() < 0.08) {
          const status =
            charger.status === "faulted" || Math.random() > 0.2 ? "available" : "faulted";
          const updated = await prisma.charger.update({
            where: { id: charger.id },
            data: {
              status,
              faultDescription: status === "faulted" ? "Simulated connector handshake fault" : null
            }
          });
          emitCharger(updated);
        }
    })
  );
  jobs.push(
    cron.schedule("* * * * *", async () => {
      const now = new Date();
      const reserveFrom = new Date(now.getTime() + 15 * 60e3);
      const reservations = await prisma.booking.findMany({
        where: {
          status: "confirmed",
          startTime: { lte: reserveFrom, gte: now },
          charger: { status: "available" }
        },
        include: { charger: true }
      });
      for (const b of reservations) {
        const c = await prisma.charger.update({
          where: { id: b.chargerId },
          data: { status: "reserved" }
        });
        emitCharger(c);
      }
      const overdue = await prisma.booking.findMany({
        where: { status: "confirmed", startTime: { lt: new Date(now.getTime() - 15 * 60e3) } },
        include: { charger: true }
      });
      for (const b of overdue) {
        await prisma.booking.update({ where: { id: b.id }, data: { status: "no_show" } });
        if (b.charger?.status === "reserved") {
          const c = await prisma.charger.update({
            where: { id: b.charger.id },
            data: { status: "available" }
          });
          emitCharger(c);
        }
      }
    })
  );
  jobs.push(
    cron.schedule("*/5 * * * * *", async () => {
      const sessions = await prisma.chargingSession.findMany({
        where: { status: "charging" },
        include: { charger: true, vehicle: true }
      });
      for (const session of sessions) {
        if (!session.charger) continue;
        const power = Number(session.charger.maxPowerKw) * (0.82 + Math.random() * 0.12);
        const deltaKwh = (power * 5) / 3600;
        const capacity = Number(session.vehicle?.batteryCapacityKwh || 60);
        const battery = Math.min(
          100,
          Number(session.endBatteryPercent || session.startBatteryPercent || 20) +
            (deltaKwh / capacity) * 100
        );
        const energy = Number(session.energyDeliveredKwh) + deltaKwh;
        const [updated] = await prisma.$transaction([
          prisma.chargingSession.update({
            where: { id: session.id },
            data: {
              energyDeliveredKwh: energy,
              endBatteryPercent: Math.round(battery),
              averagePowerKw: power
            }
          }),
          prisma.sessionLog.create({
            data: {
              sessionId: session.id,
              timestamp: new Date(),
              powerKw: power,
              voltage: 400,
              current: power * 2.5,
              batteryPercent: Math.round(battery),
              temperature: 31 + Math.random() * 4
            }
          })
        ]);
        emitSession(updated, session.charger.stationId, session.charger.id);
      }
    })
  );
  return () => jobs.forEach((job) => job.stop());
}
