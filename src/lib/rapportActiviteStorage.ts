/** Stockage local — Rapport d’activité (projets v3, rapports validés, migration v2). */

import { brouillonPrefillDepuisType } from "./rapportActiviteFusion";
import type {
  RapportActiviteFiche,
  RapportActiviteProjet,
  RapportActiviteProjetStatut,
  RapportBrouillonState,
  RapportColonneTableau,
  RapportDomaineDef,
  TypeRapportActivite,
} from "./rapportActiviteTypes";
import {
  brouillonVidePourProjet,
  cloneColonnesDefaut,
  cloneDomainesDefaut,
} from "./rapportActiviteTypes";

const PROJETS_V3 = "tk-gestion-rapport-activite-projets-v3";
const PROJETS_V2 = "tk-gestion-rapport-activite-projets-v2";
const RAPPORTS_V3 = "tk-gestion-rapport-activite-rapports-v3";
const RAPPORTS_V2 = "tk-gestion-rapport-activite-rapports-v2";

export type {
  RapportActiviteFiche,
  RapportActiviteProjet,
  RapportActiviteProjetStatut,
  RapportActiviteSite,
  RapportBrouillonState,
  TypeRapportActivite,
} from "./rapportActiviteTypes";

function newId(): string {
  return crypto.randomUUID();
}

function migrateProjetV2(raw: Record<string, unknown>): RapportActiviteProjet | null {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  const titre = typeof raw.titre === "string" ? raw.titre.trim() : "";
  if (!id || !titre) return null;
  const legacyStatut = raw.statut;
  const statut: RapportActiviteProjetStatut =
    legacyStatut === "termine" || legacyStatut === "archive"
      ? "archive"
      : "actif";
  const sites: RapportActiviteProjet["sites"] = [];
  if (Array.isArray(raw.sites)) {
    for (const s of raw.sites) {
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      const sid =
        typeof so.id === "string" && so.id.trim() ? so.id.trim() : newId();
      const nom =
        typeof so.nom === "string" && so.nom.trim() ? so.nom.trim() : "Site";
      sites.push({ id: sid, nom });
    }
  }
  if (sites.length === 0) sites.push({ id: newId(), nom: "Site principal" });
  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt.trim()
      ? raw.createdAt.trim()
      : new Date().toISOString();
  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt.trim()
      ? raw.updatedAt.trim()
      : createdAt;
  const domaines = cloneDomainesDefaut();
  const colonnesTableau = cloneColonnesDefaut();
  const p: RapportActiviteProjet = {
    id,
    titre,
    sites,
    statut,
    clientNom: "",
    domaines,
    colonnesTableau,
    piedPagePdf: "",
    dernierePageMessage: "",
    brouillon: brouillonVidePourProjet({
      sites,
      domaines,
    }),
    createdAt,
    updatedAt,
  };
  p.brouillon.siteActifId = p.sites[0]?.id ?? p.brouillon.siteActifId;
  return p;
}

