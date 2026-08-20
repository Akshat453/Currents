import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter, vehicleRouter } from "./routes/user.routes.js";
import { stationRouter, reviewRouter, favoriteRouter } from "./routes/station.routes.js";
import { bookingRouter } from "./routes/booking.routes.js";
import { sessionRouter } from "./routes/session.routes.js";
import { paymentRouter, walletRouter } from "./routes/payment.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { operatorRouter } from "./routes/operator.routes.js";
import { aiRouter } from "./routes/ai.routes.js";
import { constructWebhookEvent } from "./services/payment.service.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: config.webUrl, credentials: true }));
  app.use(pinoHttp());
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    async (req, res, next) => {
      try {
        const event = constructWebhookEvent(req.body, req.headers["stripe-signature"]);
        const intent = event.data?.object;
        if (event.type === "payment_intent.succeeded" && intent?.id) {
          const payment = await prisma.payment.findFirst({
            where: { gatewayTransactionId: intent.id }
          });
          if (payment && payment.status !== "completed") {
            await prisma.$transaction([
              prisma.payment.update({
                where: { id: payment.id },
                data: {
                  status: "completed",
                  gatewayResponse: { id: event.id, type: event.type, paymentIntentId: intent.id }
                }
              }),
              prisma.chargingSession.update({
                where: { id: payment.sessionId },
                data: { paymentStatus: "completed" }
              })
            ]);
          }
          if (intent.metadata?.kind === "wallet" && intent.metadata.userId) {
            const amount = Number(intent.amount) / 100;
            await prisma.$transaction(async (tx) => {
              const existing = await tx.walletTransaction.findUnique({
                where: { referenceId: intent.id }
              });
              if (existing) return;
              const wallet = await tx.wallet.upsert({
                where: { userId: intent.metadata.userId },
                update: { balance: { increment: amount } },
                create: { userId: intent.metadata.userId, balance: amount }
              });
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  type: "credit",
                  amount,
                  balanceAfter: wallet.balance,
                  description: "Wallet top-up",
                  referenceId: intent.id
                }
              });
            });
          }
        }
        res.json({ data: { received: true } });
      } catch (error) {
        next(error);
      }
    }
  );
  app.use(express.json({ limit: "1mb" }), cookieParser());
  app.use("/uploads", express.static("uploads"));
  app.get("/health", (_req, res) => res.json({ data: { status: "ok", uptime: process.uptime() } }));
  app.get("/ready", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ data: { status: "ready" } });
    } catch {
      res.status(503).json({ error: { code: "NOT_READY", message: "Database unavailable" } });
    }
  });
  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);
  app.use("/api/vehicles", vehicleRouter);
  app.use("/api/stations", stationRouter);
  app.use("/api/reviews", reviewRouter);
  app.use("/api/favorites", favoriteRouter);
  app.use("/api/bookings", bookingRouter);
  app.use("/api/sessions", sessionRouter);
  app.use("/api/payments", paymentRouter);
  app.use("/api/wallet", walletRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/operator", operatorRouter);
  app.use("/api/ai", aiRouter);
  app.use((_req, res) =>
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } })
  );
  app.use((error, req, res, _next) => {
    req.log?.error(error);
    if (error instanceof ZodError)
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields",
          fields: error.flatten().fieldErrors
        }
      });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return res
        .status(409)
        .json({ error: { code: "CONFLICT", message: "That record already exists" } });
    return res.status(error.status || 500).json({
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.status ? error.message : "Something went wrong"
      }
    });
  });
  return app;
}
