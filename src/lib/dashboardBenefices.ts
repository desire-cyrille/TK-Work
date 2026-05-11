import type { MoisFinanceContrat } from "../context/financeStorage";
import type { AirbnbState } from "../types/airbnb";
import type { ChaineLocation, ContratLocation } from "../types/domain";
import { getAirbnbMonthDetail } from "./airbnbStorage";
import { moisCleDepuisDate } from "./moisFinance";
import { parseEuro } from "./money";

export type LigneRevenuMois = {
  mois: string;
  moisCle: string;
  /** Paiements saisis sur les baux « Sous-location » des chaînes (équivalent encaissements sous-location). */
  revenusSousLocationChaines: number;
  /** Total facturé / revenu mois côté Airbnb (même logique que l’onglet Airbnb). */
  revenusAirbnb: number;
  revenus: number;
  charges: number;
};

/** Les `n` derniers mois civils, du plus récent au plus ancien (clés YYYY-MM). */
export function moisClesDerniersMois(n: number, ref: Date = new Date()): string[] {
  const keys: string[] = [];
  const d = new Date(ref.getFullYear(), ref.getMonth(), 1);
  for (let i = 0; i < n; i++) {
    keys.push(moisCleDepuisDate(d));
    d.setMonth(d.getMonth() - 1);
  }
  return keys;
}

function libelleMoisFrancais(moisCle: string): string {
  const [ys, ms] = moisCle.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m || m < 1 || m > 12) return moisCle;
  const d = new Date(y, m - 1, 1);
  const raw = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function totalPaiementsMoisSurContrat(
  contrat: ContratLocation | undefined,
  moisCle: string,
  rowsForContrat: (c: ContratLocation) => MoisFinanceContrat[]
): number {
  if (!contrat) return 0;
  const rows = rowsForContrat(contrat);
  const row = rows.find((r) => r.moisCle === moisCle);
  if (!row || row.statutOverride === "annule") return 0;
  let s = 0;
  for (const p of row.paiements) {
    s += parseEuro(p.montant);
  }
  return s;
}

function totalFraisMoisPatrimoine(
  contrats: ContratLocation[],
  moisCle: string,
  rowsForContrat: (c: ContratLocation) => MoisFinanceContrat[]
): number {
  let charges = 0;
  for (const c of contrats) {
    const rows = rowsForContrat(c);
    const row = rows.find((r) => r.moisCle === moisCle);
    if (!row || row.statutOverride === "annule") continue;
    for (const f of row.frais) {
      charges += parseEuro(f.montant);
    }
  }
  return charges;
}

/**
 * Revenu mensuel = somme des paiements sur les baux **sous-location** des **chaînes**
 * enregistrées + revenu consolidé **Airbnb** du mois (`getAirbnbMonthDetail` → `totalFacture`).
 * Charges = frais saisis sur l’ensemble des baux (inchangé).
 */
export function computeRevenusParMoisDashboard(
  contrats: ContratLocation[],
  chainesLocation: ChaineLocation[],
  rowsForContrat: (c: ContratLocation) => MoisFinanceContrat[],
  airbnbState: AirbnbState,
  nombreMois = 6,
  dateRef: Date = new Date()
): LigneRevenuMois[] {
  const moisCles = moisClesDerniersMois(nombreMois, dateRef);
  const byId = new Map(contrats.map((c) => [c.id, c]));
  const result: LigneRevenuMois[] = [];
  for (const moisCle of moisCles) {
    let revenusSousLocationChaines = 0;
    for (const ch of chainesLocation) {
      const sous = byId.get(ch.contratSousLocataireId);
      revenusSousLocationChaines += totalPaiementsMoisSurContrat(
        sous,
        moisCle,
        rowsForContrat
      );
    }
    const detailAirbnb = getAirbnbMonthDetail(airbnbState, moisCle);
    const revenusAirbnb = detailAirbnb.totalFacture;
    const charges = totalFraisMoisPatrimoine(contrats, moisCle, rowsForContrat);
    result.push({
      mois: libelleMoisFrancais(moisCle),
      moisCle,
      revenusSousLocationChaines,
      revenusAirbnb,
      revenus: revenusSousLocationChaines + revenusAirbnb,
      charges,
    });
  }
  return result;
}
