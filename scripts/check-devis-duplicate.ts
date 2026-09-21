/**
 * npx --yes tsx scripts/check-devis-duplicate.ts
 */
import assert from "node:assert/strict";
import {
  decalerDatesDansTexte,
  deltaJoursIso,
  regrouperDevisParTitre,
  titreGroupeCle,
} from "../src/lib/devisDuplicate";

assert.equal(deltaJoursIso("2025-03-01", "2026-03-01"), 365);
assert.equal(
  decalerDatesDansTexte("Intervention le 2025-03-01 puis 15/03/2025.", 365),
  "Intervention le 2026-03-01 puis 15/03/2026.",
);
assert.equal(titreGroupeCle("  Entretien   Saint Denis "), "entretien saint denis");

const groupes = regrouperDevisParTitre([
  { titre: "Entretien Saint Denis", createdAt: "2025-01-01T00:00:00Z", dateDevis: "2025-01-10" },
  { titre: "entretien saint denis", createdAt: "2026-01-01T00:00:00Z", dateDevis: "2026-01-10" },
  { titre: "Autre", createdAt: "2025-06-01T00:00:00Z" },
]);
assert.equal(groupes.length, 2);
assert.equal(groupes[0]?.devis.length, 2);
assert.equal(groupes[0]?.devis[0]?.dateDevis, "2026-01-10");
assert.equal(groupes[1]?.devis.length, 1);

console.log("devis duplicate: ok");
