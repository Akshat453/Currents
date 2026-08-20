import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, assert } from "../lib/errors.js";
import { ok } from "../lib/response.js";
import { auth, allowRoles } from "../middleware/auth.js";
import {
  createPaymentIntent,
  retrievePaymentIntent,
  createRefund
} from "../services/payment.service.js";
import { notify } from "../services/notification.service.js";
export const paymentRouter = Router();
paymentRouter.use(auth, rateLimit({ windowMs: 60_000, limit: 30 }));
paymentRouter.get(
  "/",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.payment.findMany({
        where: { userId: req.user.sub },
        include: { session: { include: { charger: { include: { station: true } } } } },
        orderBy: { createdAt: "desc" }
      })
    )
  )
);
paymentRouter.post(
  "/initiate",
  asyncRoute(async (req, res) => {
    const session = await prisma.chargingSession.findFirst({
      where: { id: req.body.sessionId, userId: req.user.sub, status: "completed" }
    });
    assert(
      session?.totalCost != null,
      409,
      "SESSION_NOT_PAYABLE",
      "Session is not ready for payment"
    );
    let payment = await prisma.payment.findFirst({
      where: {
        sessionId: session.id,
        userId: req.user.sub,
        status: { in: ["pending", "processing"] }
      }
    });
    if (!payment)
      payment = await prisma.payment.create({
        data: {
          userId: req.user.sub,
          sessionId: session.id,
          amount: session.totalCost,
          paymentMethod: req.body.paymentMethod || "upi",
          gateway: process.env.PAYMENT_PROVIDER || "fake",
          status: "processing"
        }
      });
    const intent = await createPaymentIntent({
      amount: Number(payment.amount),
      idempotencyKey: `session:${payment.id}`,
      metadata: {
        kind: "session",
        paymentId: payment.id,
        sessionId: session.id,
        userId: req.user.sub
      }
    });
    if (payment.gatewayTransactionId !== intent.id)
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { gateway: intent.provider, gatewayTransactionId: intent.id }
      });
    return ok(res, { payment, intent });
  })
);
paymentRouter.post(
  "/verify",
  asyncRoute(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: req.body.paymentId, userId: req.user.sub }
    });
    assert(payment, 404, "NOT_FOUND", "Payment not found");
    if (payment.status === "completed") return ok(res, payment);
    const intentId = payment.gatewayTransactionId || req.body.paymentIntentId;
    assert(intentId, 400, "MISSING_INTENT", "Payment intent is missing");
    const intent = await retrievePaymentIntent(intentId, {
      confirmation: req.body.confirmation,
      amount: Math.round(Number(payment.amount) * 100),
      metadata: { paymentId: payment.id, userId: req.user.sub }
    });
    assert(
      intent.status === "succeeded",
      409,
      "PAYMENT_NOT_SUCCEEDED",
      "Payment has not succeeded"
    );
    assert(
      Number(intent.amount) === Math.round(Number(payment.amount) * 100),
      409,
      "AMOUNT_MISMATCH",
      "Payment amount does not match"
    );
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "completed",
          gatewayTransactionId: intent.id,
          gatewayResponse: { id: intent.id, status: intent.status, amount: intent.amount }
        }
      });
      await tx.chargingSession.update({
        where: { id: payment.sessionId },
        data: { paymentStatus: "completed" }
      });
      return p;
    });
    await notify(
      req.user.sub,
      "payment_success",
      "Payment received",
      `₹${Number(updated.amount).toFixed(2)} paid successfully.`,
      { paymentId: updated.id }
    );
    return ok(res, updated);
  })
);
paymentRouter.post(
  "/:id/refund",
  allowRoles("operator", "admin"),
  asyncRoute(async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    assert(payment?.status === "completed", 409, "NOT_REFUNDABLE", "Payment is not refundable");
    const amount = Math.min(
      Number(req.body.amount || payment.amount),
      Number(payment.amount) - Number(payment.refundAmount)
    );
    assert(amount > 0, 400, "BAD_AMOUNT", "Refund amount must be positive");
    const refund = await createRefund(payment.gatewayTransactionId, amount);
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundAmount: { increment: amount },
        status:
          amount + Number(payment.refundAmount) >= Number(payment.amount) ? "refunded" : "completed"
      }
    });
    return ok(res, { payment: updated, refund: { id: refund.id, status: refund.status } });
  })
);

