import {
  cloneDomainesDefaut,
  type RapportDomaineDef,
} from "../data/rapportParkingDomains";

const PROJETS_KEY = "tk-gestion-rapports-projets-v1";
/** Même clé que `rapportChainStorage.ts` — réassignation lors de la purge du projet import. */
const RAPPORT_CHAIN_STORAGE_KEY = "tk-gestion-rapports-chain-v1";

/** Ancien projet technique de migration ; retiré automatiquement au chargement (voir `chargerProjets`). */
const LEGACY_PROJET_TITRE = "Projet importé (données existantes)";

export type RapportSiteProjet = {
  id: string;
  nom: string;
  photoDataUrl?: string;
};

export type RapportProjet = {
  id: string;
  titre: string;
  /** Conservé : doit rester égal à `sites.length` après migration. */
  nombreSites: number;
  /** Image page de garde (data URL). */
  couvertureDataUrl?: string;
  /** Logo principal (PDF : haut à gauche sur le bandeau). */
  logoDataUrl?: string;
  /** Logo client (PDF : haut à droite sur le bandeau). */
  logoClientDataUrl?: string;
  /** Coordonnées de l’émetteur / structure (texte libre multiligne). */
  coordonneesEmetteur?: string;
  /** Raison sociale ou nom du client (société possible). */
  clientRaisonSociale?: string;
  clientCoordonnees?: string;
  /** Texte reproduit en pied de page sur chaque page du PDF. */
  piedDePageRapport?: string;
  sites: RapportSiteProjet[];
  /** Domaines de rédaction (texte / photo par bloc). Toujours au moins une entrée après normalisation. */
  domainesRapport: RapportDomaineDef[];
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function newId() {
  return crypto.randomUUID();
}

/** Identifiants stables pour éviter de casser les rapports déjà liés aux sites. */
export function creerSitesDefautPourProjet(projetId: string, n: number): RapportSiteProjet[] {
  const count = Math.max(1, Math.floor(n));
  return Array.from({ length: count }, (_, i) => ({
    id: `${projetId}-s${i}`,
    nom: count === 1 ? "Site principal" : `Site ${i + 1}`,
  }));
}

function normalizeSite(raw: unknown, projetId: string, index: number): RapportSiteProjet | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === "string" && o.id.trim()
      ? o.id
      : `${projetId}-s${index}`;
  const nom = typeof o.nom === "string" && o.nom.trim() ? o.nom.trim() : `Site ${index + 1}`;
  const photoDataUrl =
    typeof o.photoDataUrl === "string" && o.photoDataUrl.startsWith("data:")
      ? o.photoDataUrl
      : undefined;
  return { id, nom, photoDataUrl };
}

function normalizeDomainesRapport(raw: unknown): RapportDomaineDef[] {
  if (!Array.isArray(raw) || raw.length === 0) return cloneDomainesDefaut();
  const out: RapportDomaineDef[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const hint = typeof r.hint === "string" ? r.hint : "";
    if (!id || !label) continue;
    out.push({ id, label, hint });
  }
  return out.length > 0 ? out : cloneDomainesDefaut();
}

