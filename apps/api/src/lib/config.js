import "dotenv/config";
const production = process.env.NODE_ENV === "production";
export const config = {
  production,
  port: Number(process.env.PORT || 4000),
  webUrl: process.env.WEB_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me-please",
  cookieName: process.env.REFRESH_COOKIE_NAME || "currents_refresh",
  runJobs: process.env.RUN_JOBS !== "false",
  paymentProvider: process.env.PAYMENT_PROVIDER || "fake"
};
if (production && config.jwtSecret.includes("development"))
  throw new Error("JWT_SECRET must be configured in production");
if (production && config.paymentProvider === "fake")
  throw new Error("Fake payments cannot run in production");
if (!["fake", "stripe"].includes(config.paymentProvider))
  throw new Error("PAYMENT_PROVIDER must be fake or stripe");
if (production && (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET))
  throw new Error("Stripe secret and webhook keys must be configured in production");
if (production && process.env.STORAGE_PROVIDER !== "s3")
  throw new Error("S3 storage must be configured in production");
