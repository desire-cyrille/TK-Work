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
  texte: string;
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
    domaines.map((d) => [d.id, { texte: "", photos: [] }]),
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

/** Après saisie dans un domaine : recopie le texte vers la 1re ligne du tableau ayant ce domaine (sinon nouvelle ligne). */
export function appliquerTexteDomaineVersTableau(
  sc: SiteContenuRapport,
  domaines: RapportDomaineDef[],
  domId: string,
  texte: string,
): SiteContenuRapport {
  const prevBloc = sc.domainesTexte[domId] ?? { texte: "", photos: [] };
  const domainesTexte = {
    ...sc.domainesTexte,
    [domId]: { ...prevBloc, texte },
  };
  const lines = [...sc.tableauLignes];
  const idx = lines.findIndex((l) => l.domaineId === domId);
  const labelDom = domaines.find((d) => d.id === domId)?.label ?? "";
  if (idx >= 0) {
    const L = { ...lines[idx]! };
    L.observation = texte;
    if (!L.sujet.trim() && labelDom) L.sujet = labelDom;
    lines[idx] = L;
  } else {
    const nl = nouvelleLigneTableau(domaines);
    lines.push({
      ...nl,
      domaineId: domId,
      sujet: labelDom,
      observation: texte,
    });
  }
  return { ...sc, domainesTexte, tableauLignes: lines };
}

/** Pour chaque domaine : met à jour la 1re ligne associée (observation = texte domaine) ou ajoute une ligne. */
export function synchroniserTableauAvecTousLesDomaines(
  sc: SiteContenuRapport,
  domaines: RapportDomaineDef[],
): SiteContenuRapport {
  const lines = [...sc.tableauLignes];
  for (const dom of domaines) {
    const texte = sc.domainesTexte[dom.id]?.texte ?? "";
    const idx = lines.findIndex((l) => l.domaineId === dom.id);
    if (idx >= 0) {
      const L = { ...lines[idx]! };
      L.observation = texte;
      if (!L.sujet.trim()) L.sujet = dom.label;
      lines[idx] = L;
    } else {
      const nl = nouvelleLigneTableau(domaines);
      lines.push({
        ...nl,
        domaineId: dom.id,
        sujet: dom.label,
        observation: texte,
      });
    }
  }
  return { ...sc, tableauLignes: lines };
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
