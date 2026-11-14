/**
 * Compatibilité stockage v1 + calcul sous-traitance.
 * npx --yes tsx scripts/check-airbnb-sous-traitance.ts
 */
import assert from "node:assert/strict";
import {
  defaultChargesGlobal,
  defaultSousTraitance,
  listingCaFromVentilation,
  listingLocationCountFromVentilation,
  loadAirbnbState,
  saveAirbnbState,
} from "../src/lib/airbnbStorage";
import { computeSousTraitancePayout } from "../src/lib/airbnbSousTraitance";
import type { AirbnbState } from "../src/types/airbnb";

const mem = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem(k: string) {
      return mem.has(k) ? mem.get(k)! : null;
    },
    setItem(k: string, v: string) {
      mem.set(k, String(v));
    },
    removeItem(k: string) {
      mem.delete(k);
    },
    clear() {
      mem.clear();
    },
    key(i: number) {
      return [...mem.keys()][i] ?? null;
    },
    get length() {
      return mem.size;
    },
  },
});

const STORAGE_KEY = "tk-gestion-airbnb-ventilation-v1";

const legacyPayload = {
  version: 1 as const,
  ventilations: [
    {
      month: "2026-10",
      listings: {
        familiale: [
          {
            id: "keep-me",
            libelle: "Séjour octobre",
            facture: "2140",
            frais: "306",
            deduction: "10",
          },
          {
            id: "keep-me-2",
            libelle: "Second séjour",
            facture: "400",
            frais: "50",
            deduction: "",
          },
          {
            id: "empty-placeholder",
            libelle: "",
            facture: "",
            frais: "",
            deduction: "",
          },
        ],
        petitBureau: [],
        cosyChill: [
          {
            id: "cosy-1",
            libelle: "Séjour Cosy",
            facture: "1280",
            frais: "184",
            deduction: "",
          },
        ],
        ptitDeuxieme: [],
      },
    },
  ],
  chargesGlobal: {
    listings: {
      familiale: {
        loyer: "500",
        electricite: "",
        gaz: "",
        internet: "",
        fournitureAlimentaires: "",
        fournitureMenagere: "",
        assurance: "",
      },
    },
  },
  syntheseFichierOverrides: {
    "2024-01": { benefices: 12.5, revenus: 99 },
  },
};

mem.set(STORAGE_KEY, JSON.stringify(legacyPayload));
const loaded = loadAirbnbState();

assert.equal(loaded.version, 1);
assert.equal(loaded.ventilations.length, 1);
assert.equal(loaded.ventilations[0]?.month, "2026-10");
const fam = loaded.ventilations[0]?.listings.familiale ?? [];
assert.equal(fam.length, 3);
assert.equal(fam[0]?.id, "keep-me");
assert.equal(fam[0]?.libelle, "Séjour octobre");
assert.equal(fam[0]?.facture, "2140");
assert.equal(fam[0]?.frais, "306");
assert.equal(fam[0]?.deduction, "10");
assert.equal(loaded.chargesGlobal.listings.familiale.loyer, "500");
assert.deepEqual(loaded.syntheseFichierOverrides["2024-01"], {
  benefices: 12.5,
  revenus: 99,
});
assert.equal(loaded.sousTraitance.mode, "percent");
assert.equal(loaded.sousTraitance.percent, 0);
assert.equal(loaded.sousTraitance.prestataire, "");
assert.equal(loaded.sousTraitance.fraisUniques.familiale, "");
assert.equal(loaded.sousTraitance.forfaits.familiale, "");
assert.equal(loaded.sousTraitance.fraisMensuels.familiale, "");

saveAirbnbState(loaded);
const rawAfter = JSON.parse(mem.get(STORAGE_KEY) ?? "{}") as Record<
  string,
  unknown
>;
assert.equal(rawAfter.version, 1);
assert.ok(Array.isArray(rawAfter.ventilations));
const reloaded = loadAirbnbState();
assert.equal(
  reloaded.ventilations[0]?.listings.familiale[0]?.facture,
  "2140",
);
assert.equal(reloaded.ventilations[0]?.listings.familiale[0]?.id, "keep-me");
assert.equal(reloaded.chargesGlobal.listings.familiale.loyer, "500");
assert.equal(reloaded.syntheseFichierOverrides["2024-01"]?.revenus, 99);

assert.equal(listingCaFromVentilation(loaded, "2026-10", "familiale"), 2446 + 450);
assert.equal(listingCaFromVentilation(loaded, "2026-10", "petitBureau"), 0);
assert.equal(listingCaFromVentilation(loaded, "2026-09", "familiale"), 0);
assert.equal(
  listingLocationCountFromVentilation(loaded, "2026-10", "familiale"),
  2,
);
assert.equal(
  listingLocationCountFromVentilation(loaded, "2026-10", "petitBureau"),
  0,
);
assert.equal(
  listingLocationCountFromVentilation(loaded, "2026-10", "cosyChill"),
  1,
);

const withPercent: AirbnbState = {
  ...loaded,
  sousTraitance: {
    ...defaultSousTraitance(),
    prestataire: "Ménage",
    mode: "percent",
    percent: 25,
  },
};
const pct = computeSousTraitancePayout(withPercent, "2026-10", []);
assert.equal(pct.caTotal, 2446 + 450 + 1464);
assert.equal(pct.dueTotal, (2446 + 450 + 1464) * 0.25);
assert.equal(pct.fraisTotal, 0);

const oneHome = computeSousTraitancePayout(withPercent, "2026-10", [
  "familiale",
]);
assert.equal(oneHome.caTotal, 2446 + 450);
assert.equal(oneHome.dueTotal, (2446 + 450) * 0.25);

