/** Modèle métier des devis (calculs type tableur Numbers / Excel). */

export type DevisZone = "idf" | "hors_idf";

export type UniteTemps = "heure" | "jour" | "semaine" | "mois";

export type LigneDeplacement = {
  id: string;
  libelle: string;
  nbPersonnes: number;
  distanceKm: number;
  /** Ex. nombre de jours ou semaines de facturation des déplacements (multiplicateur). */
  coefficientDuree: number;
};

export type DomaineDeplacement = {
  lignes: LigneDeplacement[];
};

export type LigneRestauration = {
  id: string;
  libelle: string;
  nbPersonnes: number;
  joursPresence: number;
  repasParJour: number;
  /** 0 = utiliser le prix par défaut de la zone */
  prixRepas: number;
};

export type DomaineRestauration = {
  lignes: LigneRestauration[];
};

export type LigneActionTemps = {
  id: string;
  libelle: string;
  quantite: number;
  unite: UniteTemps;
};

export type BlocActions = {
  id: string;
  titre: string;
  lignes: LigneActionTemps[];
};

export type DomaineActionsMultiples = {
  blocs: BlocActions[];
};

export type ModePermanence = "forfait_jours" | "par_semaine" | "horaire";

export type DomainePermanence = {
  mode: ModePermanence;
  tarifJour: number;
  tarifHeure: number;
  /** Mode forfait_jours */
  nombreJoursTotal: number;
  /** Mode par_semaine / horaire */
  nbSemaines: number;
  nbJoursParSemaine: number;
  nbHeuresParJour: number;
};

export type DevisDomainesActifs = {
  deplacement: boolean;
  restauration: boolean;
  preparationMiseEnPlace: boolean;
  miseEnPlaceTerrain: boolean;
  permanence: boolean;
};

export type DevisContenu = {
  titrePageGarde: string;
  sousTitrePageGarde: string;
  descriptionPrestation: string;
  texteConclusion: string;
  fraisGestionPourcent: number;
  domainesActifs: DevisDomainesActifs;
  deplacement: DomaineDeplacement;
  restauration: DomaineRestauration;
  preparationMiseEnPlace: DomaineActionsMultiples;
  miseEnPlaceTerrain: DomaineActionsMultiples;
  permanence: DomainePermanence;
};

export type DevisTheme = {
  /** Fond page de garde */
  gardeFond: [number, number, number];
  /** Texte principal page de garde */
  gardeTexte: [number, number, number];
  /** Bandeau / accents */
  accent: [number, number, number];
};

export type TarifsZone = {
  tarifKm: number;
  prixRepasDefaut: number;
  tarifHeure: number;
  tarifJour: number;
  tarifSemaine: number;
  tarifMois: number;
};

/** Texte du pied de page PDF (une ligne par ligne). */
export const PIED_PAGE_PDF_DEFAUT = [
  "TK PRO GESTION — 84 RUE VICTOR HUGO, 60160 MONTATAIRE",
  "SIRET 911 303 204 00018 — RCS COMPIÈGNE — APE 8211Z — TVA FR29 911 303 204",
  "RC Pro souscrite auprès de CRCAM BRIE PICARDIE",
].join("\n");

/** Client enregistré dans les paramètres (sélection lors de la création d’un devis). */
export type DevisClientFiche = {
  id: string;
  /** Personne physique : nom ; société : raison sociale */
  raisonOuNom: string;
  estSociete: boolean;
  adresse: string;
  siren: string;
  tva: string;
  /** Si société : nom du contact / interlocuteur */
  contact: string;
};

export type DevisParametresGlobaux = {
  idf: TarifsZone;
  horsIdf: TarifsZone;
  /** Data URL (PNG ou JPEG) affiché en haut à gauche sur chaque page du PDF. */
  logoPdfDataUrl?: string;
  /** Lignes du pied de page (séparées par des retours à la ligne). */
  piedPagePdf: string;
  /** Répertoire clients pour préremplir les devis. */
  clientsFiches: DevisClientFiche[];
};

