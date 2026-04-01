import type {
  Bailleur,
  CategorieLocataire,
  ChaineLocation,
  ContratLocation,
  LigneAutrePaiement,
  Locataire,
  Logement,
  PeriodiciteLoyer,
  TypeBailLocation,
  TypeBien,
  TypeOccupantLocataire,
} from "../types/domain";
import {
  CATEGORIES_LOCATAIRE,
  PERIODICITES_LOYER,
  TYPES_BAIL_LOCATION,
  TYPES_BIEN,
  TYPES_OCCUPANT_LOCATAIRE,
} from "../types/domain";

export const BIENS_STORAGE_KEY = "tk-gestion-biens-v1";

export type BiensState = {
  bailleurs: Bailleur[];
  logements: Logement[];
  locataires: Locataire[];
  contratsLocation: ContratLocation[];
  chainesLocation: ChaineLocation[];
};

function isPeriodiciteLoyer(v: string): v is Exclude<PeriodiciteLoyer, ""> {
  return (PERIODICITES_LOYER as readonly string[]).includes(v);
}

function isTypeBailLocation(v: string): v is Exclude<TypeBailLocation, ""> {
  return (TYPES_BAIL_LOCATION as readonly string[]).includes(v);
}

function normalizeLigneAutrePaiementRow(raw: unknown): LigneAutrePaiement {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
    montant: typeof r.montant === "string" ? r.montant : "",
    tva: typeof r.tva === "string" ? r.tva : "",
    categorie: typeof r.categorie === "string" ? r.categorie : "",
    description: typeof r.description === "string" ? r.description : "",
  };
}

