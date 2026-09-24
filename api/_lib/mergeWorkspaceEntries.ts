import { jsonbValueToLocalStorageString } from "./jsonbStorageValue.js";

const DEVIS_KEY = "tk-gestion-devis-v1";

type Tombstone = { id: string; deletedAt: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function itemId(v: unknown): string | null {
  const o = asRecord(v);
  return o && typeof o.id === "string" && o.id.trim() ? o.id : null;
}

function itemUpdatedAt(v: unknown): string {
  const o = asRecord(v);
  return o && typeof o.updatedAt === "string" ? o.updatedAt : "";
}

function parseTombstones(raw: unknown): Tombstone[] {
  if (!Array.isArray(raw)) return [];
  const out: Tombstone[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const o = asRecord(x);
    if (!o || typeof o.id !== "string" || !o.id.trim()) continue;
    if (typeof o.deletedAt !== "string" || !o.deletedAt.trim()) continue;
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push({ id: o.id, deletedAt: o.deletedAt });
  }
  return out;
}

function parseDevisFile(raw: string | undefined): {
  devis: unknown[];
  deletedIds: Tombstone[];
} {
  if (!raw || !raw.trim()) return { devis: [], deletedIds: [] };
  try {
    const p = JSON.parse(raw) as unknown;
    const o = asRecord(p);
    if (!o) return { devis: [], deletedIds: [] };
    return {
      devis: Array.isArray(o.devis) ? o.devis : [],
      deletedIds: parseTombstones(o.deletedIds),
    };
  } catch {
    return { devis: [], deletedIds: [] };
  }
}

function mergeDevisFileJson(
  a: string | undefined,
  b: string | undefined,
): string {
  const left = parseDevisFile(a);
  const right = parseDevisFile(b);
  const tombs = new Map<string, string>();
  for (const t of [...left.deletedIds, ...right.deletedIds]) {
    const prev = tombs.get(t.id);
    if (!prev || t.deletedAt > prev) tombs.set(t.id, t.deletedAt);
  }
  const items = new Map<string, unknown>();
  for (const item of [...left.devis, ...right.devis]) {
    const id = itemId(item);
    if (!id) continue;
    const prev = items.get(id);
    if (!prev || itemUpdatedAt(item) >= itemUpdatedAt(prev)) {
      items.set(id, item);
    }
  }
  const deletedIds = [...tombs.entries()].map(([id, deletedAt]) => ({
    id,
    deletedAt,
  }));
  const devis = [...items.values()].filter((item) => {
    const id = itemId(item);
    if (!id) return false;
    const deletedAt = tombs.get(id);
    if (!deletedAt) return true;
    return itemUpdatedAt(item) > deletedAt;
  });
  const payload: { devis: unknown[]; deletedIds?: Tombstone[] } = { devis };
  if (deletedIds.length > 0) payload.deletedIds = deletedIds;
  return JSON.stringify(payload);
}

function payloadToStringMap(
  payload: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    const s = jsonbValueToLocalStorageString(v);
    if (s !== null) out[k] = s;
  }
  return out;
}

/**
 * Fusion d’un push partiel avec l’instantané serveur.
 * Les devis sont unis par id ; les autres clés restent en remplacement.
 */
export function mergeWorkspacePayload(
  currentPayload: Record<string, unknown> | null | undefined,
  incoming: Record<string, string>,
): Record<string, string> {
  const current =
    currentPayload &&
    typeof currentPayload === "object" &&
    !Array.isArray(currentPayload)
      ? payloadToStringMap(currentPayload)
      : {};
  const out: Record<string, string> = { ...current, ...incoming };
  if (current[DEVIS_KEY] || incoming[DEVIS_KEY]) {
    out[DEVIS_KEY] = mergeDevisFileJson(current[DEVIS_KEY], incoming[DEVIS_KEY]);
  }
  return out;
}
