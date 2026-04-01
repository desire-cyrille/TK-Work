/** Particulier ou société / personne morale (locataire, bailleur, etc.) */
export const TYPES_OCCUPANT_LOCATAIRE = [
  "personne_physique",
  "personne_morale",
] as const;

export type TypeOccupantLocataire =
  (typeof TYPES_OCCUPANT_LOCATAIRE)[number];

export type Bailleur = {
  id: string;
  /** Particulier propriétaire ou société / personne morale */
  typeOccupant: TypeOccupantLocataire;
  /**
   * Particulier : nom complet. Société : dénomination sociale (même champ que sur la fiche).
   */
  nom: string;
  formeJuridique: string;
  siret: string;
  representantCivilite: "" | "M." | "Mme" | "Autre";
  representantPrenom: string;
  representantNom: string;
  email: string;
  telephone: string;
  /** Adresse (numéro et rue) */
  adresse: string;
  complementAdresse: string;
  codePostal: string;
  ville: string;
};

/** Ligne représentant légal (personne morale), pour affichage / PDF. */
export function ligneRepresentantLegalBailleur(b: Bailleur): string | null {
  if (b.typeOccupant !== "personne_morale") return null;
  const parts = [b.representantPrenom.trim(), b.representantNom.trim()]
    .filter(Boolean)
    .join(" ");
  if (!parts) return null;
  const civ = b.representantCivilite.trim();
  if (civ === "M." || civ === "Mme") return `${civ} ${parts}`;
  return parts;
}

/** Lignes d’adresse postale (sans le nom), pour affichage / PDF. */
export function lignesAdresseBailleur(
  b: Pick<Bailleur, "adresse" | "complementAdresse" | "codePostal" | "ville">
): string[] {
  const out: string[] = [];
  const rue = [b.adresse.trim(), b.complementAdresse.trim()]
    .filter(Boolean)
    .join(", ");
  const cpVille = [b.codePostal.trim(), b.ville.trim()].filter(Boolean).join(" ");
  if (rue) out.push(rue);
  if (cpVille) out.push(cpVille);
  return out;
}

/** Types de biens courants (proximité outils type gestion locative / Rentila) */
export const TYPES_BIEN = [
  "Appartement",
  "Maison",
  "Immeuble",
  "Studio",
  "Chambre",
  "Local commercial",
  "Bureaux",
  "Parking / box",
  "Terrain",
  "Autre",
] as const;

export type TypeBien = (typeof TYPES_BIEN)[number];

export type StatutLogement = "actif" | "inactif";

export type Logement = {
  id: string;
  /** Intitulé court pour retrouver le bien dans les listes */
  titre: string;
  typeBien: TypeBien;
  /** Photo du bien (URL), optionnel */
  imageUrl: string;
  statut: StatutLogement;
  /** Adresse (numéro et rue) */
  adresse: string;
  complementAdresse: string;
  codePostal: string;
  ville: string;
  /** Surface habitable ou utile, en m² */
  surfaceM2: string;
  nombrePieces: string;
  etage: string;
  meuble: "oui" | "non" | "";
  referenceInterne: string;
  copropriete: "oui" | "non" | "";
  notes: string;
  bailleurId: string;
};

export const CATEGORIES_LOCATAIRE = ["locataire", "sous-locataire"] as const;

export type CategorieLocataire = (typeof CATEGORIES_LOCATAIRE)[number];

/** Fiche occupant du bien (locataire principal ou sous-locataire) */
export type Locataire = {
  id: string;
  categorie: CategorieLocataire;
  typeOccupant: TypeOccupantLocataire;
  /** Personne morale : dénomination sociale */
  raisonSociale: string;
  siret: string;
  formeJuridique: string;
  representantCivilite: "" | "M." | "Mme" | "Autre";
  representantPrenom: string;
  representantNom: string;
  civilite: "" | "M." | "Mme" | "Autre";
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  telephoneSecondaire: string;
  dateNaissance: string;
  lieuNaissance: string;
  nationalite: string;
  profession: string;
  employeur: string;
  revenusMensuels: string;
  iban: string;
  notes: string;
  /**
   * Logements sur lesquels ce contact peut être choisi comme occupant au bail.
   * Un même locataire ou sous-locataire peut apparaître sur plusieurs biens.
   */
  logementsAssociesIds: string[];
  /**
   * Rôle sur chaque bien (locataire au bail principal vs sous-locataire).
   * Si une clé manque pour un id de `logementsAssociesIds`, on utilise `categorie`.
   */
  categorieParLogement: Partial<Record<string, CategorieLocataire>>;
};

/** Indique si la fiche locataire est proposée pour le logement donné. */
export function locataireEstRattacheAuLogement(
  l: Locataire,
  logementId: string
): boolean {
  if (!logementId.trim()) return false;
  return l.logementsAssociesIds.includes(logementId);
}

/** Catégorie effective sur un bien (pour filtres bail principal / sous-location). */
export function categorieLocataireSurLogement(
  l: Locataire,
  logementId: string
): CategorieLocataire {
  const spec = l.categorieParLogement[logementId];
  if (spec) return spec;
  return l.categorie;
}