function parseProjetV3(o: Record<string, unknown>): RapportActiviteProjet | null {
  const migrated = migrateProjetV2(o);
  if (!migrated) return null;
  const clientNom =
    typeof o.clientNom === "string" ? String(o.clientNom) : migrated.clientNom;
  let domaines = migrated.domaines;
  if (Array.isArray(o.domaines)) {
    const d: RapportDomaineDef[] = [];
    for (const x of o.domaines) {
      if (!x || typeof x !== "object") continue;
      const r = x as Record<string, unknown>;
      const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : "";
      const label =
        typeof r.label === "string" && r.label.trim() ? r.label.trim() : id;
      if (id) d.push({ id, label });
    }
    if (d.length) domaines = d;
  }
  let colonnesTableau = migrated.colonnesTableau;
  if (Array.isArray(o.colonnesTableau)) {
    const c: RapportColonneTableau[] = [];
    for (const x of o.colonnesTableau) {
      if (!x || typeof x !== "object") continue;
      const r = x as Record<string, unknown>;
      const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : "";
      const label =
        typeof r.label === "string" && r.label.trim() ? r.label.trim() : id;
      if (id) c.push({ id, label });
    }
    if (c.length) colonnesTableau = c;
  }
  const piedPagePdf =
    typeof o.piedPagePdf === "string" ? o.piedPagePdf : migrated.piedPagePdf;
  const dernierePageMessage =
    typeof o.dernierePageMessage === "string"
      ? o.dernierePageMessage
      : migrated.dernierePageMessage;
  let brouillon = migrated.brouillon;
  if (o.brouillon && typeof o.brouillon === "object") {
    const br = o.brouillon as Record<string, unknown>;
    const merged = { ...brouillon };
    if (typeof br.typeRapport === "string") merged.typeRapport = br.typeRapport as RapportBrouillonState["typeRapport"];
    if (typeof br.titreDocument === "string") merged.titreDocument = br.titreDocument;
    if (typeof br.dateRapport === "string") merged.dateRapport = br.dateRapport;
    if (typeof br.moisCle === "string") merged.moisCle = br.moisCle;
    if (typeof br.syntheseGlobale === "string") merged.syntheseGlobale = br.syntheseGlobale;
    if (typeof br.siteActifId === "string") merged.siteActifId = br.siteActifId;
    if (br.visuels && typeof br.visuels === "object") {
      const v = br.visuels as Record<string, unknown>;
      merged.visuels = {
        logoPrincipal: typeof v.logoPrincipal === "string" ? v.logoPrincipal : merged.visuels.logoPrincipal,
        logoClient: typeof v.logoClient === "string" ? v.logoClient : merged.visuels.logoClient,
        couverture: typeof v.couverture === "string" ? v.couverture : merged.visuels.couverture,
        photosParSite:
          v.photosParSite && typeof v.photosParSite === "object" && !Array.isArray(v.photosParSite)
            ? (v.photosParSite as Record<string, string[]>)
            : merged.visuels.photosParSite,
      };
    }
    if (br.parSite && typeof br.parSite === "object" && !Array.isArray(br.parSite)) {
      merged.parSite = br.parSite as RapportBrouillonState["parSite"];
    }
    brouillon = merged;
    if (!migrated.sites.some((s) => s.id === brouillon.siteActifId)) {
      brouillon.siteActifId = migrated.sites[0]?.id ?? brouillon.siteActifId;
    }
  }
  const statut: RapportActiviteProjetStatut =
    o.statut === "archive" || o.statut === "termine" ? "archive" : "actif";
  return {
    ...migrated,
    statut,
    clientNom,
    domaines,
    colonnesTableau,
    piedPagePdf,
    dernierePageMessage,
    brouillon,
  };
}

