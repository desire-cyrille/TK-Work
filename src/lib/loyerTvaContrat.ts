import type { ContratLocation } from "../types/domain";
import { montantTvaEuro, parseEuro } from "./money";

/** Champs suffisants pour calculer le loyer TTC (HC + charges + TVA). */
export type FragmentLoyerTtc = Pick<
  ContratLocation,
  "loyerHc" | "loyerHcTva" | "charges" | "chargesTva"
>;

/** Au moins un taux % TVA renseigné sur le bail (loyer HC ou charges). */
export function contratUtiliseSaisieTva(c: FragmentLoyerTtc): boolean {
  return parseEuro(c.loyerHcTva) > 0.005 || parseEuro(c.chargesTva) > 0.005;
}

export function tvaLoyerHcEuro(c: FragmentLoyerTtc): number {
  return montantTvaEuro(parseEuro(c.loyerHc), c.loyerHcTva);
}

export function tvaChargesLocativesEuro(c: FragmentLoyerTtc): number {
  return montantTvaEuro(parseEuro(c.charges), c.chargesTva);
}

/** Somme des TVA € sur loyer HC et sur charges locatives. */
export function tvaTotaleEuroSurLoyerEtCharges(c: FragmentLoyerTtc): number {
  return tvaLoyerHcEuro(c) + tvaChargesLocativesEuro(c);
}

/** Loyer TTC = HC + charges + TVA (selon les taux % du bail). */
export function loyerTtcDepuisHcChargesTva(c: FragmentLoyerTtc): number {
  return parseEuro(c.loyerHc) + parseEuro(c.charges) + tvaTotaleEuroSurLoyerEtCharges(c);
}
