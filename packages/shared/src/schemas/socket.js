import { z } from "zod";
export const chargerStatusUpdateSchema = z.object({
  stationId: z.string(),
  chargerId: z.string(),
  status: z.enum(["available", "in_use", "reserved", "faulted", "unavailable"]),
  updatedAt: z.string()
});
export const sessionUpdateSchema = z.object({
  sessionId: z.string(),
  stationId: z.string(),
  status: z.string(),
  energyDeliveredKwh: z.number(),
  batteryPercent: z.number().nullable(),
  powerKw: z.number(),
  totalCost: z.number().nullable()
});
export const notificationEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  createdAt: z.string()
});
export const operatorSessionUpdateSchema = sessionUpdateSchema.extend({
  userId: z.string(),
  chargerId: z.string()
});
