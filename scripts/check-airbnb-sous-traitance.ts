/**
 * Compatibilité stockage v1 + calcul sous-traitance.
 * npx --yes tsx scripts/check-airbnb-sous-traitance.ts
 */
import assert from "node:assert/strict";
import {
  defaultChargesGlobal,
  defaultSousTraitance,
  listingCaFromVentilation,
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
assert.equal(fam.length, 1);
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

assert.equal(listingCaFromVentilation(loaded, "2026-10", "familiale"), 2446);
assert.equal(listingCaFromVentilation(loaded, "2026-10", "petitBureau"), 0);
assert.equal(listingCaFromVentilation(loaded, "2026-09", "familiale"), 0);

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
assert.equal(pct.caTotal, 2446 + 1464);
assert.equal(pct.dueTotal, (2446 + 1464) * 0.25);

const oneHome = computeSousTraitancePayout(withPercent, "2026-10", [
  "familiale",
]);
assert.equal(oneHome.caTotal, 2446);
assert.equal(oneHome.dueTotal, 611.5);

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
assert.equal(forfaitAll.dueTotal, 180 + 120 + 80 + 90);

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
