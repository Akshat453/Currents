import "dotenv/config";
import {
  fixtureStations,
  normalizeOpenChargeMap,
  upsertStations
} from "../src/services/station-import.service.js";
const city = process.argv[2] || "Bengaluru";
const country = process.argv[3] || "IN";
let records;
let provider = "openchargemap";
if (process.env.OPENCHARGEMAP_API_KEY) {
  const params = new URLSearchParams({
    key: process.env.OPENCHARGEMAP_API_KEY,
    countrycode: country,
    maxresults: "100",
    compact: "true",
    verbose: "false"
  });
  const response = await fetch(`https://api.openchargemap.io/v3/poi/?${params}`);
  if (!response.ok) throw new Error(`OpenChargeMap returned ${response.status}`);
  const all = await response.json();
  records = all
    .map(normalizeOpenChargeMap)
    .filter((r) => r.city.toLowerCase().includes(city.toLowerCase()));
} else {
  provider = "fixture";
  records = await fixtureStations();
}
console.log(JSON.stringify({ provider, imported: await upsertStations(records), city, country }));
process.exit(0);
