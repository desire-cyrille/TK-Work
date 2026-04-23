/** Types partagés du module Rapport d’activité. */

export type RapportActiviteProjetStatut = "actif" | "archive";

export type TypeRapportActivite =
  | "simple"
  | "quotidien"
  | "mensuel"
  | "fin_mission";

export type EtatTableauCarre = "vert" | "bleu" | "orange" | "noir" | "";

export type RapportActiviteSite = {
  id: string;
  nom: string;
};

export type RapportDomaineDef = {
  id: string;
  label: string;
};

export type RapportColonneTableau = {
  id: string;
  label: string;
};

export const COL_ETAT_ID = "etat";

export const DEFAULT_DOMAINES: RapportDomaineDef[] = [
  { id: "d-tech", label: "Technique" },
  { id: "d-mgt", label: "Management" },
  { id: "d-com", label: "Commercial" },
  { id: "d-infra", label: "Infrastructure" },
  { id: "d-proc", label: "Procédure" },
];

export const DEFAULT_COLONNES: RapportColonneTableau[] = [
  { id: "domaine", label: "Domaine" },
  { id: "sujet", label: "Sujet" },
  { id: "responsable", label: "Responsable" },
  { id: COL_ETAT_ID, label: "État" },
  { id: "observation", label: "Observation" },
  { id: "relances", label: "Suivi des relances" },
];

export type DomaineContenuRapport = {
  /** Nouvelle structure (préférée): un bloc = une information distincte. */
  infos?: string[];
  /** Compat ancienne structure (textarea unique). */
  texte?: string;
  photos: string[];
};

export type TableauLigneRapport = {
  id: string;
  domaineId: string;
  sujet: string;
  responsable: string;
  etat: EtatTableauCarre;
  observation: string;
  relances: string;
  extra: Record<string, string>;
};

export type SiteContenuRapport = {
  domainesTexte: Record<string, DomaineContenuRapport>;
  tableauLignes: TableauLigneRapport[];
};

export type VisuelsRapport = {
  logoPrincipal?: string;
  logoClient?: string;
  couverture?: string;
  /** Une ou plusieurs photos par site (aperçu / PDF). */
  photosParSite: Record<string, string[]>;
};

export type RapportBrouillonState = {
  typeRapport: TypeRapportActivite;
  titreDocument: string;
  /** Date du rapport affichée / utilisée (YYYY-MM-DD). */
  dateRapport: string;
  /** Pour mensuel : YYYY-MM ; fin de mission : début / fin optionnels dans l’UI plus tard. */
  moisCle?: string;
  visuels: VisuelsRapport;
  siteActifId: string;
  parSite: Record<string, SiteContenuRapport>;
  syntheseGlobale: string;
};

export type RapportActiviteProjet = {
  id: string;
  titre: string;
  sites: RapportActiviteSite[];
  statut: RapportActiviteProjetStatut;
  clientNom: string;
  domaines: RapportDomaineDef[];
  colonnesTableau: RapportColonneTableau[];
  piedPagePdf: string;
  dernierePageMessage: string;
  brouillon: RapportBrouillonState;
  createdAt: string;
  updatedAt: string;
};

export type RapportActiviteFiche = {
  id: string;
  projetId: string;
  typeRapport: TypeRapportActivite;
  titreDocument: string;
  dateRapport: string;
  moisCle?: string;
  titre: string;
  statut: "valide";
  payload: RapportBrouillonState;
  createdAt: string;
  updatedAt: string;
};

export function cloneDomainesDefaut(): RapportDomaineDef[] {
  return DEFAULT_DOMAINES.map((d) => ({ ...d }));
}

export function cloneColonnesDefaut(): RapportColonneTableau[] {
  return DEFAULT_COLONNES.map((c) => ({ ...c }));
}

export function domainesVidesContenu(
  domaines: RapportDomaineDef[],
): Record<string, DomaineContenuRapport> {
  return Object.fromEntries(
    domaines.map((d) => [d.id, { infos: [], texte: "", photos: [] }]),
  ) as Record<string, DomaineContenuRapport>;
}

