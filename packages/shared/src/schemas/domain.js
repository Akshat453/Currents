import { z } from "zod";

export const connectorTypes = ["Type1", "Type2", "CCS", "CHAdeMO", "Tesla"];
export const vehicleSchema = z.object({
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  year: z.coerce.number().int().min(1990).max(2100).nullable().optional(),
  batteryCapacityKwh: z.coerce.number().positive().max(300).nullable().optional(),
  connectorType: z.enum(connectorTypes),
  isPrimary: z.boolean().optional()
});
export const bookingSchema = z
  .object({
    stationId: z.string().uuid(),
    chargerId: z.string().uuid(),
    vehicleId: z.string().uuid(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date()
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], message: "End must follow start" });
export const recommendationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  connectorType: z.enum(connectorTypes),
  batteryPercent: z.number().min(0).max(79),
  batteryCapacityKwh: z.number().positive().max(300).optional(),
  priority: z.enum(["fastest", "balanced", "cheapest"]).default("balanced"),
  arriveBy: z.coerce.date().optional(),
  weights: z
    .object({ time: z.number().nonnegative(), cost: z.number().nonnegative() })
    .refine((w) => w.time + w.cost > 0)
    .optional()
});
