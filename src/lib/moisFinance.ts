import type { ContratLocation } from "../types/domain";
import type { MoisFinanceContrat } from "../context/financeStorage";
import {
  contratUtiliseSaisieTva,
  loyerTtcDepuisHcChargesTva,
  tvaTotaleEuroSurLoyerEtCharges,
} from "./loyerTvaContrat";
import { montantTvaEuro, parseEuro } from "./money";

export function moisCleDepuisDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function moisCleCourant(): string {
  return moisCleDepuisDate(new Date());
}

/** Période couverte : du début du bail jusqu’à fin de bail ou horizon (24 mois). */
export function listeMoisPourContrat(c: ContratLocation): string[] {
  const debut = c.dateDebut.trim();
  if (!debut) return [];
  const start = new Date(debut);
  if (Number.isNaN(start.getTime())) return [];

  const out: string[] = [];
  let end = new Date();
  if (c.dateFin.trim()) {
    const f = new Date(c.dateFin);
    if (!Number.isNaN(f.getTime()) && f > end) end = f;
  }
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + 24);
  if (end < horizon) end = horizon;

  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    out.push(moisCleDepuisDate(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export function baseLoyerMensuelContrat(c: ContratLocation): number {
  if (contratUtiliseSaisieTva(c)) {
    return loyerTtcDepuisHcChargesTva(c);
  }
  return parseEuro(c.loyerChargesComprises);
}

/** Premier mois couvert par le bail (clé YYYY-MM), ou null. */
export function premiereMoisCleContrat(c: ContratLocation): string | null {
  const liste = listeMoisPourContrat(c);
  return liste.length > 0 ? liste[0]! : null;
}

/**
 * Loyer de base pour un mois donné (loyer charges comprises mensuel ou,
 * pour le premier mois avec prorata saisi, HC calculé + charges calculées).
 */
export function baseLoyerPourMoisContrat(
  c: ContratLocation,
  moisCle: string
): number {
  const premier = premiereMoisCleContrat(c);
  if (
    premier &&
    moisCle === premier &&
    c.premierLoyerProrata === "oui"
  ) {
    const hc = parseEuro(c.premierLoyerHcCalcule);
    const ch = parseEuro(c.premierLoyerChargesCalcule);
    if (hc > 0.005 || ch > 0.005) {
      const loyerHcM = parseEuro(c.loyerHc);
      const chargesM = parseEuro(c.charges);
      const baseM = loyerHcM + chargesM;
      const prorat = hc + ch;
      const tvaTotEur =
        montantTvaEuro(loyerHcM, c.loyerHcTva) +
        montantTvaEuro(chargesM, c.chargesTva);
      if (baseM > 0.005 && tvaTotEur > 0.005) {
        return prorat + (tvaTotEur * prorat) / baseM;
      }
      return prorat;
    }
  }
  return baseLoyerMensuelContrat(c);
}

/**
 * Part TVA (€) incluse dans le loyer de base du mois (hors frais et report entrant).
 */
export function tvaEuroDansBaseLoyerDuMois(
  c: ContratLocation,
  moisCle: string
): number {
  if (!contratUtiliseSaisieTva(c)) return 0;
  const premier = premiereMoisCleContrat(c);
  if (
    premier &&
    moisCle === premier &&
    c.premierLoyerProrata === "oui"
  ) {
    const hc = parseEuro(c.premierLoyerHcCalcule);
    const ch = parseEuro(c.premierLoyerChargesCalcule);
    const prorat = hc + ch;
    if (prorat <= 0.005) return 0;
    const loyerHcM = parseEuro(c.loyerHc);
    const chargesM = parseEuro(c.charges);
    const baseM = loyerHcM + chargesM;
    const tvaTotEur =
      montantTvaEuro(loyerHcM, c.loyerHcTva) +
      montantTvaEuro(chargesM, c.chargesTva);
    if (baseM <= 0.005 || tvaTotEur <= 0.005) return 0;
    return (tvaTotEur * prorat) / baseM;
  }
  return tvaTotaleEuroSurLoyerEtCharges(c);
}

function moisFinanceVide(moisCle: string, contratId: string): MoisFinanceContrat {
  return {
    moisCle,
    contratId,
    annulerReportVersSuivant: false,
    statutOverride: "",
    paiements: [],
    frais: [],
    observationsDocuments: "",
  };
}

/**
 * Alignement des lignes finance sur le contrat : mêmes mois que
 * {@link listeMoisPourContrat}, en conservant paiements / frais / observations
 * pour chaque moisCle encore présent (supprime les mois hors plage du bail).
 */
export function fusionnerMoisFinanceAvecContrat(
  contrat: ContratLocation,
  bank: MoisFinanceContrat[]
): MoisFinanceContrat[] {
  const cles = listeMoisPourContrat(contrat);
  const map = new Map(bank.map((m) => [m.moisCle, m]));
  return cles.map((moisCle) => {
    const ex = map.get(moisCle);
    const base = moisFinanceVide(moisCle, contrat.id);
    if (!ex) return base;
    return {
      ...base,
      ...ex,
      contratId: contrat.id,
      observationsDocuments: ex.observationsDocuments ?? "",
    };
  });
}

export type StatutMoisUi = "paye" | "en_retard" | "annule" | "a_payer";

export type MoisComputed = {
  moisCle: string;
  contratId: string;
  baseLoyer: number;
  totalFrais: number;
  reportEntrant: number;
  totalDu: number;
  totalPaye: number;
  solde: number;
  reportSortant: number;
  annulerReportVersSuivant: boolean;
  statut: StatutMoisUi;
  brutRecuOuPaye: number;
  /** TVA € estimée sur les paiements (répartition au prorata du dû du mois). */
  tvaSurPaye: number;
};

function mapMoisData(
  moisCle: string,
  contratId: string,
  rows: MoisFinanceContrat[]
): MoisFinanceContrat {
  const found = rows.find((r) => r.moisCle === moisCle);
  if (found) return found;
  return {
    moisCle,
    contratId,
    annulerReportVersSuivant: false,
    statutOverride: "",
    paiements: [],
    frais: [],
    observationsDocuments: "",
  };
}

/**
 * Enchaîne les mois dans l’ordre : report, soldes, statuts.
 */
export function calculerSuiteMois(
  c: ContratLocation,
  moisCles: string[],
  enregistres: MoisFinanceContrat[]
): MoisComputed[] {
  const contratId = c.id;
  const moisCourant = moisCleCourant();
  let reportEntrant = 0;
  const out: MoisComputed[] = [];

  for (const moisCle of moisCles) {
    const data = mapMoisData(moisCle, contratId, enregistres);
    const base = baseLoyerPourMoisContrat(c, moisCle);
    const totalFrais = data.frais.reduce(
      (s, f) => s + parseEuro(f.montant),
      0
    );
    const totalPaye = data.paiements.reduce(
      (s, p) => s + parseEuro(p.montant),
      0
    );

    const totalDu = base + totalFrais + reportEntrant;
    const solde = totalDu - totalPaye;
    const reportSortant = solde > 0.005 ? solde : 0;
    const tvaDansLoyerMois = tvaEuroDansBaseLoyerDuMois(c, moisCle);
    const tvaSurPaye =
      totalDu > 0.005 && totalPaye > 0.005 && tvaDansLoyerMois > 0.005
        ? (totalPaye * tvaDansLoyerMois) / totalDu
        : 0;

    let statut: StatutMoisUi = "a_payer";
    if (data.statutOverride === "annule") {
      statut = "annule";
    } else if (solde <= 0.005 && totalDu >= 0) {
      statut = "paye";
    } else if (moisCle < moisCourant && solde > 0.005) {
      statut = "en_retard";
    }

    out.push({
      moisCle,
      contratId,
      baseLoyer: base,
      totalFrais,
      reportEntrant,
      totalDu,
      totalPaye,
      solde,
      reportSortant,
      annulerReportVersSuivant: data.annulerReportVersSuivant,
      statut,
      brutRecuOuPaye: totalPaye,
      tvaSurPaye,
    });

    reportEntrant = data.annulerReportVersSuivant ? 0 : reportSortant;
  }

  return out;
}