export const walletRouter = Router();
walletRouter.use(auth);
walletRouter.get(
  "/",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.wallet.upsert({
        where: { userId: req.user.sub },
        update: {},
        create: { userId: req.user.sub }
      })
    )
  )
);
walletRouter.get(
  "/transactions",
  asyncRoute(async (req, res) => {
    const page = Math.max(Number(req.query.page || 1), 1);
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.sub } });
    const [data, total] = wallet
      ? await prisma.$transaction([
          prisma.walletTransaction.findMany({
            where: { walletId: wallet.id },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * 20,
            take: 20
          }),
          prisma.walletTransaction.count({ where: { walletId: wallet.id } })
        ])
      : [[], 0];
    return ok(res, data, { page, limit: 20, total });
  })
);
walletRouter.post(
  "/add-money",
  asyncRoute(async (req, res) => {
    const amount = Number(req.body.amount);
    assert(
      amount >= 100 && amount <= 10000,
      400,
      "BAD_AMOUNT",
      "Choose an amount from ₹100 to ₹10,000"
    );
    return ok(
      res,
      await createPaymentIntent({
        amount,
        idempotencyKey: `wallet:${req.user.sub}:${amount}:${req.headers["idempotency-key"] || Date.now()}`,
        metadata: { kind: "wallet", userId: req.user.sub, amountPaise: Math.round(amount * 100) }
      })
    );
  })
);
walletRouter.post(
  "/add-money/verify",
  asyncRoute(async (req, res) => {
    const intent = await retrievePaymentIntent(req.body.paymentIntentId, {
      confirmation: req.body.confirmation,
      amount: Math.round(Number(req.body.amount) * 100),
      metadata: {
        kind: "wallet",
        userId: req.user.sub,
        amountPaise: Math.round(Number(req.body.amount) * 100)
      }
    });
    assert(intent.status === "succeeded", 409, "PAYMENT_NOT_SUCCEEDED", "Top-up has not succeeded");
    assert(
      intent.metadata?.userId === req.user.sub,
      403,
      "FORBIDDEN",
      "This payment belongs to another user"
    );
    const amount = Number(intent.amount) / 100;
    assert(amount >= 100 && amount <= 10000, 400, "BAD_AMOUNT", "Invalid top-up amount");
    const wallet = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.walletTransaction.findUnique({
          where: { referenceId: intent.id }
        });
        if (existing) return tx.wallet.findUnique({ where: { id: existing.walletId } });
        const w = await tx.wallet.upsert({
          where: { userId: req.user.sub },
          update: { balance: { increment: amount } },
          create: { userId: req.user.sub, balance: amount }
        });
        await tx.walletTransaction.create({
          data: {
            walletId: w.id,
            type: "credit",
            amount,
            balanceAfter: w.balance,
            description: "Wallet top-up",
            referenceId: intent.id
          }
        });
        return w;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return ok(res, wallet);
  })
);
walletRouter.post(
  "/pay",
  asyncRoute(async (req, res) => {
    const session = await prisma.chargingSession.findFirst({
      where: {
        id: req.body.sessionId,
        userId: req.user.sub,
        status: "completed",
        paymentStatus: { not: "completed" }
      }
    });
    assert(session?.totalCost, 409, "SESSION_NOT_PAYABLE", "Session is not payable");
    const amount = Number(session.totalCost);
    const payment = await prisma.$transaction(
      async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: req.user.sub } });
        assert(
          wallet && Number(wallet.balance) >= amount,
          409,
          "INSUFFICIENT_BALANCE",
          "Wallet balance changed or is insufficient"
        );
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount } }
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "debit",
            amount,
            balanceAfter: updatedWallet.balance,
            description: "Charging session",
            referenceId: session.id
          }
        });
        const p = await tx.payment.create({
          data: {
            userId: req.user.sub,
            sessionId: session.id,
            amount,
            paymentMethod: "wallet",
            gateway: "wallet",
            status: "completed",
            gatewayTransactionId: `wallet_${session.id}`
          }
        });
        await tx.chargingSession.update({
          where: { id: session.id },
          data: { paymentStatus: "completed" }
        });
        return p;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return ok(res, payment);
  })
);
