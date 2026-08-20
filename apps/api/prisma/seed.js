import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { fixtureStations, upsertStations } from "../src/services/station-import.service.js";
const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed is disabled in production");
  const passwordHash = await bcrypt.hash("Test1234!", 12);
  const users = await Promise.all(
    [
      ["driver@currents.local", "Aarav Mehta", "user"],
      ["operator@currents.local", "Kavya Rao", "operator"],
      ["admin@currents.local", "Devika Shah", "admin"]
    ].map(([email, fullName, role]) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, fullName, role, passwordHash, emailVerified: true }
      })
    )
  );
  const driver = users[0];
  await prisma.userVehicle.deleteMany({ where: { userId: driver.id } });
  await prisma.userVehicle.createMany({
    data: [
      {
        userId: driver.id,
        make: "Tata",
        model: "Nexon EV",
        year: 2025,
        batteryCapacityKwh: 45,
        connectorType: "CCS",
        isPrimary: true
      },
      {
        userId: driver.id,
        make: "Ather",
        model: "Rizta",
        year: 2025,
        batteryCapacityKwh: 3.7,
        connectorType: "Type2"
      }
    ]
  });
  await prisma.wallet.upsert({
    where: { userId: driver.id },
    update: {},
    create: { userId: driver.id, balance: 1200 }
  });
  await upsertStations(await fixtureStations());
  const station = await prisma.chargingStation.findFirst({
    where: { externalProvider: "fixture" }
  });
  if (station)
    await prisma.chargingStation.updateMany({
      where: { externalProvider: "fixture" },
      data: { operatorId: users[1].id }
    });
}
main().finally(() => prisma.$disconnect());
