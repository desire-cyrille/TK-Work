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

function assertCarte(
  texte: string,
  attendu: {
    listingId: string;
    month: string;
    facture: string;
    frais: string;
    deduction: string;
    invite: RegExp;
  },
) {
  const parsed = parseAirbnbFactureTexte(texte);
  assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.error);
  if (!parsed.ok) return;
  assert.equal(parsed.value.listingId, attendu.listingId);
  assert.equal(parsed.value.month, attendu.month);
  assert.equal(parsed.value.facture, attendu.facture);
  assert.equal(parsed.value.frais, attendu.frais);
  assert.equal(parsed.value.deduction, attendu.deduction);
  assert.match(parsed.value.libelle, attendu.invite);
}

assertCarte(
  `
Amélie Bouvier
Logement · 2–3 oct. 2026
Le p'tit Deuxième
Confirmation
HMS5Y5MAP5
Revenus
Logement
36,00 €
Frais de service
-5,58 €
Total (EUR)
30,42 €
`,
  {
    listingId: "ptitDeuxieme",
    month: "2026-10",
    facture: "36",
    frais: "0",
    deduction: "5,58",
    invite: /Amélie Bouvier/,
  },
);

assertCarte(
  `
Alexandre Stephan
Logement · 4–6 sept. 2026
Le Cosy Chill
Revenus
Logement 36,00 €
Frais de service -5,58 €
Total (EUR) 30,42 €
`,
  {
    listingId: "cosyChill",
    month: "2026-09",
    facture: "36",
    frais: "0",
    deduction: "5,58",
    invite: /Alexandre Stephan/,
  },
);

assertCarte(
  `
Rachel Madzou
Logement · 25–26 sept. 2026
La Maison Familiale
Revenus
Logement 20,00 €
Frais de ménage 38,00 €
Frais de service -8,99 €
Total (EUR) 49,01 €
`,
  {
    listingId: "familiale",
    month: "2026-09",
    facture: "20",
    frais: "38",
    deduction: "8,99",
    invite: /Rachel Madzou/,
  },
);

assertCarte(
  `
Al Munoz
Logement · 5–6 sept. 2026
Le p'tit Deuxième
Revenus
58,00 € x 1 nuit
58,00 €
Frais de ménage pour les séjours courte
durée
15,00 €
Frais de service
-2,19 €
Total (EUR) 70,81 €
`,
  {
    listingId: "ptitDeuxieme",
    month: "2026-09",
    facture: "58",
    frais: "15",
    deduction: "2,19",
    invite: /Al Munoz/,
  },
);

assertCarte(
  `
Jean-Daniel Villeminot
Logement · 2–4 oct. 2026
Appartements de Désiré, Le Petit Bureau
Revenus
102,15 € x 2 nuits
204,30 €
Frais de ménage pour les séjours courte durée
22,00 €
Frais de service -35,08 €
Total (EUR) 191,22 €
`,
  {
    listingId: "petitBureau",
    month: "2026-10",
    facture: "204,30",
    frais: "22",
    deduction: "35,08",
    invite: /Jean-Daniel Villeminot/,
  },
);

assertCarte(
  `
Diego Fernandez Ruiz
Logement · 7–8 sept. 2026
Le Cosy Chill
Revenus
68,00 € x 1 nuit 68,00 €
Frais de ménage 28,00 €
Frais de service -14,88 €
Total (EUR) 81,12 €
`,
  {
    listingId: "cosyChill",
    month: "2026-09",
    facture: "68",
    frais: "28",
    deduction: "14,88",
    invite: /Diego Fernandez Ruiz/,
  },
);

assertCarte(
  `
Thomas El
Logement · 21–23 sept. 2026
La Maison Familiale
Revenus
Logement 190,00 €
Frais de service -29,45 €
Total (EUR) 160,55 €
`,
  {
    listingId: "familiale",
    month: "2026-09",
    facture: "190",
    frais: "0",
    deduction: "29,45",
    invite: /Thomas El/,
  },
);

console.log("airbnb facture parse: ok");