export function normalizeContratLocation(raw: Record<string, unknown>): ContratLocation {
  const id = typeof raw.id === "string" ? raw.id : crypto.randomUUID();
  let periodicite: PeriodiciteLoyer = "";
  if (typeof raw.periodicite === "string" && isPeriodiciteLoyer(raw.periodicite)) {
    periodicite = raw.periodicite;
  }
  const modeQ = raw.modeEnvoiQuittance;
  const modeEnvoiQuittance =
    modeQ === "email" || modeQ === "courrier" || modeQ === "les_deux" || modeQ === ""
      ? modeQ
      : "";
  const freq = raw.frequenceQuittance;
  const frequenceQuittance =
    freq === "mensuelle" || freq === "trimestrielle" || freq === ""
      ? freq
      : "";
  const o = (k: string) =>
    typeof raw[k] === "string" ? (raw[k] as string) : "";

  const yn = (k: string): "" | "oui" | "non" => {
    const v = raw[k];
    return v === "oui" || v === "non" || v === "" ? v : "";
  };

  let typeBail: TypeBailLocation = "";
  if (typeof raw.typeBail === "string" && isTypeBailLocation(raw.typeBail)) {
    typeBail = raw.typeBail;
  }

  const usageRaw = raw.usageLogement;
  const usageLogement =
    usageRaw === "residence_principale" ||
    usageRaw === "residence_secondaire" ||
    usageRaw === "activite_pro_sans_commerce" ||
    usageRaw === ""
      ? usageRaw
      : "";

  const pe = raw.paiementEchoirOuEchu;
  const paiementEchoirOuEchu =
    pe === "a_echoir" || pe === "terme_echu" || pe === "" ? pe : "";

  const tCharges = raw.typeChargesLoyer;
  const typeChargesLoyer =
    tCharges === "provision" || tCharges === "forfait" || tCharges === ""
      ? tCharges
      : "";

  const mr = raw.modeRevisionLoyer;
  const modeRevisionLoyer =
    mr === "irl" || mr === "aucune" || mr === "pourcentage" || mr === ""
      ? mr
      : "";

  const revSur = raw.revisionSur;
  const revisionSur =
    revSur === "loyer_hc" || revSur === "loyer_cc" || revSur === ""
      ? revSur
      : "";

  const drm = raw.dateRevisionMode;
  const dateRevisionMode =
    drm === "anniversaire" || drm === "date_fixe" || drm === "" ? drm : "";

  const colRaw = raw.colocataireIds;
  const colocataireIds = Array.isArray(colRaw)
    ? colRaw.filter((x): x is string => typeof x === "string")
    : [];

  const apRaw = raw.autresPaiements;
  const autresPaiements = Array.isArray(apRaw)
    ? apRaw.map(normalizeLigneAutrePaiementRow)
    : [];

  return {
    id,
    logementId: o("logementId"),
    locataireId: o("locataireId"),
    locataireSousBailleurId: o("locataireSousBailleurId"),
    libelleExploitation: o("libelleExploitation"),
    colocataireIds,
    typeBail,
    usageLogement,
    identifiantBail: o("identifiantBail"),
    dateDebut: o("dateDebut"),
    dateFin: o("dateFin"),
    dureeMois: o("dureeMois"),
    renouvellementTacite: yn("renouvellementTacite"),
    periodicite,
    paiementEchoirOuEchu,
    moyenPaiement: o("moyenPaiement"),
    jourPaiement: o("jourPaiement"),
    jourQuittancement: o("jourQuittancement"),
    generationLoyerRelatif: o("generationLoyerRelatif"),
    loyerHc: o("loyerHc"),
    loyerHcTva: o("loyerHcTva"),
    charges: o("charges"),
    chargesTva: o("chargesTva"),
    typeChargesLoyer,
    loyerChargesComprises: o("loyerChargesComprises"),
    autresPaiements,
    premierLoyerProrata: yn("premierLoyerProrata"),
    dateFinPeriodePremiereQuittance: o("dateFinPeriodePremiereQuittance"),
    premierLoyerHcCalcule: o("premierLoyerHcCalcule"),
    premierLoyerChargesCalcule: o("premierLoyerChargesCalcule"),
    depotGarantie: o("depotGarantie"),
    depotGarantieType: o("depotGarantieType"),
    depotGarantieDocumentNote: o("depotGarantieDocumentNote"),
    depotGarantieDateVersement: o("depotGarantieDateVersement"),
    modeRevisionLoyer,
    indiceRevisionLibelle: o("indiceRevisionLibelle"),
    trimestreIndiceRevision: o("trimestreIndiceRevision"),
    valeurIndiceRevision: o("valeurIndiceRevision"),
    revisionAutomatique: yn("revisionAutomatique"),
    revisionSur,
    periodeRevision: o("periodeRevision"),
    dateRevisionMode,
    dateRevisionFixe: o("dateRevisionFixe"),
    encadrementRefMajore: yn("encadrementRefMajore"),
    encadrementZoneIrl: yn("encadrementZoneIrl"),
    loyerReferenceM2: o("loyerReferenceM2"),
    loyerMajoreM2: o("loyerMajoreM2"),
    complementLoyerMontant: o("complementLoyerMontant"),
    complementLoyerDescription: o("complementLoyerDescription"),
    bailPrecedent18Mois: yn("bailPrecedent18Mois"),
    dernierLoyerApplique: o("dernierLoyerApplique"),
    dernierLoyerDateVersement: o("dernierLoyerDateVersement"),
    derniereRevisionDate: o("derniereRevisionDate"),
    loyerReevaluation: yn("loyerReevaluation"),
    numeroContratInterne: o("numeroContratInterne"),
    indexation: o("indexation"),
    clauseParticuliere: o("clauseParticuliere"),
    infosComplementaires: o("infosComplementaires"),
    frequenceQuittance,
    modeEnvoiQuittance,
    montantCaution: o("montantCaution"),
    nomsGarants: o("nomsGarants"),
    organismeGarantie: o("organismeGarantie"),
    refGarantie: o("refGarantie"),
    assuranceLoyerImpaye: yn("assuranceLoyerImpaye"),
    multirisqueHabitation: yn("multirisqueHabitation"),
    assureur: o("assureur"),
    numeroPolice: o("numeroPolice"),
    dateEcheanceAssurance: o("dateEcheanceAssurance"),
    notesAssurance: o("notesAssurance"),
    urlBail: o("urlBail"),
    bailSigneImportNom: o("bailSigneImportNom"),
    bailSigneDataUrl: o("bailSigneDataUrl"),
    urlEtatDesLieux: o("urlEtatDesLieux"),
    autresDocuments: o("autresDocuments"),
    etatDesLieuxRempli: o("etatDesLieuxRempli"),
    etatDesLieuxImportNom: o("etatDesLieuxImportNom"),
  };
}

function normalizeChaineLocation(raw: Record<string, unknown>): ChaineLocation {
  return {
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    logementId: typeof raw.logementId === "string" ? raw.logementId : "",
    contratPrincipalId:
      typeof raw.contratPrincipalId === "string" ? raw.contratPrincipalId : "",
    contratSousLocataireId:
      typeof raw.contratSousLocataireId === "string"
        ? raw.contratSousLocataireId
        : "",
  };
}

function isCategorieLocataire(v: string): v is CategorieLocataire {
  return (CATEGORIES_LOCATAIRE as readonly string[]).includes(v);
}

function isTypeOccupantLocataire(v: string): v is TypeOccupantLocataire {
  return (TYPES_OCCUPANT_LOCATAIRE as readonly string[]).includes(v);
}

