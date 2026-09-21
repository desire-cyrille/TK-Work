import {
  type DevisContenu,
  type DevisModele,
  type DevisTheme,
  type DevisZone,
  contenuDevisVide,
  normaliserContenuDevis,
  themeDefaut,
} from "./devisTypes";
import {
  clonerContenuDevisAvecNouveauxIds,
  dateDevisEffective,
  decalerDatesContenu,
  decalerDatesDansTexte,
  deltaJoursIso,
} from "./devisDuplicate";

export const DEVIS_STORAGE_KEY = "tk-gestion-devis-v1";

export type DevisStatut = "brouillon" | "enregistre" | "archive";

function normalizeModeleDevis(v: unknown): DevisModele {
  return v === "forfaitaire" ? "forfaitaire" : "detaille";
}

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
  /** Présent sur tous les devis après migration (défaut : détaillé). */
  modeleDevis: DevisModele;
  montantHt: string;
  notes: string;
  statut: DevisStatut;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  createdByEmail?: string;
  contenu: DevisContenu;
  theme: DevisTheme;
  /** Date officielle du devis (AAAA-MM-JJ). Si absente : jour de createdAt. */
  dateDevis?: string;
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
    dateDevis:
      typeof raw.dateDevis === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dateDevis.trim())
        ? raw.dateDevis.trim().slice(0, 10)
        : undefined,
    pdfComptabiliteNom:
      typeof raw.pdfComptabiliteNom === "string"
        ? raw.pdfComptabiliteNom
        : undefined,
    pdfComptabiliteBase64:
      typeof raw.pdfComptabiliteBase64 === "string"
        ? raw.pdfComptabiliteBase64
        : undefined,
    modeleDevis: normalizeModeleDevis(raw.modeleDevis),
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
    | "id"
    | "createdAt"
    | "updatedAt"
    | "archivedAt"
    | "contenu"
    | "theme"
    | "modeleDevis"
  > & {
    contenu?: DevisContenu;
    theme?: DevisTheme;
    modeleDevis?: DevisModele;
  },
): Devis {
  const now = new Date().toISOString();
  const d: Devis = {
    ...data,
    dateDevis:
      typeof data.dateDevis === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.dateDevis.trim())
        ? data.dateDevis.trim().slice(0, 10)
        : now.slice(0, 10),
    modeleDevis: normalizeModeleDevis(data.modeleDevis),
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

export type OptionsDuplicationDevis = {
  /** Nouvelle date officielle (AAAA-MM-JJ). Défaut : aujourd’hui. */
  dateDevis?: string;
  createdByEmail?: string;
};

/**
 * Copie un devis existant (même titre, même contenu).
 * N’écrit pas sur la source. L’annexe PDF comptable n’est pas recopiée.
 * Les dates dans les textes sont décalées selon `dateDevis`.
 */
export function dupliquerDevis(
  id: string,
  options?: OptionsDuplicationDevis,
): Devis | undefined {
  const src = getDevis(id);
  if (!src) return undefined;
  const today = new Date().toISOString().slice(0, 10);
  const dateCible =
    typeof options?.dateDevis === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(options.dateDevis.trim())
      ? options.dateDevis.trim().slice(0, 10)
      : today;
  const dateSrc = dateDevisEffective(src);
  const delta = deltaJoursIso(dateSrc, dateCible);
  let contenu = clonerContenuDevisAvecNouveauxIds(src.contenu);
  contenu = decalerDatesContenu(contenu, delta);
  const notes = decalerDatesDansTexte(src.notes ?? "", delta);
  return ajouterDevis({
    titre: src.titre,
    client: src.client,
    clientSociete: src.clientSociete,
    clientEstSociete: src.clientEstSociete,
    clientAdresse: src.clientAdresse,
    clientSiren: src.clientSiren,
    clientTva: src.clientTva,
    zone: src.zone,
    montantHt: src.montantHt,
    notes,
    statut: "brouillon",
    createdByEmail: options?.createdByEmail ?? src.createdByEmail,
    modeleDevis: src.modeleDevis,
    contenu,
    theme: src.theme,
    dateDevis: dateCible,
  });
}