export function nouvelleLigneTableau(
  domaines: RapportDomaineDef[],
): TableauLigneRapport {
  const dom0 = domaines[0]?.id ?? "";
  return {
    id: crypto.randomUUID(),
    domaineId: dom0,
    sujet: "",
    responsable: "",
    etat: "",
    observation: "",
    relances: "",
    extra: {},
  };
}

const AUTO_FROM_DOMAINE_KEY = "__auto_from_domaine";
const AUTO_FROM_DOMAINE_INDEX_KEY = "__auto_from_domaine_idx";

function splitInfosDomaine(texte: string): string[] {
  const raw = String(texte ?? "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  // Si l’utilisateur sépare ses infos par lignes vides, on découpe en blocs.
  const blocks = raw
    .split(/\n\s*\n+/g)
    .map((x) => x.trim())
    .filter(Boolean);
  if (blocks.length >= 2) return blocks.slice(0, 60);

  // Sinon, si ça ressemble à une liste (ex: "- ..."), on découpe par ligne non vide.
  const nonEmptyLines = raw
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const bulletLike = nonEmptyLines.filter((l) => /^[-•*]\s+/.test(l)).length;
  if (bulletLike >= 2) return nonEmptyLines.slice(0, 60);

  return [raw];
}

function normalizeInfosFromBloc(bloc: DomaineContenuRapport | undefined): string[] {
  const infos =
    bloc?.infos && Array.isArray(bloc.infos)
      ? bloc.infos.map((x) => String(x ?? "")).filter((x) => x.trim().length > 0)
      : [];
  if (infos.length) return infos.slice(0, 80);
  const legacy = String(bloc?.texte ?? "").trim();
  return legacy ? splitInfosDomaine(legacy).slice(0, 80) : [];
}

function isAutoLineFromDomaine(l: TableauLigneRapport, domId: string): boolean {
  return String(l.extra?.[AUTO_FROM_DOMAINE_KEY] ?? "") === domId;
}

function autoIdx(l: TableauLigneRapport): number {
  const n = Number(l.extra?.[AUTO_FROM_DOMAINE_INDEX_KEY] ?? "0");
  return Number.isFinite(n) ? n : 0;
}

/** Après saisie dans un domaine : recopie le texte vers la 1re ligne du tableau ayant ce domaine (sinon nouvelle ligne). */
export function appliquerTexteDomaineVersTableau(
  sc: SiteContenuRapport,
  domaines: RapportDomaineDef[],
  domId: string,
  texte: string,
): SiteContenuRapport {
  const prevBloc = sc.domainesTexte[domId] ?? { infos: [], texte: "", photos: [] };
  const domainesTexte = {
    ...sc.domainesTexte,
    [domId]: { ...prevBloc, texte },
  };
  const labelDom = domaines.find((d) => d.id === domId)?.label ?? "";
  const infos = normalizeInfosFromBloc(domainesTexte[domId]);

  const all = [...sc.tableauLignes];
  const manual = all.filter((l) => !(l.domaineId === domId && isAutoLineFromDomaine(l, domId)));
  const autos = all
    .filter((l) => l.domaineId === domId && isAutoLineFromDomaine(l, domId))
    .slice()
    .sort((a, b) => autoIdx(a) - autoIdx(b));

  const nextAutos: TableauLigneRapport[] = [];
  for (let i = 0; i < infos.length; i += 1) {
    const info = infos[i]!;
    const base = autos[i]
      ? { ...autos[i]! }
      : { ...nouvelleLigneTableau(domaines), domaineId: domId };
    base.observation = info;
    if (i === 0) {
      if (!base.sujet.trim() && labelDom) base.sujet = labelDom;
    } else {
      if (base.sujet.trim() === labelDom) base.sujet = "";
    }
    base.extra = {
      ...base.extra,
      [AUTO_FROM_DOMAINE_KEY]: domId,
      [AUTO_FROM_DOMAINE_INDEX_KEY]: String(i),
    };
    nextAutos.push(base);
  }

  return { ...sc, domainesTexte, tableauLignes: [...manual, ...nextAutos] };
}

/** Pour chaque domaine : met à jour la 1re ligne associée (observation = texte domaine) ou ajoute une ligne. */
export function synchroniserTableauAvecTousLesDomaines(
  sc: SiteContenuRapport,
  domaines: RapportDomaineDef[],
): SiteContenuRapport {
  let out = { ...sc };
  for (const dom of domaines) {
    const bloc = out.domainesTexte[dom.id];
    const legacy = String(bloc?.texte ?? "");
    out = appliquerTexteDomaineVersTableau(out, domaines, dom.id, legacy);
  }
  return out;
}

/** Domaine avec au moins un texte non vide ou une photo (même critère que l’export PDF). */
export function domaineSiteNonVide(
  sc: SiteContenuRapport | undefined,
  domaineId: string,
): boolean {
  if (!sc) return false;
  const b = sc.domainesTexte[domaineId];
  const infos = normalizeInfosFromBloc(b);
  return Boolean(infos.some((x) => x.trim()) || (b?.photos?.length ?? 0) > 0);
}

/**
 * Ligne du tableau à afficher (PDF / écran) : domaine non vide, ou saisie utile dans le suivi
 * (état, sujet, etc.) pour ne pas masquer une ligne entièrement remplie à la main.
 */
export function ligneTableauSuiviVisible(
  sc: SiteContenuRapport,
  ligne: TableauLigneRapport,
): boolean {
  if (domaineSiteNonVide(sc, ligne.domaineId)) return true;
  if (ligne.etat) return true;
  if (ligne.sujet.trim()) return true;
  if (ligne.responsable.trim()) return true;
  if (ligne.observation.trim()) return true;
  if (ligne.relances.trim()) return true;
  for (const v of Object.values(ligne.extra)) {
    if (String(v ?? "").trim()) return true;
  }
  return false;
}

export function contenuSiteVide(
  domaines: RapportDomaineDef[],
): SiteContenuRapport {
  return {
    domainesTexte: domainesVidesContenu(domaines),
    tableauLignes: [nouvelleLigneTableau(domaines)],
  };
}

/** Ajoute des blocs domaine vides pour les nouveaux ids (sans supprimer l’existant). */
export function enrichirBrouillonDomaines(
  b: RapportBrouillonState,
  domaines: RapportDomaineDef[],
): RapportBrouillonState {
  const parSite = { ...b.parSite };
  for (const sid of Object.keys(parSite)) {
    const sc = { ...parSite[sid]! };
    const dt = { ...sc.domainesTexte };
    for (const dom of domaines) {
      if (!dt[dom.id]) dt[dom.id] = { texte: "", photos: [] };
    }
    sc.domainesTexte = dt;
    parSite[sid] = sc;
  }
  return { ...b, parSite };
}

export function brouillonVidePourProjet(
  p: Pick<RapportActiviteProjet, "sites" | "domaines">,
): RapportBrouillonState {
  const today = new Date().toISOString().slice(0, 10);
  const firstSite = p.sites[0]?.id ?? "";
  const parSite: Record<string, SiteContenuRapport> = {};
  for (const s of p.sites) {
    parSite[s.id] = contenuSiteVide(p.domaines);
  }
  return {
    typeRapport: "simple",
    titreDocument: p.sites.length
      ? `Rapport d’activité — ${p.sites[0]?.nom ?? ""}`.trim()
      : "Rapport d’activité",
    dateRapport: today,
    moisCle: today.slice(0, 7),
    visuels: {
      photosParSite: Object.fromEntries(p.sites.map((s) => [s.id, []])),
    },
    siteActifId: firstSite,
    parSite,
    syntheseGlobale: "",
  };
}
