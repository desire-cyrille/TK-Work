/**
 * Vue filtrée du graphique de synthèse Airbnb.
 * Lecture seule : ne persiste rien, ne modifie pas le store ni le localStorage.
 */

import { SYNTHESE_SEED } from "../data/airbnbSyntheseSeed";
import type {
  AirbnbListingId,
  AirbnbState,
  AirbnbSyntheseRow,
} from "../types/airbnb";
import { AIRBNB_LISTINGS } from "../types/airbnb";
import {
  getAirbnbMonthDetail,
  type SyntheseGroupedBucket,
  type SyntheseGroupedSegmentId,
} from "./airbnbStorage";

export type SyntheseGranularity = "year" | "month";

export type SyntheseBar = {
  key: string;
  label: string;
  value: number;
};

export type SyntheseViewQuery = {
  granularity: SyntheseGranularity;
  /** Premier mois inclus (`YYYY-MM`). */
  fromMonth: string;
  /** Dernier mois inclus (`YYYY-MM`). */
  toMonth: string;
  /**
   * Logements / annonces à retenir.
   * Tableau vide = tous les logements.
   */
  listingIds: AirbnbListingId[];
};

const YM_RE = /^(\d{4})-(\d{2})$/;

export function isYearMonth(value: string): boolean {
  const m = YM_RE.exec(value);
  if (!m) return false;
  const month = Number(m[2]);
  return month >= 1 && month <= 12;
}

export function currentYearMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function yearOfMonth(month: string): number {
  const y = parseInt(month.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
}

export function clampYearMonth(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function monthsInclusive(fromMonth: string, toMonth: string): string[] {
  const [from, to] = clampYearMonth(fromMonth, toMonth);
  if (!isYearMonth(from) || !isYearMonth(to)) return [];
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 240) break;
  }
  return out;
}

export function yearsInclusive(fromMonth: string, toMonth: string): number[] {
  const [from, to] = clampYearMonth(fromMonth, toMonth);
  const y0 = yearOfMonth(from);
  const y1 = yearOfMonth(to);
  if (!y0 || !y1) return [];
  const out: number[] = [];
  for (let y = y0; y <= y1; y += 1) out.push(y);
  return out;
}

