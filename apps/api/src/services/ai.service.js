const presets = {
  fastest: { time: 0.75, cost: 0.25 },
  balanced: { time: 0.5, cost: 0.5 },
  cheapest: { time: 0.25, cost: 0.75 }
};
const range = (values) => ({ min: Math.min(...values), max: Math.max(...values) });
const norm = (value, limits) =>
  limits.max === limits.min ? 0 : (value - limits.min) / (limits.max - limits.min);

export function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = (v) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function recommendStations(candidates, input) {
  const rawWeights = input.weights || presets[input.priority || "balanced"];
  const totalWeight = rawWeights.time + rawWeights.cost;
  const weights = { time: rawWeights.time / totalWeight, cost: rawWeights.cost / totalWeight };
  const capacity = input.batteryCapacityKwh || 60;
  const neededKwh = (capacity * (80 - input.batteryPercent)) / 100;
  const enriched = candidates.map((station) => {
    const distanceKm = haversineKm(input.lat, input.lng, station.latitude, station.longitude);
    const drivingMinutes = (distanceKm / 25) * 60;
    const charger = [...station.chargers].sort((a, b) => b.maxPowerKw - a.maxPowerKw)[0];
    const waitMinutes = charger.status === "available" ? 0 : station.queueMinutes || 35;
    const chargingMinutes = (neededKwh / charger.maxPowerKw) * 60;
    const rate = station.basePricePerKwh * (station.multiplier || 1);
    return {
      ...station,
      bestChargerId: charger.id,
      distanceKm,
      drivingMinutes,
      waitMinutes,
      chargingMinutes,
      totalMinutes: drivingMinutes + waitMinutes + chargingMinutes,
      estimatedCost: neededKwh * rate,
      rate,
      assumptions: { routeIsEstimated: true, capacityIsEstimated: !input.batteryCapacityKwh }
    };
  });
  if (!enriched.length) return [];
  const timeRange = range(enriched.map((v) => v.totalMinutes));
  const costRange = range(enriched.map((v) => v.estimatedCost));
  return enriched
    .map((v) => ({
      ...v,
      score:
        norm(v.totalMinutes, timeRange) * weights.time +
        norm(v.estimatedCost, costRange) * weights.cost
    }))
    .sort(
      (a, b) => a.score - b.score || a.totalMinutes - b.totalMinutes || a.distanceKm - b.distanceKm
    )
    .slice(0, 3)
    .map((v, index, all) => {
      const baseline = all[0];
      const why =
        index === 0
          ? `${v.distanceKm.toFixed(1)} km away with ${v.waitMinutes ? `about ${Math.round(v.waitMinutes)} min wait` : "no expected wait"}; back on the road in about ${Math.round(v.totalMinutes)} min.`
          : `${Math.abs(v.distanceKm - baseline.distanceKm).toFixed(1)} km ${v.distanceKm > baseline.distanceKm ? "farther" : "closer"}, ₹${Math.abs(v.rate - baseline.rate).toFixed(1)}/kWh ${v.rate < baseline.rate ? "cheaper" : "higher"}; about ${Math.round(v.totalMinutes)} min overall.`;
      return { ...v, rank: index + 1, why };
    });
}
