/** Stockage local du module Rapport d’activité (projets + fiches enregistrées). */

const PROJETS_KEY = "tk-gestion-rapport-activite-projets-v2";
const RAPPORTS_KEY = "tk-gestion-rapport-activite-rapports-v2";

export type RapportActiviteSite = {
  id: string;
  nom: string;
};

export type RapportActiviteProjetStatut = "en_cours" | "termine";

export type RapportActiviteProjet = {
  id: string;
  titre: string;
  sites: RapportActiviteSite[];
  statut: RapportActiviteProjetStatut;
  createdAt: string;
  updatedAt: string;
};

/** Fiche enregistrée (synthèse minimale pour comptage et listes futures). */
export type RapportActiviteFiche = {
  id: string;
  projetId: string;
  titre: string;
  createdAt: string;
  updatedAt: string;
};

function newId(): string {
  return crypto.randomUUID();
}

function parseProjets(raw: string | null): RapportActiviteProjet[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: RapportActiviteProjet[] = [];
    for (const row of v) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
      const titre = typeof o.titre === "string" ? o.titre.trim() : "";
      if (!id || !titre) continue;
      const statut =
        o.statut === "termine" ? "termine" : ("en_cours" as const);
      const createdAt =
        typeof o.createdAt === "string" && o.createdAt.trim()
          ? o.createdAt.trim()
          : new Date().toISOString();
      const updatedAt =
        typeof o.updatedAt === "string" && o.updatedAt.trim()
          ? o.updatedAt.trim()
          : createdAt;
      const sitesRaw = o.sites;
      const sites: RapportActiviteSite[] = [];
      if (Array.isArray(sitesRaw)) {
        for (const s of sitesRaw) {
          if (!s || typeof s !== "object") continue;
          const so = s as Record<string, unknown>;
          const sid =
            typeof so.id === "string" && so.id.trim() ? so.id.trim() : newId();
          const nom =
            typeof so.nom === "string" && so.nom.trim()
              ? so.nom.trim()
              : "Site";
          sites.push({ id: sid, nom });
        }
      }
      out.push({ id, titre, sites, statut, createdAt, updatedAt });
    }
    return out;
  } catch {
    return [];
  }
}

function writeProjets(list: RapportActiviteProjet[]): void {
  localStorage.setItem(PROJETS_KEY, JSON.stringify(list));
}

export function listerProjetsRapportActivite(): RapportActiviteProjet[] {
  return parseProjets(localStorage.getItem(PROJETS_KEY));
}

export function getProjetRapportActivite(
  id: string,
): RapportActiviteProjet | undefined {
  const pid = id.trim();
  return listerProjetsRapportActivite().find((p) => p.id === pid);
}

export function sauvegarderProjetRapportActivite(
  projet: RapportActiviteProjet,
): void {
  const now = new Date().toISOString();
  const liste = listerProjetsRapportActivite();
  const idx = liste.findIndex((p) => p.id === projet.id);
  const row: RapportActiviteProjet = {
    ...projet,
    updatedAt: now,
    createdAt:
      idx >= 0 ? liste[idx]!.createdAt : projet.createdAt || now,
  };
  if (idx >= 0) liste[idx] = row;
  else liste.push(row);
  writeProjets(liste);
}

export function creerProjetRapportActivite(input: {
  titre: string;
  sitesNoms?: string[];
}): RapportActiviteProjet {
  const now = new Date().toISOString();
  const titre = input.titre.trim() || "Nouveau projet";
  const noms =
    input.sitesNoms?.map((s) => s.trim()).filter(Boolean) ?? [];
  const sites: RapportActiviteSite[] =
    noms.length > 0
      ? noms.map((nom) => ({ id: newId(), nom }))
      : [{ id: newId(), nom: "Site principal" }];
  const p: RapportActiviteProjet = {
    id: newId(),
    titre,
    sites,
    statut: "en_cours",
    createdAt: now,
    updatedAt: now,
  };
  sauvegarderProjetRapportActivite(p);
  return p;
}

function parseRapports(raw: string | null): RapportActiviteFiche[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: RapportActiviteFiche[] = [];
    for (const row of v) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
      const projetId =
        typeof o.projetId === "string" && o.projetId.trim()
          ? o.projetId.trim()
          : "";
      const titre = typeof o.titre === "string" ? o.titre.trim() : "";
      if (!id || !projetId) continue;
      const createdAt =
        typeof o.createdAt === "string" && o.createdAt.trim()
          ? o.createdAt.trim()
          : new Date().toISOString();
      const updatedAt =
        typeof o.updatedAt === "string" && o.updatedAt.trim()
          ? o.updatedAt.trim()
          : createdAt;
      out.push({
        id,
        projetId,
        titre: titre || "Rapport",
        createdAt,
        updatedAt,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function writeRapports(list: RapportActiviteFiche[]): void {
  localStorage.setItem(RAPPORTS_KEY, JSON.stringify(list));
}

export function listerRapportsRapportActivite(): RapportActiviteFiche[] {
  return parseRapports(localStorage.getItem(RAPPORTS_KEY));
}

export function compterRapportsPourProjet(projetId: string): number {
  const pid = projetId.trim();
  return listerRapportsRapportActivite().filter((r) => r.projetId === pid)
    .length;
}

/** Utile plus tard pour l’éditeur de rapport ; permet dès maintenant d’alimenter les compteurs. */
export function enregistrerFicheRapportActivite(
  data: Omit<RapportActiviteFiche, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
): RapportActiviteFiche {
  const now = new Date().toISOString();
  const liste = listerRapportsRapportActivite();
  const id = data.id?.trim() || newId();
  const idx = liste.findIndex((r) => r.id === id);
  const row: RapportActiviteFiche = {
    id,
    projetId: data.projetId.trim(),
    titre: data.titre.trim() || "Rapport",
    createdAt: idx >= 0 ? liste[idx]!.createdAt : now,
    updatedAt: now,
  };
  if (idx >= 0) liste[idx] = row;
  else liste.push(row);
  writeRapports(liste);
  return row;
}

export function statsRapportActiviteAccueil(): {
  nbProjets: number;
  nbRapports: number;
  nbSites: number;
} {
  const projets = listerProjetsRapportActivite();
  const rapports = listerRapportsRapportActivite();
  const nbSites = projets.reduce((n, p) => n + p.sites.length, 0);
  return {
    nbProjets: projets.length,
    nbRapports: rapports.length,
    nbSites,
  };
}

export function projetsEnCoursRapportActivite(): RapportActiviteProjet[] {
  return listerProjetsRapportActivite()
    .filter((p) => p.statut === "en_cours")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
