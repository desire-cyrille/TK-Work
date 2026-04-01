import type { MoisFinanceContrat } from "../context/financeStorage";
import type { ContratLocation } from "../types/domain";
import { parseEuro } from "./money";

export function moisClePour(annee: number, mois: number): string {
  return `${annee}-${String(mois).padStart(2, "0")}`;
}

function parseIsoDate(s: string): Date | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Le bail couvre au moins un jour de [debutJour, finJour] (inclus), en comparant les dates ISO du contrat. */
export function contratActifPendant(
  c: ContratLocation,
  debutPeriode: Date,
  finPeriode: Date,
): boolean {
  const d0 = parseIsoDate(c.dateDebut);
  if (!d0) return false;
  const finBail = parseIsoDate(c.dateFin);
  if (d0 > finPeriode) return false;
  if (finBail && finBail < debutPeriode) return false;
  return true;
}

export function bornesMoisCalendaire(
  mois: number,
  annee: number,
): { debut: Date; fin: Date } {
  const debut = new Date(annee, mois - 1, 1, 0, 0, 0, 0);
  const fin = new Date(annee, mois, 0, 23, 59, 59, 999);
  return { debut, fin };
}

export function libellePeriodeMoisFr(mois: number, annee: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(annee, mois - 1, 1));
}

export function aggregateFinancePourMoisCle(
  moisCle: string,
  moisParContrat: Record<string, MoisFinanceContrat[]>,
): { encaissements: number; frais: number } {
  let encaissements = 0;
  let frais = 0;
  for (const rows of Object.values(moisParContrat)) {
    const row = rows.find((r) => r.moisCle === moisCle);
    if (!row) continue;
    for (const p of row.paiements) encaissements += parseEuro(p.montant);
    for (const f of row.frais) frais += parseEuro(f.montant);
  }
  return { encaissements, frais };
}

/** Entrée `<input type="date">` au format YYYY-MM-DD → bornes locales du jour. */
export function bornesJourPourInputDate(
  dateStr: string,
): { debut: Date; fin: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const debut = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (
    debut.getFullYear() !== y ||
    debut.getMonth() !== mo - 1 ||
    debut.getDate() !== d
  ) {
    return null;
  }
  const fin = new Date(y, mo - 1, d, 23, 59, 59, 999);
  return { debut, fin };
}

export function libelleDateLongFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Cumul encaissements / frais pour chaque mois calendaire touché par l’intervalle [debut, fin]. */
export function aggregateFinancePourPlageMois(
  debutPeriode: Date,
  finPeriode: Date,
  moisParContrat: Record<string, MoisFinanceContrat[]>,
): { encaissements: number; frais: number } {
  let encaissements = 0;
  let frais = 0;
  const start = new Date(
    debutPeriode.getFullYear(),
    debutPeriode.getMonth(),
    1,
  );
  const end = new Date(finPeriode.getFullYear(), finPeriode.getMonth(), 1);
  for (let cur = new Date(start); cur <= end; cur.setMonth(cur.getMonth() + 1)) {
    const cle = moisClePour(cur.getFullYear(), cur.getMonth() + 1);
    const a = aggregateFinancePourMoisCle(cle, moisParContrat);
    encaissements += a.encaissements;
    frais += a.frais;
  }
  return { encaissements, frais };
}