/** Périodicité du loyer */
export const PERIODICITES_LOYER = ["mensuel", "trimestriel"] as const;

export type PeriodiciteLoyer = (typeof PERIODICITES_LOYER)[number] | "";

export const TYPES_BAIL_LOCATION = [
  "bail_habitation_vide",
  "bail_habitation_meuble",
  "bail_mobilite",
  "bail_commercial",
  "bail_professionnel",
  "bail_saisonnier",
  "bail_mixte",
  "autre",
] as const;

export type TypeBailLocation = (typeof TYPES_BAIL_LOCATION)[number] | "";

export type LigneAutrePaiement = {
  id: string;
  montant: string;
  tva: string;
  categorie: string;
  description: string;
};

/** Fiche contrat de location (bail) */
export type ContratLocation = {
  id: string;
  logementId: string;
  locataireId: string;
  /**
   * Pour une sous-location : identifiant du locataire principal (sous-bailleur).
   * Vide pour un bail classique bailleur → locataire.
   */
  locataireSousBailleurId: string;
  /**
   * Libellé d’exploitation (enseigne, nom commercial du local, raison affichée sur l’acte).
   * Souvent distinct du titre du logement en sous-location commerciale.
   */
  libelleExploitation: string;
  colocataireIds: string[];
  typeBail: TypeBailLocation;
  usageLogement:
    | ""
    | "residence_principale"
    | "residence_secondaire"
    | "activite_pro_sans_commerce";
  identifiantBail: string;
  dateDebut: string;
  dateFin: string;
  dureeMois: string;
  renouvellementTacite: "" | "oui" | "non";
  periodicite: PeriodiciteLoyer;
  paiementEchoirOuEchu: "" | "a_echoir" | "terme_echu";
  moyenPaiement: string;
  jourPaiement: string;
  jourQuittancement: string;
  generationLoyerRelatif: string;
  loyerHc: string;
  loyerHcTva: string;
  charges: string;
  chargesTva: string;
  typeChargesLoyer: "" | "provision" | "forfait";
  loyerChargesComprises: string;
  autresPaiements: LigneAutrePaiement[];
  premierLoyerProrata: "" | "oui" | "non";
  dateFinPeriodePremiereQuittance: string;
  premierLoyerHcCalcule: string;
  premierLoyerChargesCalcule: string;
  depotGarantie: string;
  depotGarantieType: string;
  depotGarantieDocumentNote: string;
  depotGarantieDateVersement: string;
  modeRevisionLoyer: "" | "irl" | "aucune" | "pourcentage";
  indiceRevisionLibelle: string;
  trimestreIndiceRevision: string;
  valeurIndiceRevision: string;
  revisionAutomatique: "" | "oui" | "non";
  revisionSur: "" | "loyer_hc" | "loyer_cc";
  periodeRevision: string;
  dateRevisionMode: "" | "anniversaire" | "date_fixe";
  dateRevisionFixe: string;
  encadrementRefMajore: "" | "oui" | "non";
  encadrementZoneIrl: "" | "oui" | "non";
  loyerReferenceM2: string;
  loyerMajoreM2: string;
  complementLoyerMontant: string;
  complementLoyerDescription: string;
  bailPrecedent18Mois: "" | "oui" | "non";
  dernierLoyerApplique: string;
  dernierLoyerDateVersement: string;
  derniereRevisionDate: string;
  loyerReevaluation: "" | "oui" | "non";
  numeroContratInterne: string;
  indexation: string;
  clauseParticuliere: string;
  infosComplementaires: string;
  frequenceQuittance: "" | "mensuelle" | "trimestrielle";
  modeEnvoiQuittance: "" | "email" | "courrier" | "les_deux";
  montantCaution: string;
  nomsGarants: string;
  organismeGarantie: string;
  refGarantie: string;
  assuranceLoyerImpaye: "" | "oui" | "non";
  multirisqueHabitation: "" | "oui" | "non";
  assureur: string;
  numeroPolice: string;
  dateEcheanceAssurance: string;
  notesAssurance: string;
  urlBail: string;
  /**
   * Bail signé : nom du fichier joint (métadonnée).
   * Le contenu est dans bailSigneDataUrl si la taille reste sous le plafond app.
   */
  bailSigneImportNom: string;
  /** data URL du bail signé (PDF ou Word) si import réussi ; sinon vide. */
  bailSigneDataUrl: string;
  urlEtatDesLieux: string;
  autresDocuments: string;
  /** Texte d’état des lieux saisi dans l’app (complément aux URL / PDF importé). */
  etatDesLieuxRempli: string;
  /** Nom du fichier importé (aperçu métadonnée ; le fichier reste sur votre machine). */
  etatDesLieuxImportNom: string;
};

/** Paire bail principal + sous-location sur un même bien (assistant chaîne). */
export type ChaineLocation = {
  id: string;
  logementId: string;
  contratPrincipalId: string;
  contratSousLocataireId: string;
};
