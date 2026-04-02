import {
  type AxeContenu,
  type RapportDomaineDef,
  axesContenuVidesPourDomaines,
  axesVidesPourDomaines,
  resoudreIdDomaine,
} from "../data/rapportParkingDomains";
import {
  getDomainesPourProjetOuDefaut,
  getOrCreateLegacyProjetId,
  getProjetById,
} from "./rapportProjetStorage";
import {
  createDefaultTableauLignes,
  fusionnerTableauSuiviPourSite,
  getColonnesTableauSuiviProjet,
  normalizeTableauSuiviContenu,
  type TableauSuiviColonne,
  type TableauSuiviContenu,
} from "./tableauSuivi";

export type ModeRapportChain = "quotidien" | "mensuel" | "fin_mission";

const STORAGE_KEY = "tk-gestion-rapports-chain-v1";

export type ContenuSiteRapport = {
  siteId: string;
  axes: Record<string, AxeContenu>;
  tableauSuivi?: TableauSuiviContenu;
};

export type RapportEnregistre = {
  id: string;
  projetId: string;
  mode: ModeRapportChain;
  titre: string;
  jourDate?: string;
  moisCle?: string;
  missionDebut?: string;
  missionFin?: string;
  clientNom?: string;
  referenceMission?: string;
  contenuParSite: ContenuSiteRapport[];
  axes: Record<string, string>;
  observations: string;
  createdAt: string;
  updatedAt: string;
  sourceIds?: string[];
  /**
   * Rapport mensuel : clés `clePhotoQuotidienMensuel` des photos quotidiennes à inclure dans le PDF.
   * Absent = toutes les photos du mois sont incluses (comportement par défaut).
   */
  photosMensuelSelection?: string[];
  /** Si `false`, le tableau de suivi n’apparaît pas dans le PDF (défaut : inclus). */
  inclureTableauSuiviPdf?: boolean;
};

function newId() {
  return crypto.randomUUID();
}

function normalizeAxeContenuRaw(v: unknown): AxeContenu {
  if (v && typeof v === "object" && v !== null && "texte" in v) {
    const o = v as Record<string, unknown>;
    const photoDataUrl =
      typeof o.photoDataUrl === "string" && o.photoDataUrl.startsWith("data:")
        ? o.photoDataUrl
        : undefined;
    return {
      texte: typeof o.texte === "string" ? o.texte : "",
      photoDataUrl,
    };
  }
  if (typeof v === "string") return { texte: v };
  return { texte: "" };
}

function normalizeAxes(
  raw: unknown,
  domaines: RapportDomaineDef[],
): Record<string, string> {
  const out = axesVidesPourDomaines(domaines);
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const id = resoudreIdDomaine(key, domaines);
    if (!id) continue;
    out[id] = typeof o[key] === "string" ? o[key] : "";
  }
  return out;
}

function contenuBlocLegacy(
  legacyAxes: Record<string, string>,
  domaines: RapportDomaineDef[],
): ContenuSiteRapport {
  return {
    siteId: "__legacy__",
    axes: Object.fromEntries(
      domaines.map((d) => [
        d.id,
        { texte: legacyAxes[d.id] ?? "" },
      ]),
    ) as Record<string, AxeContenu>,
  };
}

function normalizeContenuParSiteRaw(
  raw: unknown,
  legacyAxes: Record<string, string>,
  domaines: RapportDomaineDef[],
  colonnesTableau: TableauSuiviColonne[],
): ContenuSiteRapport[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [contenuBlocLegacy(legacyAxes, domaines)];
  }
  const out: ContenuSiteRapport[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const siteId = typeof o.siteId === "string" && o.siteId.trim() ? o.siteId : "__legacy__";
    const axes = axesContenuVidesPourDomaines(domaines);
    const axesRaw = o.axes;
    if (axesRaw && typeof axesRaw === "object") {
      const ax = axesRaw as Record<string, unknown>;
      for (const key of Object.keys(ax)) {
        const id = resoudreIdDomaine(key, domaines);
        if (!id) continue;
        axes[id] = normalizeAxeContenuRaw(ax[key]);
      }
    }
    const tsRaw = o.tableauSuivi;
    const tableauSuivi =
      tsRaw !== undefined && tsRaw !== null
        ? normalizeTableauSuiviContenu(tsRaw, colonnesTableau)
        : undefined;
    out.push({
      siteId,
      axes,
      ...(tableauSuivi ? { tableauSuivi } : {}),
    });
  }
  return out.length ? out : [contenuBlocLegacy(legacyAxes, domaines)];
}

