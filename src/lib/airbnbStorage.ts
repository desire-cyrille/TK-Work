import { SYNTHESE_SEED } from "../data/airbnbSyntheseSeed";
import type {
  AirbnbChargesGlobal,
  AirbnbListingCharges,
  AirbnbListingId,
  AirbnbMonthCharges,
  AirbnbMonthDetail,
  AirbnbMonthVentilation,
  AirbnbSyntheseRow,
  AirbnbState,
  AirbnbVentilationLine,
} from "../types/airbnb";
import { AIRBNB_LISTINGS, airbnbListingIsActiveInMonth } from "../types/airbnb";

const STORAGE_KEY = "tk-gestion-airbnb-ventilation-v1";

function parseRaw(s: string): number {
  const n = Number(String(s).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Saisie formulaire (virgule / espaces acceptés). */
export function parseEuroInputDisplay(s: string): number {
  return parseRaw(s);
}

function normalizeSyntheseFichierOverrides(
  raw: unknown
): Record<string, { benefices: number; revenus: number }> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, { benefices: number; revenus: number }> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k || typeof v !== "object" || v == null) continue;
    const o = v as { benefices?: unknown; revenus?: unknown };
    const benefices =
      typeof o.benefices === "number" && Number.isFinite(o.benefices)
        ? o.benefices
        : 0;
    const revenus =
      typeof o.revenus === "number" && Number.isFinite(o.revenus)
        ? o.revenus
        : 0;
    out[k] = { benefices, revenus };
  }
  return out;
}

/** Ligne synthèse « fichier » : correction manuelle ou seed Excel. */
export function getFichierSyntheseRow(
  state: AirbnbState,
  month: string,
  seed: AirbnbSyntheseRow[] = SYNTHESE_SEED
): AirbnbSyntheseRow | undefined {
  const o = state.syntheseFichierOverrides[month];
  if (o) return { month, benefices: o.benefices, revenus: o.revenus };
  return seed.find((r) => r.month === month);
}

function emptyListingsRecord(): Record<AirbnbListingId, AirbnbVentilationLine[]> {
  const o = {} as Record<AirbnbListingId, AirbnbVentilationLine[]>;
  for (const { id } of AIRBNB_LISTINGS) {
    o[id] = [];
  }
  return o;
}

function emptyChargesListingsRecord(): Record<AirbnbListingId, AirbnbListingCharges> {
  const o = {} as Record<AirbnbListingId, AirbnbListingCharges>;
  for (const { id } of AIRBNB_LISTINGS) {
    o[id] = emptyListingCharges();
  }
  return o;
}

export function emptyListingCharges(): AirbnbListingCharges {
  return {
    loyer: "",
    electricite: "",
    gaz: "",
    internet: "",
    fournitureAlimentaires: "",
    fournitureMenagere: "",
    assurance: "",
  };
}

function defaultMonthCharges(month: string): AirbnbMonthCharges {
  return { month, listings: emptyChargesListingsRecord() };
}

function cloneMonthCharges(c: AirbnbMonthCharges): AirbnbMonthCharges {
  const listings = emptyChargesListingsRecord();
  for (const { id } of AIRBNB_LISTINGS) {
    listings[id] = { ...emptyListingCharges(), ...(c.listings[id] ?? {}) };
  }
  return { month: c.month, listings };
}

export function defaultChargesGlobal(): AirbnbChargesGlobal {
  return { listings: emptyChargesListingsRecord() };
}

export function cloneChargesGlobal(c: AirbnbChargesGlobal): AirbnbChargesGlobal {
  const listings = emptyChargesListingsRecord();
  for (const { id } of AIRBNB_LISTINGS) {
    listings[id] = { ...emptyListingCharges(), ...(c.listings[id] ?? {}) };
  }
  return { listings };
}

function listingHasAnyChargeAmount(row: AirbnbListingCharges): boolean {
  return (
    parseRaw(row.loyer) !== 0 ||
    parseRaw(row.electricite) !== 0 ||
    parseRaw(row.gaz) !== 0 ||
    parseRaw(row.internet) !== 0 ||
    parseRaw(row.fournitureAlimentaires) !== 0 ||
    parseRaw(row.fournitureMenagere) !== 0 ||
    parseRaw(row.assurance) !== 0
  );
}

