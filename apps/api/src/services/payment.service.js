import crypto from "node:crypto";
import Stripe from "stripe";
import { config } from "../lib/config.js";
import { assert } from "../lib/errors.js";

let stripe;
function stripeClient() {
  assert(process.env.STRIPE_SECRET_KEY, 503, "STRIPE_NOT_CONFIGURED", "Stripe is not configured");
  stripe ||= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export async function createPaymentIntent({ amount, metadata, idempotencyKey }) {
  const amountPaise = Math.round(Number(amount) * 100);
  assert(amountPaise > 0, 400, "BAD_AMOUNT", "Payment amount must be positive");
  if (config.paymentProvider === "fake")
    return {
      id: `fake_pi_${crypto.randomUUID()}`,
      clientSecret: null,
      amount: amountPaise,
      currency: "inr",
      provider: "fake",
      status: "requires_confirmation",
      metadata
    };
  const intent = await stripeClient().paymentIntents.create(
    {
      amount: amountPaise,
      currency: "inr",
      automatic_payment_methods: { enabled: true },
      metadata: Object.fromEntries(
        Object.entries(metadata || {}).map(([key, value]) => [key, String(value)])
      )
    },
    { idempotencyKey }
  );
  return publicIntent(intent);
}

export async function retrievePaymentIntent(id, fakePayload) {
  if (config.paymentProvider === "fake") {
    assert(
      fakePayload?.confirmation === "fake_verified",
      400,
      "PAYMENT_NOT_SUCCEEDED",
      "Test payment was not confirmed"
    );
    return { id, status: "succeeded", ...fakePayload };
  }
  return stripeClient().paymentIntents.retrieve(id);
}

export function constructWebhookEvent(rawBody, signature) {
  assert(signature, 400, "BAD_SIGNATURE", "Missing Stripe webhook signature");
  assert(
    process.env.STRIPE_WEBHOOK_SECRET,
    503,
    "STRIPE_NOT_CONFIGURED",
    "Stripe webhook is not configured"
  );
  return stripeClient().webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

export async function createRefund(paymentIntentId, amount) {
  if (config.paymentProvider === "fake")
    return { id: `fake_re_${crypto.randomUUID()}`, status: "succeeded" };
  return stripeClient().refunds.create({
    payment_intent: paymentIntentId,
    amount: Math.round(Number(amount) * 100)
  });
}

export function publicIntent(intent) {
  return {
    id: intent.id,
    clientSecret: intent.client_secret,
    amount: intent.amount,
    currency: intent.currency,
    provider: config.paymentProvider === "fake" ? "fake" : "stripe",
    status: intent.status
  };
}