function readProjetsBrut(): RapportActiviteProjet[] {
  const rawV3 = localStorage.getItem(PROJETS_V3);
  if (rawV3) {
    try {
      const arr = JSON.parse(rawV3) as unknown;
      if (!Array.isArray(arr)) return [];
      return arr
        .map((x) =>
          x && typeof x === "object" ? parseProjetV3(x as Record<string, unknown>) : null,
        )
        .filter((x): x is RapportActiviteProjet => x !== null);
    } catch {
      return [];
    }
  }
  const rawV2 = localStorage.getItem(PROJETS_V2);
  if (!rawV2) return [];
  try {
    const arr = JSON.parse(rawV2) as unknown;
    if (!Array.isArray(arr)) return [];
    const migrated = arr
      .map((x) =>
        x && typeof x === "object"
          ? migrateProjetV2(x as Record<string, unknown>)
          : null,
      )
      .filter((x): x is RapportActiviteProjet => x !== null);
    if (migrated.length) {
      localStorage.setItem(PROJETS_V3, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return [];
  }
}

function writeProjets(list: RapportActiviteProjet[]): void {
  localStorage.setItem(PROJETS_V3, JSON.stringify(list));
}

function readRapportsBrut(): RapportActiviteFiche[] {
  void readProjetsBrut();
  const rawV3 = localStorage.getItem(RAPPORTS_V3);
  if (rawV3) {
    try {
      const arr = JSON.parse(rawV3) as unknown;
      if (!Array.isArray(arr)) return [];
      return arr.map(normalizeFiche).filter((x): x is RapportActiviteFiche => x !== null);
    } catch {
      return [];
    }
  }
  const rawV2 = localStorage.getItem(RAPPORTS_V2);
  if (!rawV2) return [];
  try {
    const arr = JSON.parse(rawV2) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: RapportActiviteFiche[] = [];
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
      const projetId =
        typeof o.projetId === "string" && o.projetId.trim() ? o.projetId.trim() : "";
      if (!id || !projetId) continue;
      const now = new Date().toISOString();
      const p = getProjetRapportActivite(projetId);
      if (!p) continue;
      const titre = typeof o.titre === "string" ? o.titre.trim() : "Rapport";
      const createdAt =
        typeof o.createdAt === "string" && o.createdAt.trim()
          ? o.createdAt.trim()
          : now;
      const updatedAt =
        typeof o.updatedAt === "string" && o.updatedAt.trim()
          ? o.updatedAt.trim()
          : now;
      out.push({
        id,
        projetId,
        typeRapport: "simple",
        titreDocument: titre,
        dateRapport: createdAt.slice(0, 10),
        titre,
        statut: "valide",
        payload: brouillonVidePourProjet(p),
        createdAt,
        updatedAt,
      });
    }
    if (out.length) localStorage.setItem(RAPPORTS_V3, JSON.stringify(out));
    return out;
  } catch {
    return [];
  }
}

function normalizeFiche(raw: unknown): RapportActiviteFiche | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
  const projetId =
    typeof o.projetId === "string" && o.projetId.trim() ? o.projetId.trim() : "";
  if (!id || !projetId) return null;
  const typeRapport =
    o.typeRapport === "quotidien" ||
    o.typeRapport === "mensuel" ||
    o.typeRapport === "fin_mission"
      ? o.typeRapport
      : ("simple" as const);
  const titreDocument =
    typeof o.titreDocument === "string" && o.titreDocument.trim()
      ? o.titreDocument.trim()
      : typeof o.titre === "string" && o.titre.trim()
        ? o.titre.trim()
        : "Rapport";
  const dateRapport =
    typeof o.dateRapport === "string" && o.dateRapport.trim()
      ? o.dateRapport.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const moisCle =
    typeof o.moisCle === "string" && o.moisCle.trim()
      ? o.moisCle.trim().slice(0, 7)
      : undefined;
  const titre = typeof o.titre === "string" && o.titre.trim() ? o.titre.trim() : titreDocument;
  const createdAt =
    typeof o.createdAt === "string" && o.createdAt.trim()
      ? o.createdAt.trim()
      : new Date().toISOString();
  const updatedAt =
    typeof o.updatedAt === "string" && o.updatedAt.trim()
      ? o.updatedAt.trim()
      : createdAt;
  const projet = getProjetRapportActivite(projetId);
  const payload =
    o.payload && typeof o.payload === "object"
      ? (o.payload as RapportBrouillonState)
      : projet
        ? brouillonVidePourProjet(projet)
        : brouillonVidePourProjet({
            sites: [{ id: "x", nom: "Site" }],
            domaines: cloneDomainesDefaut(),
          });
  return {
    id,
    projetId,
    typeRapport,
    titreDocument,
    dateRapport,
    moisCle,
    titre,
    statut: "valide",
    payload,
    createdAt,
    updatedAt,
  };
}

function writeRapports(list: RapportActiviteFiche[]): void {
  localStorage.setItem(RAPPORTS_V3, JSON.stringify(list));
}

export function listerProjetsRapportActivite(): RapportActiviteProjet[] {
  return readProjetsBrut();
}

export function getProjetRapportActivite(
  id: string,
): RapportActiviteProjet | undefined {
  const pid = id.trim();
  return readProjetsBrut().find((p) => p.id === pid);
}

export function sauvegarderProjetRapportActivite(
  projet: RapportActiviteProjet,
): void {
  const now = new Date().toISOString();
  const liste = readProjetsBrut();
  const idx = liste.findIndex((p) => p.id === projet.id);
  const row: RapportActiviteProjet = {
    ...projet,
    updatedAt: now,
    createdAt: idx >= 0 ? liste[idx]!.createdAt : projet.createdAt || now,
  };
  if (idx >= 0) liste[idx] = row;
  else liste.push(row);
  writeProjets(liste);
}