function normalizeProjet(raw: unknown): RapportProjet | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const titre = typeof o.titre === "string" ? o.titre.trim() || "Projet" : "Projet";
  let nombreSites =
    typeof o.nombreSites === "number" && Number.isFinite(o.nombreSites)
      ? Math.max(0, Math.floor(o.nombreSites))
      : 0;
  const archived = o.archived === true;
  const archivedAt = typeof o.archivedAt === "string" ? o.archivedAt : undefined;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString();
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : createdAt;

  const couvertureDataUrl =
    typeof o.couvertureDataUrl === "string" && o.couvertureDataUrl.startsWith("data:")
      ? o.couvertureDataUrl
      : undefined;
  const logoDataUrl =
    typeof o.logoDataUrl === "string" && o.logoDataUrl.startsWith("data:")
      ? o.logoDataUrl
      : undefined;
  const logoClientDataUrl =
    typeof o.logoClientDataUrl === "string" && o.logoClientDataUrl.startsWith("data:")
      ? o.logoClientDataUrl
      : undefined;
  const coordonneesEmetteur = typeof o.coordonneesEmetteur === "string" ? o.coordonneesEmetteur : undefined;
  const clientRaisonSociale = typeof o.clientRaisonSociale === "string" ? o.clientRaisonSociale : undefined;
  const clientCoordonnees = typeof o.clientCoordonnees === "string" ? o.clientCoordonnees : undefined;
  const piedDePageRapport = typeof o.piedDePageRapport === "string" ? o.piedDePageRapport : undefined;

  let sites: RapportSiteProjet[] = [];
  if (Array.isArray(o.sites)) {
    sites = o.sites
      .map((row, i) => normalizeSite(row, id, i))
      .filter((x): x is RapportSiteProjet => x !== null);
  }
  if (sites.length === 0) {
    sites = creerSitesDefautPourProjet(id, Math.max(1, nombreSites || 1));
  }
  nombreSites = sites.length;

  const domainesRapport = normalizeDomainesRapport(o.domainesRapport);

  return {
    id,
    titre,
    nombreSites,
    couvertureDataUrl,
    logoDataUrl,
    logoClientDataUrl,
    coordonneesEmetteur,
    clientRaisonSociale,
    clientCoordonnees,
    piedDePageRapport,
    sites,
    domainesRapport,
    archived,
    archivedAt,
    createdAt,
    updatedAt,
  };
}

function parseProjetsDepuisStockage(): RapportProjet[] {
  try {
    const raw = localStorage.getItem(PROJETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeProjet).filter((x): x is RapportProjet => x !== null);
  } catch {
    return [];
  }
}

