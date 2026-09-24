/** Fusion de fichiers devis (nuage + local) : union par id, plus récente `updatedAt`. */

export const DEVIS_FILE_STORAGE_KEY = "tk-gestion-devis-v1";

export type DevisTombstone = { id: string; deletedAt: string };

export type DevisFileJson = {
  devis: unknown[];
  deletedIds: DevisTombstone[];
};

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

function parseTombstones(raw: unknown): DevisTombstone[] {
  if (!Array.isArray(raw)) return [];
  const out: DevisTombstone[] = [];
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

export function parseDevisFileJson(
  raw: string | null | undefined,
): DevisFileJson {
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

export function serializeDevisFileJson(file: DevisFileJson): string {
  const payload: { devis: unknown[]; deletedIds?: DevisTombstone[] } = {
    devis: file.devis,
  };
  if (file.deletedIds.length > 0) payload.deletedIds = file.deletedIds;
  return JSON.stringify(payload);
}

function mergeTombstones(
  a: DevisTombstone[],
  b: DevisTombstone[],
): DevisTombstone[] {
  const map = new Map<string, DevisTombstone>();
  for (const t of [...a, ...b]) {
    const prev = map.get(t.id);
    if (!prev || t.deletedAt > prev.deletedAt) map.set(t.id, t);
  }
  return [...map.values()];
}

function mergeDevisItems(a: unknown[], b: unknown[]): unknown[] {
  const map = new Map<string, unknown>();
  for (const item of [...a, ...b]) {
    const id = itemId(item);
    if (!id) continue;
    const prev = map.get(id);
    if (!prev || itemUpdatedAt(item) >= itemUpdatedAt(prev)) {
      map.set(id, item);
    }
  }
  return [...map.values()];
}

function applyTombstones(
  devis: unknown[],
  deletedIds: DevisTombstone[],
): unknown[] {
  if (deletedIds.length === 0) return devis;
  const tombs = new Map(deletedIds.map((t) => [t.id, t.deletedAt]));
  return devis.filter((item) => {
    const id = itemId(item);
    if (!id) return false;
    const deletedAt = tombs.get(id);
    if (!deletedAt) return true;
    return itemUpdatedAt(item) > deletedAt;
  });
}

/** Union de deux copies `tk-gestion-devis-v1` (ne réécrit pas le contenu d’un devis). */
export function mergeDevisFileJson(
  a: string | null | undefined,
  b: string | null | undefined,
): string {
  const left = parseDevisFileJson(a);
  const right = parseDevisFileJson(b);
  const deletedIds = mergeTombstones(left.deletedIds, right.deletedIds);
  const devis = applyTombstones(
    mergeDevisItems(left.devis, right.devis),
    deletedIds,
  );
  return serializeDevisFileJson({ devis, deletedIds });
}