export function creerProjetRapportActivite(input: {
  titre: string;
  nombreSites: number;
}): RapportActiviteProjet {
  const now = new Date().toISOString();
  const titre = input.titre.trim() || "Nouveau projet";
  const n = Math.max(1, Math.min(50, Math.floor(Number(input.nombreSites)) || 1));
  const sites = Array.from({ length: n }, (_, i) => ({
    id: newId(),
    nom: `Site ${i + 1}`,
  }));
  const domaines = cloneDomainesDefaut();
  const colonnesTableau = cloneColonnesDefaut();
  const p: RapportActiviteProjet = {
    id: newId(),
    titre,
    sites,
    statut: "actif",
    clientNom: "",
    domaines,
    colonnesTableau,
    piedPagePdf: "",
    dernierePageMessage: "",
    brouillon: brouillonVidePourProjet({ sites, domaines }),
    createdAt: now,
    updatedAt: now,
  };
  p.brouillon.titreDocument = `Rapport d’activité — ${titre}`;
  sauvegarderProjetRapportActivite(p);
  return p;
}

export function archiverProjet(id: string): void {
  const p = getProjetRapportActivite(id);
  if (!p) return;
  sauvegarderProjetRapportActivite({ ...p, statut: "archive" });
}

export function desarchiverProjet(id: string): void {
  const p = getProjetRapportActivite(id);
  if (!p) return;
  sauvegarderProjetRapportActivite({ ...p, statut: "actif" });
}

export function supprimerProjetDefinitif(id: string): void {
  const pid = id.trim();
  const liste = readProjetsBrut().filter((p) => p.id !== pid);
  writeProjets(liste);
  const rapports = readRapportsBrut().filter((r) => r.projetId !== pid);
  writeRapports(rapports);
}

export function listerRapportsRapportActivite(): RapportActiviteFiche[] {
  return readRapportsBrut();
}

