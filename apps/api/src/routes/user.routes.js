import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { vehicleSchema, passwordSchema } from "@currents/shared";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, assert } from "../lib/errors.js";
import { ok } from "../lib/response.js";
import { auth } from "../middleware/auth.js";
import { storage } from "../services/storage.service.js";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3_000_000 },
  fileFilter: (_r, f, cb) => cb(null, f.mimetype.startsWith("image/"))
});
export const userRouter = Router();
userRouter.use(auth);
const cleanUser = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  profileImageUrl: true,
  createdAt: true
};
userRouter.get(
  "/me",
  asyncRoute(async (req, res) =>
    ok(res, await prisma.user.findUnique({ where: { id: req.user.sub }, select: cleanUser }))
  )
);
userRouter.patch(
  "/me",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { fullName: req.body.fullName, phone: req.body.phone },
        select: cleanUser
      })
    )
  )
);
userRouter.patch(
  "/me/password",
  asyncRoute(async (req, res) => {
    const password = passwordSchema.parse(req.body.password);
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    assert(
      await bcrypt.compare(req.body.currentPassword, user.passwordHash),
      400,
      "WRONG_PASSWORD",
      "Current password is incorrect"
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 12) }
    });
    return ok(res, { changed: true });
  })
);
userRouter.post(
  "/me/avatar",
  upload.single("avatar"),
  asyncRoute(async (req, res) => {
    assert(req.file, 400, "IMAGE_REQUIRED", "Choose an image");
    const profileImageUrl = await storage.put(req.file);
    await prisma.user.update({ where: { id: req.user.sub }, data: { profileImageUrl } });
    return ok(res, { profileImageUrl }, undefined, 201);
  })
);

export const vehicleRouter = Router();
vehicleRouter.use(auth);
vehicleRouter.get(
  "/",
  asyncRoute(async (req, res) =>
    ok(
      res,
      await prisma.userVehicle.findMany({
        where: { userId: req.user.sub },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
      })
    )
  )
);
vehicleRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const data = vehicleSchema.parse(req.body);
    const vehicle = await prisma.$transaction(async (tx) => {
      if (data.isPrimary)
        await tx.userVehicle.updateMany({
          where: { userId: req.user.sub },
          data: { isPrimary: false }
        });
      return tx.userVehicle.create({ data: { ...data, userId: req.user.sub } });
    });
    return ok(res, vehicle, undefined, 201);
  })
);
vehicleRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const data = vehicleSchema.partial().parse(req.body);
    const found = await prisma.userVehicle.findFirst({
      where: { id: req.params.id, userId: req.user.sub }
    });
    assert(found, 404, "NOT_FOUND", "Vehicle not found");
    return ok(res, await prisma.userVehicle.update({ where: { id: found.id }, data }));
  })
);
vehicleRouter.patch(
  "/:id/set-primary",
  asyncRoute(async (req, res) => {
    const found = await prisma.userVehicle.findFirst({
      where: { id: req.params.id, userId: req.user.sub }
    });
    assert(found, 404, "NOT_FOUND", "Vehicle not found");
    await prisma.$transaction([
      prisma.userVehicle.updateMany({
        where: { userId: req.user.sub },
        data: { isPrimary: false }
      }),
      prisma.userVehicle.update({ where: { id: found.id }, data: { isPrimary: true } })
    ]);
    return ok(res, { id: found.id, isPrimary: true });
  })
);
vehicleRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const result = await prisma.userVehicle.deleteMany({
      where: { id: req.params.id, userId: req.user.sub }
    });
    assert(result.count, 404, "NOT_FOUND", "Vehicle not found");
    return ok(res, { deleted: true });
  })
);