function monthLabelFr(month: string): string {
  const y = yearOfMonth(month);
  const m = Number(month.slice(5, 7));
  if (!y || !m) return month;
  return new Date(y, m - 1, 15).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

/** Mois présents dans la synthèse (seed + saisie + corrections fichier). */
export function listSyntheseDataMonths(
  state: AirbnbState,
  seed: AirbnbSyntheseRow[] = SYNTHESE_SEED,
): string[] {
  const months = new Set<string>();
  for (const r of seed) {
    if (isYearMonth(r.month)) months.add(r.month);
  }
  for (const v of state.ventilations) {
    if (isYearMonth(v.month)) months.add(v.month);
  }
  for (const m of Object.keys(state.syntheseFichierOverrides)) {
    if (isYearMonth(m)) months.add(m);
  }
  return [...months].sort();
}

export function listSyntheseSelectYears(
  dataMonths: string[],
  now: Date = new Date(),
): number[] {
  const years = new Set<number>();
  years.add(now.getFullYear());
  for (const m of dataMonths) {
    const y = yearOfMonth(m);
    if (y) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}

export function defaultSyntheseViewQuery(
  dataMonths: string[],
  now: Date = new Date(),
): SyntheseViewQuery {
  const cur = currentYearMonth(now);
  const first = dataMonths[0];
  const lastData = dataMonths[dataMonths.length - 1];
  const fromMonth = first && first < cur ? first : `${now.getFullYear()}-01`;
  const toMonth =
    lastData && lastData > cur ? lastData : cur;
  return {
    granularity: "year",
    fromMonth,
    toMonth,
    listingIds: [],
  };
}

export function normalizeSyntheseViewQuery(
  query: SyntheseViewQuery,
): SyntheseViewQuery {
  const [fromMonth, toMonth] = clampYearMonth(
    isYearMonth(query.fromMonth) ? query.fromMonth : "1970-01",
    isYearMonth(query.toMonth) ? query.toMonth : "1970-01",
  );
  const listingIds = AIRBNB_LISTINGS.map((l) => l.id).filter((id) =>
    query.listingIds.includes(id),
  );
  const granularity: SyntheseGranularity =
    query.granularity === "month" ? "month" : "year";
  return { granularity, fromMonth, toMonth, listingIds };
}

export function resolvedListingIds(
  listingIds: AirbnbListingId[],
): AirbnbListingId[] {
  if (listingIds.length === 0) return AIRBNB_LISTINGS.map((l) => l.id);
  return AIRBNB_LISTINGS.map((l) => l.id).filter((id) => listingIds.includes(id));
}

export function isAllListingsSelected(listingIds: AirbnbListingId[]): boolean {
  return (
    listingIds.length === 0 ||
    listingIds.length === AIRBNB_LISTINGS.length
  );
}

type MonthSlice = {
  month: string;
  source: "saisie" | "fichier";
  totalBenefice: number;
  totalRevenus: number;
  byListing: Record<AirbnbListingId, { benefice: number; revenus: number }>;
  fichierBenefice: number;
  fichierRevenus: number;
};

function emptyListingAcc(): Record<
  AirbnbListingId,
  { benefice: number; revenus: number }
> {
  const o = {} as Record<AirbnbListingId, { benefice: number; revenus: number }>;
  for (const { id } of AIRBNB_LISTINGS) {
    o[id] = { benefice: 0, revenus: 0 };
  }
  return o;
}

function sliceMonth(
  state: AirbnbState,
  month: string,
  seed: AirbnbSyntheseRow[],
): MonthSlice {
  const d = getAirbnbMonthDetail(state, month, seed);
  const byListing = emptyListingAcc();
  for (const row of d.listings) {
    byListing[row.id] = {
      benefice: row.beneficeNet ?? 0,
      revenus: row.totalFactureVentilation ?? 0,
    };
  }
  const fichierBenefice = d.source === "fichier" ? d.totalPercuBrut : 0;
  const fichierRevenus = d.source === "fichier" ? d.totalFacture : 0;
  return {
    month,
    source: d.source,
    totalBenefice: d.source === "saisie" ? d.beneficeNet : d.totalPercuBrut,
    totalRevenus: d.totalFacture,
    byListing,
    fichierBenefice,
    fichierRevenus,
  };
}

function filteredMonthTotals(
  slice: MonthSlice,
  listingIds: AirbnbListingId[],
  allListings: boolean,
): { benefice: number; revenus: number } {
  if (allListings) {
    return { benefice: slice.totalBenefice, revenus: slice.totalRevenus };
  }
  if (slice.source !== "saisie") {
    return { benefice: 0, revenus: 0 };
  }
  let benefice = 0;
  let revenus = 0;
  for (const id of listingIds) {
    benefice += slice.byListing[id]?.benefice ?? 0;
    revenus += slice.byListing[id]?.revenus ?? 0;
  }
  return { benefice, revenus };
}

export type SyntheseViewTotals = {
  benefices: number;
  revenus: number;
  /** Filtre logement : les mois « fichier Excel » n’ont pas de ventilation par annonce. */
  fichierExcluDuFiltreLogement: boolean;
};

export function computeSyntheseViewTotals(
  state: AirbnbState,
  query: SyntheseViewQuery,
  seed: AirbnbSyntheseRow[] = SYNTHESE_SEED,
): SyntheseViewTotals {
  const q = normalizeSyntheseViewQuery(query);
  const ids = resolvedListingIds(q.listingIds);
  const allListings = isAllListingsSelected(q.listingIds);
  const months = monthsInclusive(q.fromMonth, q.toMonth);
  let benefices = 0;
  let revenus = 0;
  let fichierExcluDuFiltreLogement = false;
  for (const month of months) {
    const slice = sliceMonth(state, month, seed);
    if (!allListings && slice.source === "fichier" && (slice.fichierBenefice !== 0 || slice.fichierRevenus !== 0)) {
      fichierExcluDuFiltreLogement = true;
    }
    const t = filteredMonthTotals(slice, ids, allListings);
    benefices += t.benefice;
    revenus += t.revenus;
  }
  return { benefices, revenus, fichierExcluDuFiltreLogement };
}

function segmentsForSlice(
  slice: MonthSlice,
  listingIds: AirbnbListingId[],
  includeFichier: boolean,
): { id: SyntheseGroupedSegmentId; value: number }[] {
  const segments: { id: SyntheseGroupedSegmentId; value: number }[] = listingIds.map(
    (id) => ({
      id,
      value: slice.byListing[id]?.benefice ?? 0,
    }),
  );
  if (includeFichier) {
    segments.push({ id: "_fichier", value: slice.fichierBenefice });
  }
  return segments;
}

export function buildSyntheseTotalBars(
  state: AirbnbState,
  query: SyntheseViewQuery,
  seed: AirbnbSyntheseRow[] = SYNTHESE_SEED,
): SyntheseBar[] {
  const q = normalizeSyntheseViewQuery(query);
  const ids = resolvedListingIds(q.listingIds);
  const allListings = isAllListingsSelected(q.listingIds);
  if (q.granularity === "year") {
    const years = yearsInclusive(q.fromMonth, q.toMonth);
    if (years.length === 0) {
      return [{ key: "empty", label: String(yearOfMonth(q.toMonth) || ""), value: 0 }];
    }
    return years.map((y) => {
      const from = y === yearOfMonth(q.fromMonth) ? q.fromMonth : `${y}-01`;
      const to = y === yearOfMonth(q.toMonth) ? q.toMonth : `${y}-12`;
      let value = 0;
      for (const month of monthsInclusive(from, to)) {
        value += filteredMonthTotals(sliceMonth(state, month, seed), ids, allListings)
          .benefice;
      }
      return { key: `year-${y}`, label: String(y), value };
    });
  }
  const months = monthsInclusive(q.fromMonth, q.toMonth);
  if (months.length === 0) {
    return [{ key: "empty", label: q.toMonth, value: 0 }];
  }
  return months.map((month) => ({
    key: month,
    label: monthLabelFr(month),
    value: filteredMonthTotals(sliceMonth(state, month, seed), ids, allListings)
      .benefice,
  }));
}

export function buildSyntheseGroupedBars(
  state: AirbnbState,
  query: SyntheseViewQuery,
  seed: AirbnbSyntheseRow[] = SYNTHESE_SEED,
): SyntheseGroupedBucket[] {
  const q = normalizeSyntheseViewQuery(query);
  const ids = resolvedListingIds(q.listingIds);
  const includeFichier = isAllListingsSelected(q.listingIds);

  if (q.granularity === "year") {
    const years = yearsInclusive(q.fromMonth, q.toMonth);
    if (years.length === 0) {
      return [
        {
          key: "empty",
          label: String(yearOfMonth(q.toMonth) || ""),
          segments: [
            ...ids.map((id) => ({ id, value: 0 })),
            ...(includeFichier ? [{ id: "_fichier" as const, value: 0 }] : []),
          ],
        },
      ];
    }
    return years.map((y) => {
      const from = y === yearOfMonth(q.fromMonth) ? q.fromMonth : `${y}-01`;
      const to = y === yearOfMonth(q.toMonth) ? q.toMonth : `${y}-12`;
      const acc = emptyListingAcc();
      let fichier = 0;
      for (const month of monthsInclusive(from, to)) {
        const slice = sliceMonth(state, month, seed);
        for (const id of ids) {
          acc[id].benefice += slice.byListing[id]?.benefice ?? 0;
        }
        if (includeFichier) fichier += slice.fichierBenefice;
      }
      const segments: { id: SyntheseGroupedSegmentId; value: number }[] = [
        ...ids.map((id) => ({ id, value: acc[id].benefice })),
        ...(includeFichier ? [{ id: "_fichier" as const, value: fichier }] : []),
      ];
      return { key: `year-${y}`, label: String(y), segments };
    });
  }

  const months = monthsInclusive(q.fromMonth, q.toMonth);
  if (months.length === 0) {
    return [
      {
        key: "empty",
        label: q.toMonth,
        segments: [
          ...ids.map((id) => ({ id, value: 0 })),
          ...(includeFichier ? [{ id: "_fichier" as const, value: 0 }] : []),
        ],
      },
    ];
  }
  return months.map((month) => ({
    key: month,
    label: monthLabelFr(month),
    segments: segmentsForSlice(sliceMonth(state, month, seed), ids, includeFichier),
  }));
}
