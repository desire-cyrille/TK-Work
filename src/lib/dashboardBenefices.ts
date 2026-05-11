import type { MoisFinanceContrat } from "../context/financeStorage";
import type { ContratLocation } from "../types/domain";
import { moisCleDepuisDate } from "./moisFinance";
import { parseEuro } from "./money";

export type LigneBenefice = {
  /** Libellé affiché (ex. « mai 2026 ») */
  mois: string;
  moisCle: string;
  revenus: number;
  charges: number;
  benefice: number;
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

/**
 * Agrège sur le patrimoine (tous les baux) les versements enregistrés (revenus)
 * et les frais saisis (charges) par mois civil — **6 derniers mois** par défaut.
 * Bénéfice = revenus − charges. Les mois de bail « annulés » sont ignorés.
 */
export function computeBeneficesParMoisDashboard(
  contrats: ContratLocation[],
  rowsForContrat: (c: ContratLocation) => MoisFinanceContrat[],
  nombreMois = 6,
  dateRef: Date = new Date()
): LigneBenefice[] {
  const moisCles = moisClesDerniersMois(nombreMois, dateRef);
  const result: LigneBenefice[] = [];
  for (const moisCle of moisCles) {
    let revenus = 0;
    let charges = 0;
    for (const c of contrats) {
      const rows = rowsForContrat(c);
      const row = rows.find((r) => r.moisCle === moisCle);
      if (!row || row.statutOverride === "annule") continue;
      for (const p of row.paiements) {
        revenus += parseEuro(p.montant);
      }
      for (const f of row.frais) {
        charges += parseEuro(f.montant);
      }
    }
    result.push({
      mois: libelleMoisFrancais(moisCle),
      moisCle,
      revenus,
      charges,
      benefice: revenus - charges,
    });
  }
  return result;
}
