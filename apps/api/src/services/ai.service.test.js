import { describe, expect, it } from "vitest";
import { haversineKm, recommendStations } from "./ai.service.js";
const input = {
  lat: 12.97,
  lng: 77.59,
  connectorType: "CCS",
  batteryPercent: 30,
  batteryCapacityKwh: 50,
  priority: "balanced"
};
const stations = [
  {
    id: "a",
    name: "Near fast",
    latitude: 12.98,
    longitude: 77.6,
    basePricePerKwh: 20,
    multiplier: 1,
    queueMinutes: 0,
    chargers: [{ id: "a1", status: "available", maxPowerKw: 100 }]
  },
  {
    id: "b",
    name: "Cheap",
    latitude: 13.01,
    longitude: 77.6,
    basePricePerKwh: 12,
    multiplier: 1,
    queueMinutes: 0,
    chargers: [{ id: "b1", status: "available", maxPowerKw: 50 }]
  }
];
describe("recommendStations", () => {
  it("calculates finite Haversine distance", () =>
    expect(haversineKm(12.97, 77.59, 12.98, 77.6)).toBeGreaterThan(0));
  it("ranks fastest and cheapest priorities deterministically", () => {
    expect(recommendStations(stations, { ...input, priority: "fastest" })[0].id).toBe("a");
    expect(recommendStations(stations, { ...input, priority: "cheapest" })[0].id).toBe("b");
  });
  it("marks missing battery capacity as estimated", () =>
    expect(
      recommendStations(stations, { ...input, batteryCapacityKwh: undefined })[0].assumptions
        .capacityIsEstimated
    ).toBe(true));
});
