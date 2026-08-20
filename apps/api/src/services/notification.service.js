import { prisma } from "../lib/prisma.js";
let io;
export const setNotificationIO = (socketServer) => {
  io = socketServer;
};
export async function notify(userId, type, title, message, metadata) {
  const item = await prisma.notification.create({
    data: { userId, type, title, message, metadata }
  });
  io?.to(`user:${userId}`).emit("notification", item);
  return item;
}
