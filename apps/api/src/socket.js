import { Server } from "socket.io";
import { verifyAccessToken } from "./middleware/auth.js";
import { prisma } from "./lib/prisma.js";
import { setIO } from "./realtime.js";
import { setNotificationIO } from "./services/notification.service.js";
export function createSocketServer(server, webUrl) {
  const io = new Server(server, { cors: { origin: webUrl, credentials: true } });
  io.use((socket, next) => {
    try {
      socket.user = verifyAccessToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.sub}`);
    socket.on("join_station", (id) => socket.join(`station:${id}`));
    socket.on("leave_station", (id) => socket.leave(`station:${id}`));
    socket.on("join_session", async (id, ack = () => {}) => {
      const session = await prisma.chargingSession.findUnique({
        where: { id },
        include: { charger: { include: { station: true } } }
      });
      const allowed =
        session &&
        (session.userId === socket.user.sub ||
          socket.user.role === "admin" ||
          (socket.user.role === "operator" &&
            session.charger?.station.operatorId === socket.user.sub));
      if (allowed) {
        socket.join(`session:${id}`);
        ack({ ok: true });
      } else ack({ ok: false });
    });
    socket.on("join_operator", async () => {
      if (socket.user.role !== "operator" && socket.user.role !== "admin") return;
      const stations = await prisma.chargingStation.findMany({
        where: socket.user.role === "operator" ? { operatorId: socket.user.sub } : {},
        select: { id: true }
      });
      stations.forEach((s) => socket.join(`operator:${s.id}`));
    });
  });
  setIO(io);
  setNotificationIO(io);
  return io;
}
