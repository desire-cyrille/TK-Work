export const DEVIS_STORAGE_KEY = "tk-gestion-devis-v1";

export type DevisStatut = "brouillon" | "enregistre" | "archive";

export type Devis = {
  id: string;
  titre: string;
  client: string;
  montantHt: string;
  notes: string;
  statut: DevisStatut;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type DevisFile = {
  devis: Devis[];
};

function loadRaw(): DevisFile {
  try {
    const s = localStorage.getItem(DEVIS_STORAGE_KEY);
    if (!s) return { devis: [] };
    const p = JSON.parse(s) as unknown;
    if (!p || typeof p !== "object" || !Array.isArray((p as DevisFile).devis)) {
      return { devis: [] };
    }
    return { devis: (p as DevisFile).devis.filter(isDevis) };
  } catch {
    return { devis: [] };
  }
}

function isDevis(x: unknown): x is Devis {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.titre === "string" &&
    typeof r.statut === "string" &&
    ["brouillon", "enregistre", "archive"].includes(r.statut as string)
  );
}

function saveRaw(f: DevisFile) {
  localStorage.setItem(DEVIS_STORAGE_KEY, JSON.stringify(f));
}

export function listerDevis(): Devis[] {
  return loadRaw().devis.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDevis(id: string): Devis | undefined {
  return loadRaw().devis.find((d) => d.id === id);
}

export function ajouterDevis(
  data: Omit<Devis, "id" | "createdAt" | "updatedAt" | "archivedAt">,
): Devis {
  const now = new Date().toISOString();
  const d: Devis = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const f = loadRaw();
  f.devis.push(d);
  saveRaw(f);
  return d;
}

export function mettreAJourDevis(
  id: string,
  data: Partial<Omit<Devis, "id" | "createdAt">>,
) {
  const f = loadRaw();
  const i = f.devis.findIndex((x) => x.id === id);
  if (i === -1) return;
  const now = new Date().toISOString();
  f.devis[i] = { ...f.devis[i], ...data, id, updatedAt: now };
  saveRaw(f);
}

export function archiverDevis(id: string) {
  const now = new Date().toISOString();
  mettreAJourDevis(id, {
    statut: "archive",
    archivedAt: now,
  });
}

export function desarchiverDevis(id: string) {
  mettreAJourDevis(id, {
    statut: "enregistre",
    archivedAt: undefined,
  });
}

export function supprimerDevis(id: string) {
  const f = loadRaw();
  f.devis = f.devis.filter((x) => x.id !== id);
  saveRaw(f);
}
