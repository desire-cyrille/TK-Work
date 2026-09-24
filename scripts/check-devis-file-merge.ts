/**
 * npx --yes tsx scripts/check-devis-file-merge.ts
 */
import assert from "node:assert/strict";
import { mergeDevisFileJson, parseDevisFileJson } from "../src/lib/devisFileMerge";
import { mergeWorkspaceEntryMaps } from "../src/lib/workspaceCollectionMerge";

const userA = JSON.stringify({
  devis: [
    {
      id: "d1",
      titre: "Commun",
      updatedAt: "2026-01-01T10:00:00.000Z",
      statut: "enregistre",
    },
    {
      id: "d-alice",
      titre: "Devis d’Alice",
      updatedAt: "2026-03-20T09:00:00.000Z",
      createdByEmail: "alice@tk.fr",
      statut: "brouillon",
    },
  ],
});

const userB = JSON.stringify({
  devis: [
    {
      id: "d1",
      titre: "Commun modifié",
      updatedAt: "2026-02-01T10:00:00.000Z",
      statut: "enregistre",
    },
    {
      id: "d-bob",
      titre: "Devis de Bob",
      updatedAt: "2026-03-21T09:00:00.000Z",
      createdByEmail: "bob@tk.fr",
      statut: "enregistre",
    },
  ],
});

const merged = parseDevisFileJson(mergeDevisFileJson(userA, userB));
const byId = new Map(
  merged.devis.map((x) => {
    const o = x as { id: string; titre: string };
    return [o.id, o];
  }),
);
assert.equal(merged.devis.length, 3);
assert.equal(byId.get("d-alice")?.titre, "Devis d’Alice");
assert.equal(byId.get("d-bob")?.titre, "Devis de Bob");
assert.equal(byId.get("d1")?.titre, "Commun modifié");

const afterDelete = mergeDevisFileJson(
  mergeDevisFileJson(userA, userB),
  JSON.stringify({
    devis: [],
    deletedIds: [{ id: "d-alice", deletedAt: "2026-03-22T00:00:00.000Z" }],
  }),
);
const afterDeleteParsed = parseDevisFileJson(afterDelete);
assert.equal(
  afterDeleteParsed.devis.some((x) => (x as { id: string }).id === "d-alice"),
  false,
);
assert.equal(afterDeleteParsed.devis.length, 2);

const resurrect = mergeDevisFileJson(
  afterDelete,
  JSON.stringify({
    devis: [
      {
        id: "d-alice",
        titre: "Alice rééditée",
        updatedAt: "2026-03-23T00:00:00.000Z",
        statut: "enregistre",
      },
    ],
  }),
);
assert.equal(
  parseDevisFileJson(resurrect).devis.some(
    (x) => (x as { id: string; titre: string }).titre === "Alice rééditée",
  ),
  true,
);

const maps = mergeWorkspaceEntryMaps(
  { "tk-gestion-devis-v1": userA, "tk-gestion-theme-v2": "light" },
  { "tk-gestion-devis-v1": userB, "tk-gestion-theme-v2": "dark" },
);
assert.equal(maps["tk-gestion-theme-v2"], "dark");
assert.equal(parseDevisFileJson(maps["tk-gestion-devis-v1"]).devis.length, 3);

assert.equal(parseDevisFileJson(mergeDevisFileJson(null, undefined)).devis.length, 0);

console.log("devis file merge: ok");