export function newId(): string {
  return crypto.randomUUID();
}

export function tarifsZoneDefaut(): TarifsZone {
  return {
    tarifKm: 0.28,
    prixRepasDefaut: 12.5,
    tarifHeure: 26.35,
    tarifJour: 210.83,
    tarifSemaine: 1265,
    tarifMois: 4000,
  };
}

export function parametresGlobauxDefaut(): DevisParametresGlobaux {
  return {
    idf: tarifsZoneDefaut(),
    horsIdf: { ...tarifsZoneDefaut(), tarifKm: 0.35 },
    piedPagePdf: PIED_PAGE_PDF_DEFAUT,
    clientsFiches: [],
  };
}

const LIBELLES_ACTIONS_PREPARATION_DEFAUT: string[] = [
  "COMMANDE MAIN COURANTE WEB",
  "COMMANDE/STOCKAGE MATERIEL",
  "REUNION DE TRAVAIL",
  "ETUDE ET REALISATION DES PLANS DE RONDES POINTEES",
  "ETUDE DU MARCHE (CCTP / SIGNALITIQUE / REGLEMENT INTERIEUR / TARIFICATION)",
  "CREATION QUESTIONNAIRE CONTROL MASTER",
  "VISITE DIVERS / REPRESENTATION CLIENT",
];

const LIBELLES_ACTIONS_MISE_EN_PLACE_DEFAUT: string[] = [
  "CONFIGURATION / FORMATION MAIN COURANTE WEB",
  "MISE EN PLACE SUR SITES DES COMMANDES",
  "CREATION DES ACCES ET FORMATION CONTROLMASTER",
  "MISE EN PLACE / FORMATION RONDES POINTEES",
  "FORMATION / ACCOMPAGNEMENT DES AGENTS",
  "ORGANISATION / LOGISTIQUE DU SITE",
];

function lignesActionsDefaut(libelles: string[]): LigneActionTemps[] {
  return libelles.map((libelle) => ({
    id: newId(),
    libelle,
    quantite: 0,
    unite: "heure" as const,
  }));
}

export function themeDefaut(): DevisTheme {
  return {
    gardeFond: [30, 58, 95],
    gardeTexte: [255, 255, 255],
    accent: [26, 95, 180],
  };
}

export function domainesActifsDefaut(): DevisDomainesActifs {
  return {
    deplacement: true,
    restauration: true,
    preparationMiseEnPlace: true,
    miseEnPlaceTerrain: true,
    permanence: true,
  };
}

export function contenuDevisVide(): DevisContenu {
  return {
    titrePageGarde: "PROPOSITION",
    sousTitrePageGarde: "Prestations techniques",
    descriptionPrestation: "",
    texteConclusion: "Nous restons à votre disposition pour toute précision.",
    fraisGestionPourcent: 4,
    domainesActifs: domainesActifsDefaut(),
    deplacement: { lignes: [] },
    restauration: { lignes: [] },
    preparationMiseEnPlace: {
      blocs: [
        {
          id: newId(),
          titre: "Préparation de la mise en place",
          lignes: lignesActionsDefaut(LIBELLES_ACTIONS_PREPARATION_DEFAUT),
        },
      ],
    },
    miseEnPlaceTerrain: {
      blocs: [
        {
          id: newId(),
          titre: "Mise en place terrain",
          lignes: lignesActionsDefaut(LIBELLES_ACTIONS_MISE_EN_PLACE_DEFAUT),
        },
      ],
    },
    permanence: {
      mode: "par_semaine",
      tarifJour: 110,
      tarifHeure: 15.71,
      nombreJoursTotal: 0,
      nbSemaines: 1,
      nbJoursParSemaine: 5,
      nbHeuresParJour: 8,
    },
  };
}
