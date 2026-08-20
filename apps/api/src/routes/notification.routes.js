import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, assert } from "../lib/errors.js";
import { ok } from "../lib/response.js";
import { auth } from "../middleware/auth.js";
export const notificationRouter = Router();
notificationRouter.use(auth);
notificationRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return ok(res, items, { unread: items.filter((n) => !n.isRead).length });
  })
);
notificationRouter.patch(
  "/read-all",
  asyncRoute(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.sub, isRead: false },
      data: { isRead: true }
    });
    return ok(res, { read: true });
  })
);
notificationRouter.patch(
  "/:id/read",
  asyncRoute(async (req, res) => {
    const item = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.sub }
    });
    assert(item, 404, "NOT_FOUND", "Notification not found");
    return ok(
      res,
      await prisma.notification.update({ where: { id: item.id }, data: { isRead: true } })
    );
  })
);