export function aplatirAxesPourCompat(
  sites: ContenuSiteRapport[],
  domaines: RapportDomaineDef[],
): Record<string, string> {
  const out = axesVidesPourDomaines(domaines);
  for (const d of domaines) {
    const parts = sites
      .map((s) => (s.axes[d.id]?.texte ?? "").trim())
      .filter(Boolean);
    out[d.id] = parts.join("\n\n—\n\n");
  }
  return out;
}

function fusionnerAxesVersDomaines(
  prev: Record<string, AxeContenu>,
  empty: Record<string, AxeContenu>,
  domaines: RapportDomaineDef[],
): Record<string, AxeContenu> {
  const out: Record<string, AxeContenu> = { ...empty };
  for (const d of domaines) {
    const cur = prev[d.id];
    if (cur) {
      out[d.id] = {
        texte: cur.texte ?? "",
        photoDataUrl: cur.photoDataUrl,
      };
    }
  }
  return out;
}

/** Remplace `__legacy__` et ajoute les sites manquants ; réaligne les clés sur les domaines du projet. */
export function alignerContenuAvecProjetSites(
  raw: ContenuSiteRapport[],
  sitesProjet: { id: string }[],
  domaines: RapportDomaineDef[],
  colonnesTableau: TableauSuiviColonne[],
): ContenuSiteRapport[] {
  const empty = axesContenuVidesPourDomaines(domaines);
  if (
    raw.length === 1 &&
    raw[0].siteId === "__legacy__" &&
    sitesProjet.length >= 1
  ) {
    const leg = raw[0];
    const tableauSuivi = leg.tableauSuivi
      ? normalizeTableauSuiviContenu(leg.tableauSuivi, colonnesTableau)
      : { lignes: createDefaultTableauLignes(colonnesTableau) };
    return [
      {
        siteId: sitesProjet[0].id,
        axes: fusionnerAxesVersDomaines(leg.axes, empty, domaines),
        tableauSuivi,
      },
    ];
  }
  const byId = new Map(raw.map((c) => [c.siteId, c]));
  return sitesProjet.map((s) => {
    const existing = byId.get(s.id);
    const axes = existing
      ? fusionnerAxesVersDomaines(existing.axes, empty, domaines)
      : { ...empty };
    const tableauSuivi = existing?.tableauSuivi
      ? normalizeTableauSuiviContenu(existing.tableauSuivi, colonnesTableau)
      : { lignes: createDefaultTableauLignes(colonnesTableau) };
    return { siteId: s.id, axes, tableauSuivi };
  });
}

function normalizeRapport(raw: unknown): RapportEnregistre | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const mode = r.mode;
  const titreBrut = typeof r.titre === "string" ? r.titre : "";
  if (!id || (mode !== "quotidien" && mode !== "mensuel" && mode !== "fin_mission")) {
    return null;
  }
  const titre = titreBrut.trim() || "Rapport";
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : createdAt;
  const sourceIds = Array.isArray(r.sourceIds)
    ? r.sourceIds.filter((x): x is string => typeof x === "string")
    : undefined;
  const photosMensuelSelection = Array.isArray(r.photosMensuelSelection)
    ? r.photosMensuelSelection.filter((x): x is string => typeof x === "string")
    : undefined;
  const projetId =
    typeof r.projetId === "string" && r.projetId.trim()
      ? r.projetId
      : getOrCreateLegacyProjetId();
  const domaines = getDomainesPourProjetOuDefaut(projetId);
  const colonnesTs = getColonnesTableauSuiviProjet(getProjetById(projetId));
  const legacyAxes = normalizeAxes(r.axes, domaines);
  const contenuParSite = normalizeContenuParSiteRaw(
    r.contenuParSite,
    legacyAxes,
    domaines,
    colonnesTs,
  );
  const axes = aplatirAxesPourCompat(contenuParSite, domaines);
  const inclureTableauSuiviPdf =
    r.inclureTableauSuiviPdf === false ? false : true;
  return {
    id,
    projetId,
    mode,
    titre,
    jourDate: typeof r.jourDate === "string" ? r.jourDate : undefined,
    moisCle: typeof r.moisCle === "string" ? r.moisCle : undefined,
    missionDebut: typeof r.missionDebut === "string" ? r.missionDebut : undefined,
    missionFin: typeof r.missionFin === "string" ? r.missionFin : undefined,
    clientNom: typeof r.clientNom === "string" ? r.clientNom : undefined,
    referenceMission: typeof r.referenceMission === "string" ? r.referenceMission : undefined,
    contenuParSite,
    axes,
    observations: typeof r.observations === "string" ? r.observations : "",
    createdAt,
    updatedAt,
    sourceIds,
    photosMensuelSelection,
    inclureTableauSuiviPdf,
  };
}