const withPercentFrais: AirbnbState = {
  ...loaded,
  sousTraitance: {
    ...defaultSousTraitance(),
    prestataire: "Ménage",
    mode: "percent",
    percent: 25,
    fraisMensuels: {
      ...defaultSousTraitance().fraisMensuels,
      familiale: "12",
      cosyChill: "8",
      petitBureau: "15",
      ptitDeuxieme: "10",
    },
  },
};
const pctFrais = computeSousTraitancePayout(withPercentFrais, "2026-10", []);
assert.equal(pctFrais.percentTotal, (2446 + 450 + 1464) * 0.25);
assert.equal(pctFrais.fraisTotal, 12 + 8);
assert.equal(pctFrais.dueTotal, (2446 + 450 + 1464) * 0.25 + 12 + 8);
const petitPct = pctFrais.rows.find((r) => r.listingId === "petitBureau");
assert.equal(petitPct?.locations, 0);
assert.equal(petitPct?.fraisDue, 0);
const famPct = pctFrais.rows.find((r) => r.listingId === "familiale");
assert.equal(famPct?.percentDue, (2446 + 450) * 0.25);
assert.equal(famPct?.fraisDue, 12);
assert.equal(famPct?.due, (2446 + 450) * 0.25 + 12);

const withForfait: AirbnbState = {
  ...loaded,
  sousTraitance: {
    ...defaultSousTraitance(),
    mode: "forfait",
    forfaits: {
      ...defaultSousTraitance().forfaits,
      familiale: "180",
      cosyChill: "120",
      petitBureau: "80",
      ptitDeuxieme: "90",
    },
  },
};
const forfaitAll = computeSousTraitancePayout(withForfait, "2026-10", []);
assert.equal(forfaitAll.locationTotal, 3);
assert.equal(forfaitAll.dueTotal, 180 * 2 + 120 * 1);
assert.equal(forfaitAll.uniqueTotal, 0);
assert.equal(forfaitAll.variableTotal, 180 * 2 + 120 * 1);
const famRow = forfaitAll.rows.find((r) => r.listingId === "familiale");
assert.equal(famRow?.locations, 2);
assert.equal(famRow?.due, 360);
assert.equal(famRow?.uniqueDue, 0);
assert.equal(famRow?.variableDue, 360);
const emptyListing = forfaitAll.rows.find((r) => r.listingId === "petitBureau");
assert.equal(emptyListing?.locations, 0);
assert.equal(emptyListing?.due, 0);

const withUnique: AirbnbState = {
  ...loaded,
  sousTraitance: {
    ...defaultSousTraitance(),
    mode: "forfait",
    forfaits: {
      ...defaultSousTraitance().forfaits,
      familiale: "30",
      cosyChill: "30",
      petitBureau: "0",
      ptitDeuxieme: "0",
    },
    fraisUniques: {
      ...defaultSousTraitance().fraisUniques,
      familiale: "40",
      cosyChill: "25",
      petitBureau: "15",
      ptitDeuxieme: "10",
    },
  },
};
const uniquePayout = computeSousTraitancePayout(withUnique, "2026-10", []);
assert.equal(uniquePayout.uniqueTotal, 40 + 25);
assert.equal(uniquePayout.variableTotal, 30 * 2 + 30 * 1);
assert.equal(uniquePayout.dueTotal, 40 + 25 + 60 + 30);
const petit = uniquePayout.rows.find((r) => r.listingId === "petitBureau");
assert.equal(petit?.locations, 0);
assert.equal(petit?.uniqueDue, 0);
assert.equal(petit?.due, 0);
const famUnique = uniquePayout.rows.find((r) => r.listingId === "familiale");
assert.equal(famUnique?.uniqueDue, 40);
assert.equal(famUnique?.variableDue, 60);
assert.equal(famUnique?.due, 100);

const forfaitIgnoresMensuels: AirbnbState = {
  ...withUnique,
  sousTraitance: {
    ...withUnique.sousTraitance,
    fraisMensuels: {
      ...defaultSousTraitance().fraisMensuels,
      familiale: "999",
    },
  },
};
const forfaitIgnore = computeSousTraitancePayout(
  forfaitIgnoresMensuels,
  "2026-10",
  ["familiale"],
);
assert.equal(forfaitIgnore.dueTotal, 100);
assert.equal(forfaitIgnore.fraisTotal, 0);

mem.set(
  STORAGE_KEY,
  JSON.stringify({
    version: 1,
    ventilations: loaded.ventilations,
    chargesGlobal: loaded.chargesGlobal,
    syntheseFichierOverrides: loaded.syntheseFichierOverrides,
    sousTraitance: {
      prestataire: "Ménage",
      mode: "forfait",
      percent: 0,
      forfaits: { familiale: "30", cosyChill: "30" },
    },
  }),
);
const fromOldSousTraitance = loadAirbnbState();
assert.equal(fromOldSousTraitance.sousTraitance.forfaits.familiale, "30");
assert.equal(fromOldSousTraitance.sousTraitance.fraisUniques.familiale, "");
assert.equal(fromOldSousTraitance.sousTraitance.fraisMensuels.familiale, "");
assert.equal(
  fromOldSousTraitance.ventilations[0]?.listings.familiale[0]?.id,
  "keep-me",
);

const empty: AirbnbState = {
  version: 1,
  ventilations: [],
  chargesGlobal: defaultChargesGlobal(),
  syntheseFichierOverrides: {},
  sousTraitance: defaultSousTraitance(),
};
const none = computeSousTraitancePayout(empty, "2026-10", []);
assert.equal(none.caTotal, 0);
assert.equal(none.dueTotal, 0);

console.log("airbnb sous-traitance: ok");
