import {
  type DevisContenu,
  type DevisTheme,
  type DevisZone,
  contenuDevisVide,
  normaliserContenuDevis,
  themeDefaut,
} from "./devisTypes";

export const DEVIS_STORAGE_KEY = "tk-gestion-devis-v1";

export type DevisStatut = "brouillon" | "enregistre" | "archive";

export type Devis = {
  id: string;
  titre: string;
  client: string;
  clientSociete?: string;
  clientEstSociete?: boolean;
  clientAdresse?: string;
  /** Société : SIREN (9 chiffres), distinct du SIRET. */
  clientSiren?: string;
  clientTva?: string;
  zone: DevisZone;
  montantHt: string;
  notes: string;
  statut: DevisStatut;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  createdByEmail?: string;
  contenu: DevisContenu;
  theme: DevisTheme;
  /** PDF exporté depuis le logiciel de comptabilité (optionnel). */
  pdfComptabiliteNom?: string;
  pdfComptabiliteBase64?: string;
};

type DevisFile = {
  devis: Devis[];
};

function normalizeZone(z: unknown): DevisZone {
  return z === "hors_idf" ? "hors_idf" : "idf";
}

function migrateLegacyDevis(raw: Record<string, unknown>): Devis | null {
  if (typeof raw.id !== "string") return null;
  const statut = raw.statut as string;
  if (!["brouillon", "enregistre", "archive"].includes(statut)) return null;

  const contenu = normaliserContenuDevis(
    raw.contenu && typeof raw.contenu === "object"
      ? (raw.contenu as DevisContenu)
      : contenuDevisVide(),
  );

  const theme =
    raw.theme && typeof raw.theme === "object"
      ? (raw.theme as DevisTheme)
      : themeDefaut();

  return {
    id: raw.id,
    titre: typeof raw.titre === "string" ? raw.titre : "Sans titre",
    client: typeof raw.client === "string" ? raw.client : "",
    clientSociete:
      typeof raw.clientSociete === "string" ? raw.clientSociete : undefined,
    clientEstSociete: Boolean(raw.clientEstSociete),
    clientAdresse:
      typeof raw.clientAdresse === "string" ? raw.clientAdresse : undefined,
    clientSiren:
      typeof raw.clientSiren === "string" ? raw.clientSiren : undefined,
    clientTva: typeof raw.clientTva === "string" ? raw.clientTva : undefined,
    zone: normalizeZone(raw.zone),
    montantHt: typeof raw.montantHt === "string" ? raw.montantHt : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    statut: statut as DevisStatut,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
    archivedAt:
      typeof raw.archivedAt === "string" ? raw.archivedAt : undefined,
    createdByEmail:
      typeof raw.createdByEmail === "string" ? raw.createdByEmail : undefined,
    contenu,
    theme,
    pdfComptabiliteNom:
      typeof raw.pdfComptabiliteNom === "string"
        ? raw.pdfComptabiliteNom
        : undefined,
    pdfComptabiliteBase64:
      typeof raw.pdfComptabiliteBase64 === "string"
        ? raw.pdfComptabiliteBase64
        : undefined,
  };
}

function loadRaw(): DevisFile {
  try {
    const s = localStorage.getItem(DEVIS_STORAGE_KEY);
    if (!s) return { devis: [] };
    const p = JSON.parse(s) as unknown;
    if (!p || typeof p !== "object" || !Array.isArray((p as DevisFile).devis)) {
      return { devis: [] };
    }
    const out: Devis[] = [];
    for (const x of (p as DevisFile).devis) {
      if (!x || typeof x !== "object") continue;
      const d = migrateLegacyDevis(x as Record<string, unknown>);
      if (d) out.push(d);
    }
    return { devis: out };
  } catch {
    return { devis: [] };
  }
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
  data: Omit<
    Devis,
    "id" | "createdAt" | "updatedAt" | "archivedAt" | "contenu" | "theme"
  > & { contenu?: DevisContenu; theme?: DevisTheme },
): Devis {
  const now = new Date().toISOString();
  const d: Devis = {
    ...data,
    contenu: normaliserContenuDevis(data.contenu ?? contenuDevisVide()),
    theme: data.theme ?? themeDefaut(),
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
  const next = { ...f.devis[i], ...data, id, updatedAt: now };
  if (data.contenu !== undefined) {
    next.contenu = normaliserContenuDevis(data.contenu);
  }
  f.devis[i] = next;
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