function reassignerRapportsChainProjetId(
  ancienProjetId: string,
  nouveauProjetId: string,
): void {
  if (!ancienProjetId || !nouveauProjetId || ancienProjetId === nouveauProjetId) {
    return;
  }
  try {
    const raw = localStorage.getItem(RAPPORT_CHAIN_STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return;
    let changed = false;
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      if (o.projetId === ancienProjetId) {
        o.projetId = nouveauProjetId;
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(RAPPORT_CHAIN_STORAGE_KEY, JSON.stringify(arr));
    }
  } catch {
    /* ignore */
  }
}

export function chargerProjets(): RapportProjet[] {
  const list = parseProjetsDepuisStockage();
  const legacyProjects = list.filter((p) => p.titre === LEGACY_PROJET_TITRE);
  if (!legacyProjects.length) {
    return list;
  }

  const rest = list.filter((p) => p.titre !== LEGACY_PROJET_TITRE);
  let replacementId = rest.find((p) => !p.archived)?.id;

  if (!replacementId) {
    const now = new Date().toISOString();
    const id = newId();
    const sites = creerSitesDefautPourProjet(id, 1);
    rest.push({
      id,
      titre: "Nouveau projet",
      nombreSites: 1,
      sites,
      domainesRapport: cloneDomainesDefaut(),
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
    replacementId = id;
  }

  for (const lp of legacyProjects) {
    reassignerRapportsChainProjetId(lp.id, replacementId);
  }

  enregistrerProjets(rest);
  return rest;
}

function enregistrerProjets(liste: RapportProjet[]) {
  localStorage.setItem(PROJETS_KEY, JSON.stringify(liste));
}

/**
 * Rattache les anciennes entrées de chaîne sans `projetId` au premier projet actif,
 * ou crée un projet minimal si la liste est vide (le projet « importé » n’est plus créé).
 */
export function getOrCreateLegacyProjetId(): string {
  const actifs = projetsActifs();
  const first = actifs[0];
  if (first) return first.id;
  const row = creerProjet({ titre: "Nouveau projet", nombreSites: 1 });
  return row.id;
}

/** Domaines effectifs du projet (toujours au moins un). */
export function getDomainesRapportProjet(p: RapportProjet): RapportDomaineDef[] {
  if (p.domainesRapport?.length) return p.domainesRapport;
  return cloneDomainesDefaut();
}

export function getDomainesPourProjetOuDefaut(projetId: string): RapportDomaineDef[] {
  const p = getProjetById(projetId.trim());
  if (p) return getDomainesRapportProjet(p);
  return cloneDomainesDefaut();
}

export function getProjetById(id: string): RapportProjet | undefined {
  return chargerProjets().find((p) => p.id === id);
}

export function creerProjet(partial?: { titre?: string; nombreSites?: number }): RapportProjet {
  const now = new Date().toISOString();
  const id = newId();
  const n =
    typeof partial?.nombreSites === "number" && Number.isFinite(partial.nombreSites)
      ? Math.max(1, Math.floor(partial.nombreSites))
      : 1;
  const sites = creerSitesDefautPourProjet(id, n);
  const row: RapportProjet = {
    id,
    titre: (partial?.titre ?? "Nouveau projet").trim() || "Nouveau projet",
    nombreSites: sites.length,
    sites,
    domainesRapport: cloneDomainesDefaut(),
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  const liste = chargerProjets();
  liste.push(row);
  enregistrerProjets(liste);
  return row;
}

export function mettreAJourProjet(
  id: string,
  patch: Partial<Pick<RapportProjet, "titre" | "nombreSites">>,
): RapportProjet | null {
  const liste = chargerProjets();
  const idx = liste.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const cur = liste[idx];
  if (typeof patch.titre === "string") {
    cur.titre = patch.titre.trim() || cur.titre;
  }
  if (typeof patch.nombreSites === "number" && Number.isFinite(patch.nombreSites)) {
    const n = Math.max(1, Math.floor(patch.nombreSites));
    cur.sites = creerSitesDefautPourProjet(cur.id, n).map((s, i) => ({
      ...s,
      nom: cur.sites[i]?.nom ?? s.nom,
      photoDataUrl: cur.sites[i]?.photoDataUrl,
    }));
    cur.nombreSites = cur.sites.length;
  }
  cur.updatedAt = now;
  liste[idx] = cur;
  enregistrerProjets(liste);
  return cur;
}

export function mettreAJourProjetComplet(
  id: string,
  patch: Partial<
    Pick<
      RapportProjet,
      | "titre"
      | "nombreSites"
      | "couvertureDataUrl"
      | "logoDataUrl"
      | "logoClientDataUrl"
      | "coordonneesEmetteur"
      | "clientRaisonSociale"
      | "clientCoordonnees"
      | "piedDePageRapport"
      | "sites"
      | "domainesRapport"
    >
  >,
): RapportProjet | null {
  const liste = chargerProjets();
  const idx = liste.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const cur = liste[idx];
  if (typeof patch.titre === "string") cur.titre = patch.titre.trim() || cur.titre;
  if (typeof patch.coordonneesEmetteur === "string") cur.coordonneesEmetteur = patch.coordonneesEmetteur;
  if (typeof patch.clientRaisonSociale === "string") cur.clientRaisonSociale = patch.clientRaisonSociale;
  if (typeof patch.clientCoordonnees === "string") cur.clientCoordonnees = patch.clientCoordonnees;
  if (typeof patch.piedDePageRapport === "string") cur.piedDePageRapport = patch.piedDePageRapport;

  if (patch.couvertureDataUrl === undefined) {
    /* noop */
  } else if (patch.couvertureDataUrl === "" || patch.couvertureDataUrl === null) {
    cur.couvertureDataUrl = undefined;
  } else if (typeof patch.couvertureDataUrl === "string") {
    cur.couvertureDataUrl = patch.couvertureDataUrl.startsWith("data:")
      ? patch.couvertureDataUrl
      : undefined;
  }

  if (patch.logoDataUrl === undefined) {
    /* noop */
  } else if (patch.logoDataUrl === "" || patch.logoDataUrl === null) {
    cur.logoDataUrl = undefined;
  } else if (typeof patch.logoDataUrl === "string") {
    cur.logoDataUrl = patch.logoDataUrl.startsWith("data:") ? patch.logoDataUrl : undefined;
  }

  if (patch.logoClientDataUrl === undefined) {
    /* noop */
  } else if (patch.logoClientDataUrl === "" || patch.logoClientDataUrl === null) {
    cur.logoClientDataUrl = undefined;
  } else if (typeof patch.logoClientDataUrl === "string") {
    cur.logoClientDataUrl = patch.logoClientDataUrl.startsWith("data:")
      ? patch.logoClientDataUrl
      : undefined;
  }

  if (Array.isArray(patch.sites)) {
    cur.sites = patch.sites.map((s, i) => ({
      id: typeof s.id === "string" && s.id ? s.id : `${cur.id}-s${i}`,
      nom: typeof s.nom === "string" && s.nom.trim() ? s.nom.trim() : `Site ${i + 1}`,
      photoDataUrl:
        typeof s.photoDataUrl === "string" && s.photoDataUrl.startsWith("data:")
          ? s.photoDataUrl
          : undefined,
    }));
    cur.nombreSites = cur.sites.length;
  } else if (typeof patch.nombreSites === "number" && Number.isFinite(patch.nombreSites)) {
    const n = Math.max(1, Math.floor(patch.nombreSites));
    const next = creerSitesDefautPourProjet(cur.id, n);
    cur.sites = next.map((s, i) => ({
      id: s.id,
      nom: cur.sites[i]?.nom ?? s.nom,
      photoDataUrl: cur.sites[i]?.photoDataUrl,
    }));
    cur.nombreSites = cur.sites.length;
  }

  if (Array.isArray(patch.domainesRapport) && patch.domainesRapport.length > 0) {
    cur.domainesRapport = patch.domainesRapport.map((d) => ({
      id: typeof d.id === "string" && d.id.trim() ? d.id.trim() : "",
      label: typeof d.label === "string" ? d.label.trim() : "",
      hint: typeof d.hint === "string" ? d.hint : "",
    })).filter((d) => d.id && d.label);
    if (cur.domainesRapport.length === 0) {
      cur.domainesRapport = cloneDomainesDefaut();
    }
  }

  cur.updatedAt = now;
  liste[idx] = cur;
  enregistrerProjets(liste);
  return cur;
}

export function archiverProjet(id: string): RapportProjet | null {
  const liste = chargerProjets();
  const idx = liste.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const cur = liste[idx];
  cur.archived = true;
  cur.archivedAt = now;
  cur.updatedAt = now;
  liste[idx] = cur;
  enregistrerProjets(liste);
  return cur;
}

export function restaurerProjet(id: string): RapportProjet | null {
  const liste = chargerProjets();
  const idx = liste.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const cur = liste[idx];
  cur.archived = false;
  cur.archivedAt = undefined;
  cur.updatedAt = now;
  liste[idx] = cur;
  enregistrerProjets(liste);
  return cur;
}

export function supprimerProjetEntry(id: string): boolean {
  const avant = chargerProjets();
  const apres = avant.filter((p) => p.id !== id);
  if (apres.length === avant.length) return false;
  enregistrerProjets(apres);
  return true;
}

export function projetsActifs(): RapportProjet[] {
  return chargerProjets().filter((p) => !p.archived);
}

export function projetsArchives(): RapportProjet[] {
  return chargerProjets().filter((p) => p.archived);
}

export function statsModuleRapport(rapportsParProjet: (projetId: string) => number) {
  const actifs = projetsActifs();
  const projets = actifs.length;
  let rapports = 0;
  let sites = 0;
  for (const p of actifs) {
    rapports += rapportsParProjet(p.id);
    sites += p.sites.length;
  }
  return { projets, rapports, sites };
}
