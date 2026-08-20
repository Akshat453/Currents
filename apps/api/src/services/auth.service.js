import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { assert, AppError } from "../lib/errors.js";
import { signAccessToken } from "../middleware/auth.js";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const publicUser = ({ passwordHash: _, ...user }) => user;

async function issueRefresh(userId, familyId = crypto.randomUUID()) {
  const raw = crypto.randomBytes(48).toString("base64url");
  const record = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      familyId,
      expiresAt: new Date(Date.now() + 7 * 864e5)
    }
  });
  return { raw, record };
}
export async function issueSession(user) {
  const refresh = await issueRefresh(user.id);
  return { user: publicUser(user), accessToken: signAccessToken(user), refreshToken: refresh.raw };
}
export async function register(input) {
  assert(
    !(await prisma.user.findUnique({ where: { email: input.email } })),
    409,
    "EMAIL_TAKEN",
    "An account already exists for this email"
  );
  const user = await prisma.user.create({
    data: {
      ...input,
      phone: input.phone || null,
      passwordHash: await bcrypt.hash(input.password, 12),
      wallet: { create: {} }
    }
  });
  return issueSession(user);
}
export async function login(input) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  assert(
    user && user.status === "active" && (await bcrypt.compare(input.password, user.passwordHash)),
    401,
    "INVALID_CREDENTIALS",
    "Email or password is incorrect"
  );
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });
  return issueSession(updated);
}
export async function rotate(raw) {
  assert(raw, 401, "REFRESH_REQUIRED", "Refresh session is missing");
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true }
  });
  assert(record, 401, "INVALID_REFRESH", "Session is no longer valid");
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    throw new AppError(401, "REFRESH_REUSE", "Session reuse detected; sign in again");
  }
  assert(
    record.expiresAt > new Date() && record.user.status === "active",
    401,
    "REFRESH_EXPIRED",
    "Session has expired"
  );
  const next = await issueRefresh(record.userId, record.familyId);
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date(), replacedById: next.record.id }
  });
  return {
    user: publicUser(record.user),
    accessToken: signAccessToken(record.user),
    refreshToken: next.raw
  };
}
export async function logout(raw) {
  if (raw)
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() }
    });
}
export async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() }
  });
  const raw = crypto.randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 30 * 60e3)
    }
  });
  return process.env.NODE_ENV === "production" ? null : raw;
}
export async function resetPassword(token, password) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) }
  });
  assert(
    record && !record.usedAt && record.expiresAt > new Date(),
    400,
    "INVALID_RESET",
    "Reset link is invalid or expired"
  );
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(password, 12) }
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    })
  ]);
}
