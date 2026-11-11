/**
 * npx --yes tsx scripts/check-quittances-payees.ts
 */
import assert from "node:assert/strict";
import type { MoisComputed } from "../src/lib/moisFinance";
import {
  moisQuittancesPayees,
  nomFichierQuittancesPayees,
} from "../src/lib/quittancesPayees";

function mois(moisCle: string, statut: MoisComputed["statut"]): MoisComputed {
  return {
    moisCle,
    contratId: "c1",
    baseLoyer: 800,
    totalFrais: 0,
    reportEntrant: 0,
    totalDu: 800,
    totalPaye: statut === "paye" ? 800 : 0,
    solde: statut === "paye" ? 0 : 800,
    reportSortant: 0,
    annulerReportVersSuivant: false,
    statut,
    brutRecuOuPaye: statut === "paye" ? 800 : 0,
    tvaSurPaye: 0,
    depotInclusDansDu: 0,
  };
}

const grille = [
  mois("2026-01", "paye"),
  mois("2026-02", "en_retard"),
  mois("2026-03", "paye"),
  mois("2026-04", "a_payer"),
  mois("2026-05", "annule"),
  mois("2026-06", "paye"),
];

const toutes = moisQuittancesPayees(grille, { mode: "toutes" });
assert.deepEqual(
  toutes.map((m) => m.moisCle),
  ["2026-01", "2026-03", "2026-06"],
);

const periode = moisQuittancesPayees(grille, {
  mode: "periode",
  de: "2026-06",
  a: "2026-03",
});
assert.deepEqual(
  periode.map((m) => m.moisCle),
  ["2026-03", "2026-06"],
);

assert.deepEqual(
  moisQuittancesPayees(grille, { mode: "periode", de: "", a: "2026-03" }),
  [],
);

assert.equal(
  nomFichierQuittancesPayees("Le Cosy Chill", { mode: "toutes" }),
  "Quittances_payees_Le_Cosy_Chill_toutes.pdf",
);
assert.equal(
  nomFichierQuittancesPayees("Studio", {
    mode: "periode",
    de: "2026-03",
    a: "2026-06",
  }),
  "Quittances_payees_Studio_2026-03_2026-06.pdf",
);

console.log("quittances payees: ok");
