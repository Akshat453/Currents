import jwt from "jsonwebtoken";
import { config } from "../lib/config.js";
import { AppError } from "../lib/errors.js";

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, config.jwtSecret, {
    expiresIn: "15m",
    issuer: "currents-api",
    audience: "currents-web"
  });
}
export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, { issuer: "currents-api", audience: "currents-web" });
}
export function auth(req, _res, next) {
  try {
    const value = req.headers.authorization;
    if (!value?.startsWith("Bearer ")) throw new Error("missing");
    req.user = verifyAccessToken(value.slice(7));
    next();
  } catch {
    next(new AppError(401, "UNAUTHORIZED", "Sign in to continue"));
  }
}
export const allowRoles =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(new AppError(403, "FORBIDDEN", "You do not have access to this resource"));
