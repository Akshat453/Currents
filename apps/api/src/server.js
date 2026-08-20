import http from "node:http";
import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { createSocketServer } from "./socket.js";
import { startJobs } from "./jobs/index.js";
const server = http.createServer(createApp());
const io = createSocketServer(server, config.webUrl);
const stopJobs = config.runJobs ? startJobs() : () => {};
server.listen(config.port, () =>
  console.log(`Currents API listening on http://localhost:${config.port}`)
);
const shutdown = async () => {
  stopJobs();
  io.close();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
