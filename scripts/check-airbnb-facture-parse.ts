/**
 * npx --yes tsx scripts/check-airbnb-facture-parse.ts
 */
import assert from "node:assert/strict";
import { parseAirbnbFactureTexte } from "../src/lib/airbnbFactureParse";

const propre = `
Angelique Kai
Logement - 8-10 oct. 2026
Le Cosy Chill
Confirmation
Détails
HMTFYNKQXJ
Revenus
76,00 € x 2 nuits 152,00 €
Frais de ménage 28,00 €
Frais de service -27,90 €
Total (EUR) 152,10 €
`;

const r = parseAirbnbFactureTexte(propre);
assert.equal(r.ok, true);
if (!r.ok) throw new Error(r.error);
assert.equal(r.value.listingId, "cosyChill");
assert.equal(r.value.month, "2026-10");
assert.equal(r.value.facture, "152");
assert.equal(r.value.frais, "28");
assert.equal(r.value.deduction, "27,90");
assert.match(r.value.libelle, /Angelique Kai/);
assert.match(r.value.libelle, /8–10/);
assert.equal(r.value.dateSejour, "2026-10-08");

const sale = `
Angelique Kai
Logement - 8-10 oct. 2026
Le Cosy Chill
7600€x2nuits 15200€
Frais de ménage 28,00€
Frais de service -2150€
`;
const r2 = parseAirbnbFactureTexte(sale);
assert.equal(r2.ok, true);
if (!r2.ok) throw new Error(r2.error);
assert.equal(r2.value.listingId, "cosyChill");
assert.equal(r2.value.facture, "152");
assert.equal(r2.value.frais, "28");

console.log("airbnb facture parse: ok");
