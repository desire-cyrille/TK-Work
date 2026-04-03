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

export type DevisParametresGlobaux = {
  idf: TarifsZone;
  horsIdf: TarifsZone;
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
  };
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

function blocVide(titre: string): BlocActions {
  return {
    id: newId(),
    titre,
    lignes: [],
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
        blocVide("Coordination & documents"),
        blocVide("Logistique"),
        blocVide("Réunions"),
        blocVide("Autres actions"),
      ],
    },
    miseEnPlaceTerrain: {
      blocs: [
        blocVide("Installation"),
        blocVide("Essais & réglages"),
        blocVide("Formation"),
        blocVide("Soutien terrain"),
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
