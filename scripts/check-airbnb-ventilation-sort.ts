/**
 * npx --yes tsx scripts/check-airbnb-ventilation-sort.ts
 */
import assert from "node:assert/strict";
import {
  extraireDateSejourDepuisTexte,
  normaliserEtTrierLignesVentilation,
  trierLignesVentilationParDate,
} from "../src/lib/airbnbVentilationSort";
import { parseAirbnbFactureTexte } from "../src/lib/airbnbFactureParse";

assert.equal(
  extraireDateSejourDepuisTexte("Angelique Kai · 8–10 oct. 2026"),
  "2026-10-08",
);

const sorted = trierLignesVentilationParDate([
  {
    id: "b",
    libelle: "Séjour 20–22 oct. 2026",
    facture: "100",
    frais: "0",
    deduction: "0",
    dateSejour: "2026-10-20",
  },
  {
    id: "a",
    libelle: "Séjour 8–10 oct. 2026",
    facture: "152",
    frais: "28",
    deduction: "27,90",
    dateSejour: "2026-10-08",
  },
  {
    id: "empty",
    libelle: "",
    facture: "",
    frais: "",
    deduction: "",
  },
]);
assert.deepEqual(
  sorted.map((r) => r.id),
  ["a", "b", "empty"],
);

const fromLibelle = normaliserEtTrierLignesVentilation([
  {
    id: "late",
    libelle: "Fin 15/11/2026",
    facture: "1",
    frais: "",
    deduction: "",
  },
  {
    id: "early",
    libelle: "Début 8–10 oct. 2026",
    facture: "1",
    frais: "",
    deduction: "",
  },
]);
assert.equal(fromLibelle[0]?.id, "early");
assert.equal(fromLibelle[0]?.dateSejour, "2026-10-08");
assert.equal(fromLibelle[1]?.dateSejour, "2026-11-15");

const facture = parseAirbnbFactureTexte(`
Angelique Kai
Logement - 8-10 oct. 2026
Le Cosy Chill
76,00 € x 2 nuits 152,00 €
Frais de ménage 28,00 €
Frais de service -27,90 €
`);
assert.equal(facture.ok, true);
if (facture.ok) assert.equal(facture.value.dateSejour, "2026-10-08");

console.log("airbnb ventilation sort: ok");
