import { PrismaClient } from "@prisma/client";
export const prisma = globalThis.__currentsPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__currentsPrisma = prisma;
