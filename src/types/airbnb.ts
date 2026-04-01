/** Annonces — aligné sur le classeur « ventilation airbnb » (Epiais-lès-Louvres) */

export const AIRBNB_LISTINGS = [
  { id: "petitBureau", label: "Le petit bureau" },
  { id: "familiale", label: "La familiale" },
  { id: "cosyChill", label: "Le Cosy Chill" },
  { id: "ptitDeuxieme", label: "Le P'tit Deuxième" },
] as const;

export type AirbnbListingId = (typeof AIRBNB_LISTINGS)[number]["id"];

/** Premier mois d’activité inclusif (`YYYY-MM`). Absent = actif sur toute la plage de données. */
export const AIRBNB_LISTING_ACTIVE_FROM: Partial<
  Record<AirbnbListingId, string>
> = {
  familiale: "2024-10",
  cosyChill: "2025-11",
  ptitDeuxieme: "2026-03",
};

export function airbnbListingIsActiveInMonth(
  listingId: AirbnbListingId,
  month: string
): boolean {
  const from = AIRBNB_LISTING_ACTIVE_FROM[listingId];
  if (!from) return true;
  return month >= from;
}

export type AirbnbVentilationLine = {
  id: string;
  libelle: string;
  facture: string;
  frais: string;
  deduction: string;
};

export type AirbnbMonthVentilation = {
  month: string;
  listings: Record<AirbnbListingId, AirbnbVentilationLine[]>;
};

/** Charges mensuelles saisies par annonce (déduites du bénéfice ventilation / consolidé). */
export type AirbnbListingCharges = {
  loyer: string;
  electricite: string;
  gaz: string;
  internet: string;
  fournitureAlimentaires: string;
  fournitureMenagere: string;
  assurance: string;
};

/** @deprecated Ancien stockage par mois — migré vers chargesGlobal au chargement. */
export type AirbnbMonthCharges = {
  month: string;
  listings: Record<AirbnbListingId, AirbnbListingCharges>;
};

/** Charges identiques pour tous les mois (modifiables à tout moment). */
export type AirbnbChargesGlobal = {
  listings: Record<AirbnbListingId, AirbnbListingCharges>;
};

export type AirbnbSyntheseRow = {
  month: string;
  benefices: number;
  revenus: number;
};

export type AirbnbMonthDetailListing = {
  id: AirbnbListingId;
  label: string;
  beneficeVentilation: number | null;
  totalFactureVentilation: number | null;
  charges: number;
  beneficeNet: number | null;
};

export type AirbnbMonthDetail = {
  month: string;
  source: "saisie" | "fichier";
  totalPercuBrut: number;
  totalFacture: number;
  chargesTotal: number;
  beneficeNet: number;
  listings: AirbnbMonthDetailListing[];
};

/** Montants fichier (classeur) surchargés manuellement pour un mois sans ventilation. */
export type AirbnbSyntheseFichierOverrides = Record<
  string,
  { benefices: number; revenus: number }
>;

export type AirbnbState = {
  version: 1;
  ventilations: AirbnbMonthVentilation[];
  chargesGlobal: AirbnbChargesGlobal;
  syntheseFichierOverrides: AirbnbSyntheseFichierOverrides;
};