function migrerProjetIdDansStockageBrut() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return;
    const legacy = getOrCreateLegacyProjetId();
    let changed = false;
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      if (typeof o.projetId !== "string" || !String(o.projetId).trim()) {
        o.projetId = legacy;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function chargerRapportsEnregistres(): RapportEnregistre[] {
  try {
    migrerProjetIdDansStockageBrut();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeRapport).filter((x): x is RapportEnregistre => x !== null);
  } catch {
    return [];
  }
}

function enregistrerListe(rapports: RapportEnregistre[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rapports));
}

export function supprimerRapportEnregistre(id: string) {
  const liste = chargerRapportsEnregistres().filter((r) => r.id !== id);
  enregistrerListe(liste);
}

/** Ajoute des rapports en fin de stockage (import projet, sans déduplication). */
export function ajouterRapportsEnFin(rapports: RapportEnregistre[]): void {
  if (!rapports.length) return;
  const liste = chargerRapportsEnregistres();
  liste.push(...rapports);
  enregistrerListe(liste);
}

export function supprimerRapportsPourProjet(projetId: string) {
  const liste = chargerRapportsEnregistres().filter((r) => r.projetId !== projetId);
  enregistrerListe(liste);
}

export function compterRapportsPourProjet(projetId: string): number {
  return chargerRapportsEnregistres().filter((r) => r.projetId === projetId).length;
}

function cleNaturelle(
  r: Pick<
    RapportEnregistre,
    | "mode"
    | "jourDate"
    | "moisCle"
    | "missionDebut"
    | "missionFin"
    | "clientNom"
    | "referenceMission"
  >,
): string {
  if (r.mode === "quotidien" && r.jourDate) return `q:${r.jourDate}`;
  if (r.mode === "mensuel" && r.moisCle) return `m:${r.moisCle}`;
  if (r.mode === "fin_mission" && r.missionDebut && r.missionFin) {
    const c = (r.clientNom ?? "").trim() || (r.referenceMission ?? "").trim() || "_";
    return `f:${c}:${r.missionDebut}:${r.missionFin}`;
  }
  return `u:${newId()}`;
}

