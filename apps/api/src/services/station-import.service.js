import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { prisma } from "../lib/prisma.js";

const connectorMap = { 1: "Type1", 2: "CHAdeMO", 25: "Type2", 27: "Tesla", 33: "CCS", 1036: "CCS" };
export const speedForPower = (power) =>
  power >= 150 ? "ultra_rapid" : power >= 50 ? "rapid" : power >= 22 ? "fast" : "slow";

export function normalizeOpenChargeMap(item) {
  const connections = item.Connections?.filter((c) => connectorMap[c.ConnectionTypeID]) || [];
  return {
    externalId: String(item.ID),
    name: item.AddressInfo?.Title || `Charging station ${item.ID}`,
    address: [item.AddressInfo?.AddressLine1, item.AddressInfo?.TownOrCity]
      .filter(Boolean)
      .join(", "),
    city: item.AddressInfo?.TownOrCity || "Bengaluru",
    state: item.AddressInfo?.StateOrProvince,
    country: item.AddressInfo?.Country?.Title || "India",
    latitude: item.AddressInfo?.Latitude,
    longitude: item.AddressInfo?.Longitude,
    price: 18,
    amenities: [],
    chargers: connections.map((c) => ({
      type: connectorMap[c.ConnectionTypeID],
      power: Math.min(Number(c.PowerKW || 22), 350)
    }))
  };
}

export async function fixtureStations() {
  const path = fileURLToPath(new URL("../../prisma/fixtures/bengaluru.json", import.meta.url));
  return JSON.parse(await readFile(path, "utf8"));
}

export async function upsertStations(records, provider = "fixture") {
  let imported = 0;
  for (const record of records.filter((r) => r.latitude && r.longitude && r.chargers?.length)) {
    const station = await prisma.chargingStation.upsert({
      where: {
        externalProvider_externalId: { externalProvider: provider, externalId: record.externalId }
      },
      update: {
        name: record.name,
        address: record.address,
        latitude: record.latitude,
        longitude: record.longitude
      },
      create: {
        externalProvider: provider,
        externalId: record.externalId,
        name: record.name,
        address: record.address,
        city: record.city || "Bengaluru",
        state: record.state,
        country: record.country || "India",
        latitude: record.latitude,
        longitude: record.longitude,
        basePricePerKwh: record.price || 18,
        amenities: record.amenities || [],
        is24x7: true,
        approvalStatus: "approved",
        approvedAt: new Date()
      }
    });
    await Promise.all(
      record.chargers.map((charger, index) =>
        prisma.charger.upsert({
          where: {
            stationId_chargerIdentifier: {
              stationId: station.id,
              chargerIdentifier: `${provider}-${record.externalId}-${index + 1}`
            }
          },
          update: {
            connectorType: charger.type,
            maxPowerKw: charger.power,
            chargingSpeed: speedForPower(charger.power)
          },
          create: {
            stationId: station.id,
            chargerIdentifier: `${provider}-${record.externalId}-${index + 1}`,
            connectorType: charger.type,
            maxPowerKw: charger.power,
            chargingSpeed: speedForPower(charger.power)
          }
        })
      )
    );
    imported += 1;
  }
  return imported;
}
