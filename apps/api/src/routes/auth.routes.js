import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema
} from "@currents/shared";
import { asyncRoute } from "../lib/errors.js";
import { ok } from "../lib/response.js";
import { config } from "../lib/config.js";
import * as service from "../services/auth.service.js";

export const authRouter = Router();
authRouter.use(
  rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false })
);
const cookieOptions = {
  httpOnly: true,
  secure: config.production,
  sameSite: "lax",
  path: "/api/auth",
  maxAge: 7 * 864e5
};
const respond = (res, session, status = 200) => {
  res.cookie(config.cookieName, session.refreshToken, cookieOptions);
  return ok(res, { user: session.user, accessToken: session.accessToken }, undefined, status);
};
authRouter.post(
  "/register",
  asyncRoute(async (req, res) =>
    respond(res, await service.register(registerSchema.parse(req.body)), 201)
  )
);
authRouter.post(
  "/login",
  asyncRoute(async (req, res) => respond(res, await service.login(loginSchema.parse(req.body))))
);
authRouter.post(
  "/refresh",
  asyncRoute(async (req, res) => respond(res, await service.rotate(req.cookies[config.cookieName])))
);
authRouter.post(
  "/logout",
  asyncRoute(async (req, res) => {
    await service.logout(req.cookies[config.cookieName]);
    res.clearCookie(config.cookieName, cookieOptions);
    return ok(res, { loggedOut: true });
  })
);
authRouter.post(
  "/forgot-password",
  asyncRoute(async (req, res) => {
    const token = await service.forgotPassword(forgotPasswordSchema.parse(req.body).email);
    return ok(res, { accepted: true, ...(token && { developmentToken: token }) });
  })
);
authRouter.post(
  "/reset-password",
  asyncRoute(async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    await service.resetPassword(input.token, input.password);
    return ok(res, { reset: true });
  })
);