export function sauvegarderRapport(
  data: Omit<
    RapportEnregistre,
    "id" | "createdAt" | "updatedAt" | "axes" | "inclureTableauSuiviPdf"
  > & {
    id?: string;
    inclureTableauSuiviPdf?: boolean;
  },
): RapportEnregistre {
  const now = new Date().toISOString();
  const liste = chargerRapportsEnregistres();
  const pourCle: Omit<
    RapportEnregistre,
    "id" | "titre" | "createdAt" | "updatedAt" | "axes" | "observations" | "contenuParSite"
  > & {
    titre: string;
    contenuParSite: ContenuSiteRapport[];
    observations: string;
  } = {
    projetId: data.projetId,
    mode: data.mode,
    titre: data.titre,
    jourDate: data.jourDate,
    moisCle: data.moisCle,
    missionDebut: data.missionDebut,
    missionFin: data.missionFin,
    clientNom: data.clientNom,
    referenceMission: data.referenceMission,
    contenuParSite: data.contenuParSite,
    observations: data.observations,
    sourceIds: data.sourceIds,
    photosMensuelSelection: data.photosMensuelSelection,
  };
  const cle = cleNaturelle(pourCle);

  let id = data.id;
  if (!id) {
    const existant = liste.find(
      (x) =>
        x.projetId === data.projetId &&
        cleNaturelle(x) === cle &&
        x.mode === data.mode,
    );
    id = existant?.id ?? newId();
  }

  const idx = liste.findIndex((x) => x.id === id);
  const createdAt = idx >= 0 ? liste[idx].createdAt : now;
  const domaines = getDomainesPourProjetOuDefaut(data.projetId);
  const row: RapportEnregistre = {
    id,
    projetId: data.projetId,
    mode: data.mode,
    titre: data.titre.trim() || "Rapport",
    jourDate: data.jourDate,
    moisCle: data.moisCle,
    missionDebut: data.missionDebut,
    missionFin: data.missionFin,
    clientNom: data.clientNom,
    referenceMission: data.referenceMission,
    contenuParSite: data.contenuParSite,
    axes: aplatirAxesPourCompat(data.contenuParSite, domaines),
    observations: data.observations,
    sourceIds: data.sourceIds,
    photosMensuelSelection: data.photosMensuelSelection,
    createdAt,
    updatedAt: now,
    ...(data.inclureTableauSuiviPdf === false
      ? { inclureTableauSuiviPdf: false as const }
      : {}),
  };

  if (idx >= 0) liste[idx] = row;
  else liste.push(row);
  enregistrerListe(liste);
  return row;
}

export function libelleMoisCleFr(moisCle: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(moisCle.trim());
  if (!m) return moisCle;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, mo - 1, 1));
}

export function libelleJourFr(jourISO: string): string {
  const b = /^\d{4}-\d{2}-\d{2}$/.test(jourISO.trim())
    ? new Date(jourISO + "T12:00:00")
    : new Date(jourISO);
  if (Number.isNaN(b.getTime())) return jourISO;
  return b.toLocaleDateString("fr-FR");
}

export function listerQuotidiensPourMoisCle(
  moisCle: string,
  projetId: string,
): RapportEnregistre[] {
  const pid = projetId.trim();
  return chargerRapportsEnregistres()
    .filter(
      (r) =>
        r.projetId === pid &&
        r.mode === "quotidien" &&
        r.jourDate &&
        r.jourDate.startsWith(moisCle),
    )
    .sort((a, b) => (a.jourDate ?? "").localeCompare(b.jourDate ?? ""));
}

export function listerMensuelsPourPeriodeMission(
  missionDebutISO: string,
  missionFinISO: string,
  projetId: string,
): RapportEnregistre[] {
  const min = missionDebutISO.trim().slice(0, 7);
  const max = missionFinISO.trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(min) || !/^\d{4}-\d{2}$/.test(max)) return [];
  const pid = projetId.trim();
  return chargerRapportsEnregistres()
    .filter(
      (r) =>
        r.projetId === pid &&
        r.mode === "mensuel" &&
        r.moisCle &&
        r.moisCle >= min &&
        r.moisCle <= max,
    )
    .sort((a, b) => (a.moisCle ?? "").localeCompare(b.moisCle ?? ""));
}

function ordreSitesDepuisRapports(rapports: RapportEnregistre[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const r of rapports) {
    for (const c of r.contenuParSite) {
      if (!seen.has(c.siteId)) {
        seen.add(c.siteId);
        order.push(c.siteId);
      }
    }
  }
  return order;
}

