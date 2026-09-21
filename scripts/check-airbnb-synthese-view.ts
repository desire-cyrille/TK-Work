/**
 * Vérifications lecture seule des filtres de synthèse Airbnb.
 * npx --yes tsx scripts/check-airbnb-synthese-view.ts
 */
import assert from "node:assert/strict";
import {
  buildSyntheseTotalBars,
  clampYearMonth,
  computeSyntheseViewTotals,
  isAllListingsSelected,
  monthsInclusive,
  normalizeSyntheseViewQuery,
  yearsInclusive,
} from "../src/lib/airbnbSyntheseView";
import { defaultChargesGlobal } from "../src/lib/airbnbStorage";
import type { AirbnbState } from "../src/types/airbnb";

const empty: AirbnbState = {
  version: 1,
  ventilations: [],
  chargesGlobal: defaultChargesGlobal(),
  syntheseFichierOverrides: {},
};

assert.deepEqual(clampYearMonth("2025-03", "2024-01"), ["2024-01", "2025-03"]);
assert.deepEqual(monthsInclusive("2024-11", "2025-02"), [
  "2024-11",
  "2024-12",
  "2025-01",
  "2025-02",
]);
assert.deepEqual(yearsInclusive("2024-07", "2026-09"), [2024, 2025, 2026]);
assert.equal(isAllListingsSelected([]), true);
assert.equal(isAllListingsSelected(["petitBureau"]), false);

const yearBars = buildSyntheseTotalBars(empty, {
  granularity: "year",
  fromMonth: "2024-07",
  toMonth: "2025-12",
  listingIds: [],
});
assert.equal(yearBars.length, 2);
assert.equal(yearBars[0]?.key, "year-2024");
assert.equal(yearBars[1]?.key, "year-2025");
assert.ok(yearBars[0]!.value > 0, "2024 seed bénéfices");

const monthBars = buildSyntheseTotalBars(empty, {
  granularity: "month",
  fromMonth: "2024-07",
  toMonth: "2024-09",
  listingIds: [],
});
assert.equal(monthBars.length, 3);
assert.equal(monthBars[0]?.key, "2024-07");

const filtered = computeSyntheseViewTotals(empty, {
  granularity: "year",
  fromMonth: "2024-07",
  toMonth: "2024-12",
  listingIds: ["familiale"],
});
assert.equal(filtered.benefices, 0);
assert.equal(filtered.fichierExcluDuFiltreLogement, true);

const all = computeSyntheseViewTotals(empty, {
  granularity: "year",
  fromMonth: "2024-07",
  toMonth: "2024-12",
  listingIds: [],
});
assert.ok(all.benefices !== 0);
assert.equal(all.fichierExcluDuFiltreLogement, false);

const q = normalizeSyntheseViewQuery({
  granularity: "month",
  fromMonth: "2026-03",
  toMonth: "2026-01",
  listingIds: ["familiale", "familiale"],
});
assert.equal(q.fromMonth, "2026-01");
assert.equal(q.toMonth, "2026-03");
assert.deepEqual(q.listingIds, ["familiale"]);

console.log("airbnb synthese view: ok");