function normalizeLogementsAssociesLocataire(raw: Record<string, unknown>): {
  logementsAssociesIds: string[];
  categorieParLogement: Partial<Record<string, CategorieLocataire>>;
} {
  const categorieParLogement: Partial<
    Record<string, CategorieLocataire>
  > = {};
  const cplRaw = raw.categorieParLogement;
  if (cplRaw && typeof cplRaw === "object" && !Array.isArray(cplRaw)) {
    for (const [k, v] of Object.entries(cplRaw)) {
      if (typeof k === "string" && typeof v === "string" && isCategorieLocataire(v)) {
        categorieParLogement[k] = v;
      }
    }
  }
  const arr = raw.logementsAssociesIds;
  if (Array.isArray(arr)) {
    const ids = [
      ...new Set(
        arr
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter((x) => x.length > 0)
      ),
    ];
    return { logementsAssociesIds: ids, categorieParLogement };
  }
  const legacy =
    typeof raw.logementId === "string" ? raw.logementId.trim() : "";
  if (legacy) {
    return {
      logementsAssociesIds: [legacy],
      categorieParLogement: {},
    };
  }
  return { logementsAssociesIds: [], categorieParLogement };
}

export function normalizeLocataire(raw: Record<string, unknown>): Locataire {
  const id = typeof raw.id === "string" ? raw.id : crypto.randomUUID();
  let categorie: CategorieLocataire = "locataire";
  const catRaw = raw.categorie;
  if (typeof catRaw === "string" && isCategorieLocataire(catRaw)) {
    categorie = catRaw;
  }
  let typeOccupant: TypeOccupantLocataire = "personne_physique";
  const typeRaw = raw.typeOccupant;
  if (typeof typeRaw === "string" && isTypeOccupantLocataire(typeRaw)) {
    typeOccupant = typeRaw;
  }

  const civiliteRaw = raw.civilite;
  const civilite =
    civiliteRaw === "M." ||
    civiliteRaw === "Mme" ||
    civiliteRaw === "Autre" ||
    civiliteRaw === ""
      ? civiliteRaw
      : "";

  const repCivRaw = raw.representantCivilite;
  const representantCivilite =
    repCivRaw === "M." ||
    repCivRaw === "Mme" ||
    repCivRaw === "Autre" ||
    repCivRaw === ""
      ? repCivRaw
      : "";

  return {
    id,
    categorie,
    typeOccupant,
    raisonSociale:
      typeof raw.raisonSociale === "string" ? raw.raisonSociale : "",
    siret: typeof raw.siret === "string" ? raw.siret : "",
    formeJuridique:
      typeof raw.formeJuridique === "string" ? raw.formeJuridique : "",
    representantCivilite,
    representantPrenom:
      typeof raw.representantPrenom === "string" ? raw.representantPrenom : "",
    representantNom:
      typeof raw.representantNom === "string" ? raw.representantNom : "",
    civilite,
    prenom: typeof raw.prenom === "string" ? raw.prenom : "",
    nom: typeof raw.nom === "string" ? raw.nom : "",
    email: typeof raw.email === "string" ? raw.email : "",
    telephone: typeof raw.telephone === "string" ? raw.telephone : "",
    telephoneSecondaire:
      typeof raw.telephoneSecondaire === "string"
        ? raw.telephoneSecondaire
        : "",
    dateNaissance:
      typeof raw.dateNaissance === "string" ? raw.dateNaissance : "",
    lieuNaissance:
      typeof raw.lieuNaissance === "string" ? raw.lieuNaissance : "",
    nationalite: typeof raw.nationalite === "string" ? raw.nationalite : "",
    profession: typeof raw.profession === "string" ? raw.profession : "",
    employeur: typeof raw.employeur === "string" ? raw.employeur : "",
    revenusMensuels:
      typeof raw.revenusMensuels === "string" ? raw.revenusMensuels : "",
    iban: typeof raw.iban === "string" ? raw.iban : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    ...normalizeLogementsAssociesLocataire(raw),
  };
}

function isTypeBien(v: string): v is TypeBien {
  return (TYPES_BIEN as readonly string[]).includes(v);
}

