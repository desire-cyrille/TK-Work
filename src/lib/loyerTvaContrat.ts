import type { ContratLocation } from "../types/domain";
import { montantTvaEuro, parseEuro } from "./money";

const EPS = 0.005;

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

/**
 * TVA (€) contenue dans un montant considéré comme **TTC**, à partir des taux % du bail
 * (loyer HC et charges). Moyenne pondérée sur les bases HT si les deux taux diffèrent.
 * Formule : montant × t / (100 + t) avec t le taux % équivalent pour ce découpage.
 */
export function tvaDansMontantVerseTtc(
  montantTtc: number,
  c: FragmentLoyerTtc
): number {
  if (!contratUtiliseSaisieTva(c) || montantTtc <= EPS) return 0;
  const tHc = parseEuro(c.loyerHcTva);
  const tCh = parseEuro(c.chargesTva);
  const hc = parseEuro(c.loyerHc);
  const ch = parseEuro(c.charges);
  let t = 0;
  if (tHc > EPS && tCh > EPS) {
    const denom = hc + ch;
    t = denom > EPS ? (hc * tHc + ch * tCh) / denom : (tHc + tCh) / 2;
  } else if (tHc > EPS) {
    t = tHc;
  } else if (tCh > EPS) {
    t = tCh;
  }
  if (t <= EPS) return 0;
  const brut = montantTtc * (t / (100 + t));
  return Math.round(brut * 100) / 100;
}