export function listingChargesTotal(c: AirbnbListingCharges): number {
  return (
    parseRaw(c.loyer) +
    parseRaw(c.electricite) +
    parseRaw(c.gaz) +
    parseRaw(c.internet) +
    parseRaw(c.fournitureAlimentaires) +
    parseRaw(c.fournitureMenagere) +
    parseRaw(c.assurance)
  );
}

export function sumChargesGlobal(state: AirbnbState): number {
  let s = 0;
  for (const { id } of AIRBNB_LISTINGS) {
    s += listingChargesTotal(
      state.chargesGlobal.listings[id] ?? emptyListingCharges()
    );
  }
  return s;
}

function monthChargesHasData(c: AirbnbMonthCharges): boolean {
  for (const { id } of AIRBNB_LISTINGS) {
    const row = c.listings[id];
    if (!row) continue;
    if (listingHasAnyChargeAmount(row)) return true;
  }
  return false;
}

function listingVentilationTotals(lines: AirbnbVentilationLine[]): {
  benefice: number;
  totalFacture: number;
} {
  let benefice = 0;
  let totalFacture = 0;
  for (const row of lines) {
    benefice += lineBenefice(row);
    totalFacture += lineTotalFacture(row);
  }
  return { benefice, totalFacture };
}

export function getAirbnbMonthDetail(
  state: AirbnbState,
  month: string,
  seed: AirbnbSyntheseRow[] = SYNTHESE_SEED
): AirbnbMonthDetail {
  const vent = state.ventilations.find((v) => v.month === month);
  const hasVent = !!(vent && monthVentilationHasData(vent));
  const listings = AIRBNB_LISTINGS.map(({ id, label }) => {
    const lines = hasVent && vent ? vent.listings[id] : [];
    const vTot = listingVentilationTotals(lines);
    const active = airbnbListingIsActiveInMonth(id, month);
    const beneficeVentilation = !hasVent
      ? null
      : active
        ? vTot.benefice
        : 0;
    const totalFactureVentilation = !hasVent
      ? null
      : active
        ? vTot.totalFacture
        : 0;
    const c =
      state.chargesGlobal.listings[id] ?? emptyListingCharges();
    const fullCharges = listingChargesTotal(c);
    const charges = hasVent && !active ? 0 : fullCharges;
    const beneficeNet =
      beneficeVentilation != null ? beneficeVentilation - charges : null;
    return {
      id,
      label,
      beneficeVentilation,
      totalFactureVentilation,
      charges,
      beneficeNet,
    };
  });

  let totalPercuBrut: number;
  let totalFacture: number;
  if (hasVent && vent) {
    const t = computeVentilationMonthTotals(vent);
    totalPercuBrut = t.benefices;
    totalFacture = t.revenus;
  } else {
    const fichierRow = getFichierSyntheseRow(state, month, seed);
    totalPercuBrut = fichierRow?.benefices ?? 0;
    totalFacture = fichierRow?.revenus ?? 0;
  }

  const chargesTotal = listings.reduce((s, x) => s + x.charges, 0);
  /** Données fichier : pas de déduction des charges sur le consolidé (uniquement en saisie ventilation). */
  const beneficeNet = hasVent
    ? totalPercuBrut - chargesTotal
    : totalPercuBrut;

  return {
    month,
    source: hasVent ? "saisie" : "fichier",
    totalPercuBrut,
    totalFacture,
    chargesTotal,
    beneficeNet,
    listings,
  };
}

export function newLine(): AirbnbVentilationLine {
  return {
    id: crypto.randomUUID(),
    libelle: "",
    facture: "",
    frais: "",
    deduction: "",
  };
}

export function defaultMonthVentilation(month: string): AirbnbMonthVentilation {
  const listings = emptyListingsRecord();
  for (const { id } of AIRBNB_LISTINGS) {
    listings[id] = [newLine()];
  }
  return { month, listings };
}

