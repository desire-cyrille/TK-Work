import type { ContratLocation } from "../types/domain";
import { montantTvaEuro, parseEuro } from "./money";

/** Au moins un taux % TVA renseigné sur le bail (loyer HC ou charges). */
export function contratUtiliseSaisieTva(c: ContratLocation): boolean {
  return parseEuro(c.loyerHcTva) > 0.005 || parseEuro(c.chargesTva) > 0.005;
}

export function tvaLoyerHcEuro(c: ContratLocation): number {
  return montantTvaEuro(parseEuro(c.loyerHc), c.loyerHcTva);
}

export function tvaChargesLocativesEuro(c: ContratLocation): number {
  return montantTvaEuro(parseEuro(c.charges), c.chargesTva);
}

/** Somme des TVA € sur loyer HC et sur charges locatives. */
export function tvaTotaleEuroSurLoyerEtCharges(c: ContratLocation): number {
  return tvaLoyerHcEuro(c) + tvaChargesLocativesEuro(c);
}

/** Loyer TTC = HC + charges + TVA (selon les taux % du bail). */
export function loyerTtcDepuisHcChargesTva(c: ContratLocation): number {
  return parseEuro(c.loyerHc) + parseEuro(c.charges) + tvaTotaleEuroSurLoyerEtCharges(c);
}