export function fusionnerContenuParSiteDepuisRapports(
  rapports: RapportEnregistre[],
  libelleSource: (r: RapportEnregistre) => string,
  siteIdsOrdered: string[] | undefined,
  domaines: RapportDomaineDef[],
  colonnesTableau: TableauSuiviColonne[],
): ContenuSiteRapport[] {
  const explicit =
    Array.isArray(siteIdsOrdered) && siteIdsOrdered.some((s) => s && String(s).trim());
  const order = explicit ? siteIdsOrdered! : ordreSitesDepuisRapports(rapports);
  if (order.length === 0) {
    return [
      {
        siteId: "__legacy__",
        axes: axesContenuVidesPourDomaines(domaines),
        tableauSuivi: { lignes: createDefaultTableauLignes(colonnesTableau) },
      },
    ];
  }
  return order.map((siteId) => {
    const axes = axesContenuVidesPourDomaines(domaines);
    for (const d of domaines) {
      const parts: string[] = [];
      for (const r of rapports) {
        const bloc = r.contenuParSite.find((c) => c.siteId === siteId);
        const t = (bloc?.axes[d.id]?.texte ?? "").trim();
        if (!t) continue;
        parts.push(`[${libelleSource(r)}]\n${t}`);
      }
      axes[d.id] = { texte: parts.join("\n\n") };
    }
    const tableauSuivi = fusionnerTableauSuiviPourSite(
      rapports,
      siteId,
      colonnesTableau,
      libelleSource,
    );
    return { siteId, axes, tableauSuivi };
  });
}

export function fusionnerAxesDepuisRapports(
  rapports: RapportEnregistre[],
  libelleSource: (r: RapportEnregistre) => string,
  siteIdsOrdered: string[] | undefined,
  domaines: RapportDomaineDef[],
  colonnesTableau?: TableauSuiviColonne[],
): Record<string, string> {
  const cols =
    colonnesTableau ??
    getColonnesTableauSuiviProjet(
      getProjetById(rapports[0]?.projetId?.trim() ?? "") ?? undefined,
    );
  return aplatirAxesPourCompat(
    fusionnerContenuParSiteDepuisRapports(
      rapports,
      libelleSource,
      siteIdsOrdered,
      domaines,
      cols,
    ),
    domaines,
  );
}

export function fusionnerObservationsDepuisRapports(
  rapports: RapportEnregistre[],
  libelleSource: (r: RapportEnregistre) => string,
): string {
  const parts: string[] = [];
  for (const r of rapports) {
    const o = r.observations.trim();
    if (!o) continue;
    parts.push(`— ${libelleSource(r)} —\n${o}`);
  }
  return parts.join("\n\n");
}

/** Clé stable pour une photo de rapport quotidien (site × domaine × jour). */
export function clePhotoQuotidienMensuel(
  rapportId: string,
  siteId: string,
  domainId: string,
): string {
  return `${rapportId}|${siteId}|${domainId}`;
}

export type PhotoQuotidienPourMensuel = {
  cle: string;
  rapportId: string;
  jourDate?: string;
  siteId: string;
  siteNom: string;
  domainId: string;
  domainLabel: string;
  photoDataUrl: string;
};

/** Photos présentes dans les rapports quotidiens donnés, groupables par domaine pour le mensuel. */
export function collecterPhotosQuotidiensPourMensuel(
  rapports: RapportEnregistre[],
  sitesProjet: { id: string; nom: string }[],
  domaines: RapportDomaineDef[],
): PhotoQuotidienPourMensuel[] {
  const siteNom = (id: string) =>
    sitesProjet.find((s) => s.id === id)?.nom?.trim() || id;
  const domLabel = (id: string) =>
    domaines.find((d) => d.id === id)?.label?.trim() || id;
  const out: PhotoQuotidienPourMensuel[] = [];
  for (const r of rapports) {
    if (r.mode !== "quotidien") continue;
    for (const c of r.contenuParSite) {
      for (const d of domaines) {
        const photo = c.axes[d.id]?.photoDataUrl?.trim();
        if (!photo || photo.length < 40) continue;
        out.push({
          cle: clePhotoQuotidienMensuel(r.id, c.siteId, d.id),
          rapportId: r.id,
          jourDate: r.jourDate,
          siteId: c.siteId,
          siteNom: siteNom(c.siteId),
          domainId: d.id,
          domainLabel: domLabel(d.id),
          photoDataUrl: photo,
        });
      }
    }
  }
  return out.sort((a, b) => {
    const jd = (a.jourDate ?? "").localeCompare(b.jourDate ?? "");
    if (jd !== 0) return jd;
    return a.cle.localeCompare(b.cle);
  });
}