/** Fusionne les anciens enregistrements (ex. `libelle`, `proprietaireId`) avec le schéma actuel */
export function normalizeLogement(raw: Record<string, unknown>): Logement {
  const id = typeof raw.id === "string" ? raw.id : crypto.randomUUID();
  const titre =
    typeof raw.titre === "string"
      ? raw.titre
      : typeof raw.libelle === "string"
        ? raw.libelle
        : "Sans titre";

  let typeBien: TypeBien = "Autre";
  if (typeof raw.typeBien === "string" && isTypeBien(raw.typeBien)) {
    typeBien = raw.typeBien;
  }

  const bailleurIdRaw = raw.bailleurId ?? raw.proprietaireId;
  const bailleurId =
    typeof bailleurIdRaw === "string" ? bailleurIdRaw : "";

  return {
    id,
    titre,
    typeBien,
    adresse: typeof raw.adresse === "string" ? raw.adresse : "",
    complementAdresse:
      typeof raw.complementAdresse === "string" ? raw.complementAdresse : "",
    codePostal:
      typeof raw.codePostal === "string" ? raw.codePostal : "",
    ville: typeof raw.ville === "string" ? raw.ville : "",
    surfaceM2: typeof raw.surfaceM2 === "string" ? raw.surfaceM2 : "",
    nombrePieces:
      typeof raw.nombrePieces === "string" ? raw.nombrePieces : "",
    etage: typeof raw.etage === "string" ? raw.etage : "",
    meuble:
      raw.meuble === "oui" || raw.meuble === "non" || raw.meuble === ""
        ? raw.meuble
        : "",
    referenceInterne:
      typeof raw.referenceInterne === "string" ? raw.referenceInterne : "",
    copropriete:
      raw.copropriete === "oui" || raw.copropriete === "non" || raw.copropriete === ""
        ? raw.copropriete
        : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    bailleurId,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : "",
    statut: raw.statut === "inactif" ? "inactif" : "actif",
  };
}

function normalizeBailleur(raw: Record<string, unknown>): Bailleur {
  let typeOccupant: TypeOccupantLocataire = "personne_physique";
  const typeRaw = raw.typeOccupant;
  if (typeof typeRaw === "string" && isTypeOccupantLocataire(typeRaw)) {
    typeOccupant = typeRaw;
  }
  const repCivRaw = raw.representantCivilite;
  const representantCivilite =
    repCivRaw === "M." ||
    repCivRaw === "Mme" ||
    repCivRaw === "Autre" ||
    repCivRaw === ""
      ? repCivRaw
      : "";
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    typeOccupant,
    nom: typeof raw.nom === "string" ? raw.nom : "",
    formeJuridique:
      typeof raw.formeJuridique === "string" ? raw.formeJuridique : "",
    siret: typeof raw.siret === "string" ? raw.siret : "",
    representantCivilite,
    representantPrenom:
      typeof raw.representantPrenom === "string" ? raw.representantPrenom : "",
    representantNom:
      typeof raw.representantNom === "string" ? raw.representantNom : "",
    email: typeof raw.email === "string" ? raw.email : "",
    telephone: typeof raw.telephone === "string" ? raw.telephone : "",
    adresse: typeof raw.adresse === "string" ? raw.adresse : "",
    complementAdresse:
      typeof raw.complementAdresse === "string" ? raw.complementAdresse : "",
    codePostal: typeof raw.codePostal === "string" ? raw.codePostal : "",
    ville: typeof raw.ville === "string" ? raw.ville : "",
  };
}

function migrateBailleurs(parsed: Record<string, unknown>): Bailleur[] {
  let arr: unknown[] = [];
  if (Array.isArray(parsed.bailleurs)) arr = parsed.bailleurs;
  else if (Array.isArray(parsed.proprietaires)) arr = parsed.proprietaires;
  return arr.map((x) => normalizeBailleur(x as Record<string, unknown>));
}

export function loadBiensState(): BiensState {
  try {
    const raw = localStorage.getItem(BIENS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const bailleurs = migrateBailleurs(parsed);
      const logementsRaw = Array.isArray(parsed.logements)
        ? parsed.logements
        : [];
      const logements = logementsRaw.map((l) =>
        normalizeLogement(l as Record<string, unknown>)
      );
      const locatairesRaw = Array.isArray(parsed.locataires)
        ? parsed.locataires
        : [];
      const locataires = locatairesRaw.map((x) =>
        normalizeLocataire(x as Record<string, unknown>)
      );
      const contratsRaw = Array.isArray(parsed.contratsLocation)
        ? parsed.contratsLocation
        : [];
      const contratsLocation = contratsRaw.map((x) =>
        normalizeContratLocation(x as Record<string, unknown>)
      );
      const chainesRaw = Array.isArray(parsed.chainesLocation)
        ? parsed.chainesLocation
        : [];
      const chainesLocation = chainesRaw.map((x) =>
        normalizeChaineLocation(x as Record<string, unknown>)
      );
      return {
        bailleurs,
        logements,
        locataires,
        contratsLocation,
        chainesLocation,
      };
    }
  } catch {
    /* ignore */
  }
  return {
    bailleurs: [],
    logements: [],
    locataires: [],
    contratsLocation: [],
    chainesLocation: [],
  };
}

export function saveBiensState(state: BiensState) {
  localStorage.setItem(BIENS_STORAGE_KEY, JSON.stringify(state));
}