export function cloneMonthVentilation(v: AirbnbMonthVentilation): AirbnbMonthVentilation {
  const listings = emptyListingsRecord();
  for (const { id } of AIRBNB_LISTINGS) {
    listings[id] = v.listings[id].map((r) => ({ ...r }));
  }
  return { month: v.month, listings };
}

export function lineBenefice(l: AirbnbVentilationLine): number {
  return parseRaw(l.facture) + parseRaw(l.frais) - parseRaw(l.deduction);
}

/**
 * Répartition des charges de l’annonce sur chaque ligne au prorata du bénéfice
 * brut (si la somme des bruts est nulle : parts égales sur les lignes).
 * La somme des valeurs retournées = somme des bénéfices bruts − charges.
 */
export function lineNetBeneficesWithListingCharges(
  lines: AirbnbVentilationLine[],
  listingCharges: number
): number[] {
  const n = lines.length;
  if (n === 0) return [];
  const gross = lines.map(lineBenefice);
  const sumGross = gross.reduce((a, b) => a + b, 0);
  if (sumGross !== 0) {
    return gross.map((g) => g - (listingCharges * g) / sumGross);
  }
  const share = listingCharges / n;
  return gross.map((g) => g - share);
}

export function lineTotalFacture(l: AirbnbVentilationLine): number {
  return parseRaw(l.facture) + parseRaw(l.frais);
}

export function computeVentilationMonthTotals(v: AirbnbMonthVentilation): {
  benefices: number;
  revenus: number;
  deductions: number;
} {
  let benefices = 0;
  let revenus = 0;
  let deductions = 0;
  for (const { id } of AIRBNB_LISTINGS) {
    if (!airbnbListingIsActiveInMonth(id, v.month)) continue;
    for (const row of v.listings[id]) {
      benefices += lineBenefice(row);
      revenus += lineTotalFacture(row);
      deductions += parseRaw(row.deduction);
    }
  }
  return { benefices, revenus, deductions };
}

/** Une saisie est « réelle » si au moins un montant ou libellé est renseigné */
export function monthVentilationHasData(v: AirbnbMonthVentilation): boolean {
  for (const { id } of AIRBNB_LISTINGS) {
    if (!airbnbListingIsActiveInMonth(id, v.month)) continue;
    for (const row of v.listings[id]) {
      if (row.libelle.trim()) return true;
      if (parseRaw(row.facture) !== 0) return true;
      if (parseRaw(row.frais) !== 0) return true;
      if (parseRaw(row.deduction) !== 0) return true;
    }
  }
  return false;
}

function normalizeChargesGlobalFromStorage(
  raw: unknown
): AirbnbChargesGlobal | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<AirbnbChargesGlobal>;
  if (!o.listings || typeof o.listings !== "object") return null;
  const base = defaultChargesGlobal();
  for (const { id } of AIRBNB_LISTINGS) {
    const row = (o.listings as Record<string, Partial<AirbnbListingCharges>>)[
      id
    ];
    base.listings[id] = { ...emptyListingCharges(), ...row };
  }
  return base;
}

function migrateFromLegacyChargesArray(arr: AirbnbMonthCharges[]): AirbnbChargesGlobal {
  const withData = arr.filter(monthChargesHasData);
  if (withData.length === 0) return defaultChargesGlobal();
  const sorted = [...withData].sort((a, b) => a.month.localeCompare(b.month));
  const pick = sorted[sorted.length - 1]!;
  return { listings: cloneMonthCharges(pick).listings };
}

function normalizeChargesFromStorage(raw: unknown): AirbnbMonthCharges[] {
  if (!Array.isArray(raw)) return [];
  const out: AirbnbMonthCharges[] = [];
  for (const item of raw) {
    const m = item as Partial<AirbnbMonthCharges>;
    if (!m.month || typeof m.month !== "string") continue;
    const base = defaultMonthCharges(m.month);
    if (m.listings && typeof m.listings === "object") {
      for (const { id } of AIRBNB_LISTINGS) {
        const row = (m.listings as Record<string, Partial<AirbnbListingCharges>>)[id];
        base.listings[id] = { ...emptyListingCharges(), ...row };
      }
    }
    out.push(base);
  }
  return out;
}

