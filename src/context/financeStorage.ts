export const FINANCE_STORAGE_KEY = "tk-gestion-finance-v1";

export type LignePaiementMois = {
  id: string;
  date: string;
  montant: string;
  note: string;
};

export type LigneFraisMois = {
  id: string;
  typeFrais: string;
  libelle: string;
  montant: string;
  date: string;
};

export type MoisFinanceContrat = {
  moisCle: string;
  contratId: string;
  /** Si vrai, le reliquat de ce mois n’est pas reporté sur le mois suivant. */
  annulerReportVersSuivant: boolean;
  statutOverride: "" | "annule";
  paiements: LignePaiementMois[];
  frais: LigneFraisMois[];
  /** Texte repris sur les PDF quittance / avis. */
  observationsDocuments: string;
};

export type FinanceAppState = {
  typesFrais: string[];
  /** Locataire (souvent sous-locataire) servant de référence pour le bloc « bénéfice ». */
  locataireReferenceBeneficeId: string;
  moisParContrat: Record<string, MoisFinanceContrat[]>;
};

const DEFAULT_TYPES_FRAIS = [
  "Électricité",
  "Intervention / dépannage",
  "Autre",
];

function newId() {
  return crypto.randomUUID();
}

function normalizePaiement(raw: unknown): LignePaiementMois {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof r.id === "string" ? r.id : newId(),
    date: typeof r.date === "string" ? r.date : "",
    montant: typeof r.montant === "string" ? r.montant : "",
    note: typeof r.note === "string" ? r.note : "",
  };
}

function normalizeFrais(raw: unknown): LigneFraisMois {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof r.id === "string" ? r.id : newId(),
    typeFrais: typeof r.typeFrais === "string" ? r.typeFrais : "",
    libelle: typeof r.libelle === "string" ? r.libelle : "",
    montant: typeof r.montant === "string" ? r.montant : "",
    date: typeof r.date === "string" ? r.date : "",
  };
}

function normalizeMois(raw: unknown): MoisFinanceContrat | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const moisCle = typeof r.moisCle === "string" ? r.moisCle : "";
  const contratId = typeof r.contratId === "string" ? r.contratId : "";
  if (!moisCle || !contratId) return null;
  const statut = r.statutOverride;
  const paiementsRaw = Array.isArray(r.paiements) ? r.paiements : [];
  const fraisRaw = Array.isArray(r.frais) ? r.frais : [];
  return {
    moisCle,
    contratId,
    annulerReportVersSuivant: r.annulerReportVersSuivant === true,
    statutOverride:
      statut === "annule" ? "annule" : "",
    paiements: paiementsRaw.map(normalizePaiement),
    frais: fraisRaw.map(normalizeFrais),
    observationsDocuments:
      typeof r.observationsDocuments === "string"
        ? r.observationsDocuments
        : "",
  };
}

export function loadFinanceState(): FinanceAppState {
  try {
    const raw = localStorage.getItem(FINANCE_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>;
      const typesRaw = p.typesFrais;
      const typesFrais = Array.isArray(typesRaw)
        ? typesRaw.filter(
            (x): x is string => typeof x === "string" && x.trim() !== ""
          )
        : [...DEFAULT_TYPES_FRAIS];
      const locataireReferenceBeneficeId =
        typeof p.locataireReferenceBeneficeId === "string"
          ? p.locataireReferenceBeneficeId
          : "";
      const moisParContrat: Record<string, MoisFinanceContrat[]> = {};
      const mpc = p.moisParContrat;
      if (mpc && typeof mpc === "object" && !Array.isArray(mpc)) {
        for (const [k, v] of Object.entries(mpc)) {
          if (!Array.isArray(v)) continue;
          const rows = v.map(normalizeMois).filter(Boolean) as MoisFinanceContrat[];
          if (rows.length) moisParContrat[k] = rows;
        }
      }
      return {
        typesFrais: typesFrais.length ? typesFrais : [...DEFAULT_TYPES_FRAIS],
        locataireReferenceBeneficeId,
        moisParContrat,
      };
    }
  } catch {
    /* ignore */
  }
  return {
    typesFrais: [...DEFAULT_TYPES_FRAIS],
    locataireReferenceBeneficeId: "",
    moisParContrat: {},
  };
}

export function saveFinanceState(s: FinanceAppState) {
  localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(s));
}