export function listerRapportsPourProjet(projetId: string): RapportActiviteFiche[] {
  const pid = projetId.trim();
  return readRapportsBrut()
    .filter((r) => r.projetId === pid)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function supprimerRapportFiche(id: string): void {
  const liste = readRapportsBrut().filter((r) => r.id !== id.trim());
  writeRapports(liste);
}

/** Met à jour le contenu d’un rapport déjà validé (même id, liste des rapports). */
export function miseAJourRapportFiche(
  ficheId: string,
  payload: RapportBrouillonState,
): boolean {
  const liste = readRapportsBrut();
  const fid = ficheId.trim();
  const idx = liste.findIndex((r) => r.id === fid);
  if (idx < 0) return false;
  const r = liste[idx]!;
  const now = new Date().toISOString();
  const td = payload.titreDocument?.trim() || r.titreDocument;
  const dr = payload.dateRapport?.slice(0, 10) || r.dateRapport;
  const typeRapport: TypeRapportActivite =
    payload.typeRapport === "quotidien" ||
    payload.typeRapport === "mensuel" ||
    payload.typeRapport === "fin_mission"
      ? payload.typeRapport
      : "simple";
  const titre = `${td} — ${dr}`;
  liste[idx] = {
    ...r,
    typeRapport,
    titreDocument: td,
    dateRapport: dr,
    moisCle:
      payload.moisCle && String(payload.moisCle).trim()
        ? String(payload.moisCle).trim().slice(0, 7)
        : undefined,
    titre,
    payload: JSON.parse(JSON.stringify(payload)) as RapportBrouillonState,
    updatedAt: now,
  };
  writeRapports(liste);
  return true;
}

export function compterRapportsPourProjet(projetId: string): number {
  return listerRapportsPourProjet(projetId).length;
}

export function enregistrerRapportValide(
  projetId: string,
  brouillon: RapportBrouillonState,
  titreListe?: string,
): RapportActiviteFiche {
  const now = new Date().toISOString();
  const liste = readRapportsBrut();
  const id = newId();
  const titre =
    titreListe?.trim() ||
    `${brouillon.titreDocument} — ${brouillon.dateRapport}`;
  const row: RapportActiviteFiche = {
    id,
    projetId: projetId.trim(),
    typeRapport: brouillon.typeRapport,
    titreDocument: brouillon.titreDocument.trim() || "Rapport",
    dateRapport: brouillon.dateRapport.slice(0, 10),
    moisCle: brouillon.moisCle?.slice(0, 7),
    titre,
    statut: "valide",
    payload: JSON.parse(JSON.stringify(brouillon)) as RapportBrouillonState,
    createdAt: now,
    updatedAt: now,
  };
  liste.push(row);
  writeRapports(liste);
  const p = getProjetRapportActivite(projetId);
  if (p) {
    const fresh = brouillonVidePourProjet(p);
    sauvegarderProjetRapportActivite({
      ...p,
      brouillon: {
        ...fresh,
        titreDocument: p.titre,
        typeRapport: "simple",
      },
    });
  }
  return row;
}

export function sauvegarderBrouillonProjet(
  projetId: string,
  brouillon: RapportBrouillonState,
): void {
  const p = getProjetRapportActivite(projetId);
  if (!p) return;
  sauvegarderProjetRapportActivite({
    ...p,
    brouillon: JSON.parse(JSON.stringify(brouillon)) as RapportBrouillonState,
  });
}

export function appliquerPrefillType(
  projetId: string,
  cible: Pick<
    RapportBrouillonState,
    "typeRapport" | "dateRapport" | "moisCle" | "titreDocument"
  >,
): RapportBrouillonState | null {
  const p = getProjetRapportActivite(projetId);
  if (!p) return null;
  const fiches = readRapportsBrut();
  return brouillonPrefillDepuisType(p, fiches, cible);
}

export function projetsActifsRapportActivite(): RapportActiviteProjet[] {
  return readProjetsBrut()
    .filter((p) => p.statut === "actif")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function projetsArchivesRapportActivite(): RapportActiviteProjet[] {
  return readProjetsBrut()
    .filter((p) => p.statut === "archive")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** @deprecated utiliser projetsActifsRapportActivite */
export function projetsEnCoursRapportActivite(): RapportActiviteProjet[] {
  return projetsActifsRapportActivite();
}

export function statsRapportActiviteAccueil(): {
  nbProjets: number;
  nbRapports: number;
  nbSites: number;
} {
  const projets = readProjetsBrut().filter((p) => p.statut === "actif");
  const rapports = readRapportsBrut();
  const nbSites = projets.reduce((n, p) => n + p.sites.length, 0);
  return {
    nbProjets: projets.length,
    nbRapports: rapports.length,
    nbSites,
  };
}

/** Compat : ancienne API */
export function enregistrerFicheRapportActivite(
  data: Omit<RapportActiviteFiche, "statut" | "payload"> & {
    payload?: RapportBrouillonState;
  },
): RapportActiviteFiche {
  const p = getProjetRapportActivite(data.projetId);
  const payload =
    data.payload ??
    (p ? brouillonVidePourProjet(p) : brouillonVidePourProjet({
      sites: [{ id: "x", nom: "Site" }],
      domaines: cloneDomainesDefaut(),
    }));
  const now = new Date().toISOString();
  const liste = readRapportsBrut();
  const id = data.id?.trim() || newId();
  const idx = liste.findIndex((r) => r.id === id);
  const row: RapportActiviteFiche = {
    id,
    projetId: data.projetId.trim(),
    typeRapport: data.typeRapport ?? "simple",
    titreDocument: data.titreDocument?.trim() || data.titre.trim() || "Rapport",
    dateRapport: data.dateRapport?.slice(0, 10) ?? now.slice(0, 10),
    moisCle: data.moisCle,
    titre: data.titre.trim() || "Rapport",
    statut: "valide",
    payload,
    createdAt: idx >= 0 ? liste[idx]!.createdAt : now,
    updatedAt: now,
  };
  if (idx >= 0) liste[idx] = row;
  else liste.push(row);
  writeRapports(liste);
  return row;
}