const emptyState = (): AirbnbState => ({
  version: 1,
  ventilations: [],
  chargesGlobal: defaultChargesGlobal(),
  syntheseFichierOverrides: {},
});

export function loadAirbnbState(): AirbnbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<AirbnbState> & { charges?: unknown };
    if (p.version !== 1 || !Array.isArray(p.ventilations)) {
      return emptyState();
    }
    const fromGlobal = normalizeChargesGlobalFromStorage(p.chargesGlobal);
    const chargesGlobal = fromGlobal
      ? fromGlobal
      : migrateFromLegacyChargesArray(normalizeChargesFromStorage(p.charges));
    return {
      version: 1,
      ventilations: p.ventilations as AirbnbMonthVentilation[],
      chargesGlobal,
      syntheseFichierOverrides: normalizeSyntheseFichierOverrides(
        (p as Partial<AirbnbState>).syntheseFichierOverrides
      ),
    };
  } catch {
    return emptyState();
  }
}

export function saveAirbnbState(state: AirbnbState): void {
  const payload: AirbnbState = {
    version: 1,
    ventilations: state.ventilations,
    chargesGlobal: state.chargesGlobal,
    syntheseFichierOverrides: state.syntheseFichierOverrides ?? {},
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Synthèse : priorité aux mois saisis dans Ventilation, sinon données initiales (classeur).
 * Les charges globales ne sont déduites que pour les mois en saisie ventilation ; les montants
 * fichier / historique restent tels que dans la source (sans déduction charges).
 */
export function buildMergedSynthese(
  state: AirbnbState,
  seed: AirbnbSyntheseRow[] = SYNTHESE_SEED
): { month: string; benefices: number; revenus: number; source: "saisie" | "fichier" }[] {
  const fromVent = new Map<string, { benefices: number; revenus: number }>();
  for (const v of state.ventilations) {
    if (monthVentilationHasData(v)) {
      fromVent.set(v.month, computeVentilationMonthTotals(v));
    }
  }
  const months = new Set<string>();
  seed.forEach((r) => months.add(r.month));
  fromVent.forEach((_, m) => months.add(m));
  Object.keys(state.syntheseFichierOverrides).forEach((m) => months.add(m));
  const sorted = [...months].sort();
  const chargesDeduction = sumChargesGlobal(state);
  return sorted.map((month) => {
    const vent = fromVent.get(month);
    if (vent) {
      return {
        month,
        benefices: vent.benefices - chargesDeduction,
        revenus: vent.revenus,
        source: "saisie" as const,
      };
    }
    const fichierRow = getFichierSyntheseRow(state, month, seed);
    if (fichierRow) {
      return {
        month,
        benefices: fichierRow.benefices,
        revenus: fichierRow.revenus,
        source: "fichier" as const,
      };
    }
    return {
      month,
      benefices: 0,
      revenus: 0,
      source: "fichier" as const,
    };
  });
}

export type SyntheseGroupedSegmentId = AirbnbListingId | "_fichier";

export type SyntheseGroupedBucket = {
  key: string;
  label: string;
  segments: { id: SyntheseGroupedSegmentId; value: number }[];
};

function netBeneficeVentListing(
  state: AirbnbState,
  vent: AirbnbMonthVentilation,
  listingId: AirbnbListingId
): number {
  if (!airbnbListingIsActiveInMonth(listingId, vent.month)) return 0;
  const gross = listingVentilationTotals(vent.listings[listingId]).benefice;
  const ch = listingChargesTotal(
    state.chargesGlobal.listings[listingId] ?? emptyListingCharges()
  );
  return gross - ch;
}

/**
 * Même découpage temporel que la vue « total » (années agrégées + mois de l’année en cours) ;
 * chaque période contient un montant par annonce (saisie ventilation net après charges annonce)
 * et éventuellement une part « Fichier » pour les mois sans ventilation (somme des bénéfices seed).
 */
export function buildSyntheseBarGroupedSeries(
  state: AirbnbState,
  seed: AirbnbSyntheseRow[] = SYNTHESE_SEED,
  now: Date = new Date()
): SyntheseGroupedBucket[] {
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;

  const fromVent = new Map<string, AirbnbMonthVentilation>();
  for (const v of state.ventilations) {
    if (monthVentilationHasData(v)) {
      fromVent.set(v.month, v);
    }
  }
  const seedMap = new Map<string, AirbnbSyntheseRow>(
    seed.map((r) => [r.month, r])
  );
  for (const [m, o] of Object.entries(state.syntheseFichierOverrides)) {
    seedMap.set(m, { month: m, benefices: o.benefices, revenus: o.revenus });
  }
  const months = new Set<string>();
  seed.forEach((r) => months.add(r.month));
  fromVent.forEach((_, m) => months.add(m));
  Object.keys(state.syntheseFichierOverrides).forEach((m) => months.add(m));
  const sortedMonths = [...months].sort();
  if (sortedMonths.length === 0) {
    const segments: { id: SyntheseGroupedSegmentId; value: number }[] = [
      ...AIRBNB_LISTINGS.map(({ id }) => ({ id, value: 0 })),
      { id: "_fichier", value: 0 },
    ];
    return [{ key: "empty", label: String(curY), segments }];
  }

  const years = new Set<number>();
  for (const m of sortedMonths) {
    const y = parseInt(m.slice(0, 4), 10);
    if (!Number.isNaN(y)) years.add(y);
  }
  const sortedY = [...years].sort((a, b) => a - b);

  function pushYear(y: number, out: SyntheseGroupedBucket[]): void {
    const acc: Record<AirbnbListingId, number> = {} as Record<
      AirbnbListingId,
      number
    >;
    for (const { id } of AIRBNB_LISTINGS) acc[id] = 0;
    let fichier = 0;
    for (const month of sortedMonths) {
      if (parseInt(month.slice(0, 4), 10) !== y) continue;
      const vent = fromVent.get(month);
      const seedRow = seedMap.get(month);
      if (vent) {
        for (const { id } of AIRBNB_LISTINGS) {
          acc[id] += netBeneficeVentListing(state, vent, id);
        }
      } else if (seedRow) {
        fichier += seedRow.benefices;
      }
    }
    const segments: { id: SyntheseGroupedSegmentId; value: number }[] = [
      ...AIRBNB_LISTINGS.map(({ id }) => ({ id, value: acc[id] })),
      { id: "_fichier", value: fichier },
    ];
    out.push({ key: `year-${y}`, label: String(y), segments });
  }

  function segmentsSingleMonth(monthKey: string): {
    id: SyntheseGroupedSegmentId;
    value: number;
  }[] {
    const vent = fromVent.get(monthKey);
    const seedRow = seedMap.get(monthKey);
    const segments: { id: SyntheseGroupedSegmentId; value: number }[] = [];
    if (vent) {
      for (const { id } of AIRBNB_LISTINGS) {
        segments.push({ id, value: netBeneficeVentListing(state, vent, id) });
      }
    } else {
      for (const { id } of AIRBNB_LISTINGS) {
        segments.push({ id, value: 0 });
      }
    }
    let fichier = 0;
    if (!vent && seedRow) fichier = seedRow.benefices;
    segments.push({ id: "_fichier", value: fichier });
    return segments;
  }

  const out: SyntheseGroupedBucket[] = [];
  for (const y of sortedY) {
    if (y < curY) {
      pushYear(y, out);
    } else if (y === curY) {
      for (let m = 1; m <= curM; m++) {
        const mk = `${y}-${String(m).padStart(2, "0")}`;
        const label = new Date(y, m - 1, 15).toLocaleDateString("fr-FR", {
          month: "short",
          year: "2-digit",
        });
        out.push({ key: mk, label, segments: segmentsSingleMonth(mk) });
      }
    } else {
      pushYear(y, out);
    }
  }
  return out;
}

export function formatMonthFr(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}
