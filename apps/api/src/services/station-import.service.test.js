import { describe, expect, it } from "vitest";
import { normalizeOpenChargeMap, speedForPower } from "./station-import.service.js";
describe("station import", () => {
  it("maps OCM connector and identity", () => {
    const item = normalizeOpenChargeMap({
      ID: 42,
      AddressInfo: { Title: "Test", Latitude: 12, Longitude: 77, TownOrCity: "Bengaluru" },
      Connections: [{ ConnectionTypeID: 33, PowerKW: 120 }]
    });
    expect(item.externalId).toBe("42");
    expect(item.chargers[0]).toEqual({ type: "CCS", power: 120 });
  });
  it("classifies power", () => expect(speedForPower(150)).toBe("ultra_rapid"));
});
