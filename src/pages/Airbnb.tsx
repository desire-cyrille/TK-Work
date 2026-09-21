import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PageFrame } from "../components/PageFrame";
import {
  buildMergedSynthese,
  cloneChargesGlobal,
  cloneMonthVentilation,
  computeVentilationMonthTotals,
  defaultMonthVentilation,
  emptyListingCharges,
  formatMonthFr,
  getAirbnbMonthDetail,
  lineBenefice,
  lineNetBeneficesWithListingCharges,
  lineTotalFacture,
  listingChargesTotal,
  loadAirbnbState,
  newLine,
  parseEuroInputDisplay,
  saveAirbnbState,
  type SyntheseGroupedBucket,
} from "../lib/airbnbStorage";
import {
  buildSyntheseGroupedBars,
  buildSyntheseTotalBars,
  computeSyntheseViewTotals,
  currentYearMonth,
  defaultSyntheseViewQuery,
  isAllListingsSelected,
  listSyntheseDataMonths,
  listSyntheseSelectYears,
  monthsInclusive,
  yearOfMonth,
  type SyntheseBar,
  type SyntheseGranularity,
  type SyntheseViewQuery,
} from "../lib/airbnbSyntheseView";
import {
  AIRBNB_LISTINGS,
  AIRBNB_LISTING_ACTIVE_FROM,
  airbnbListingIsActiveInMonth,
  type AirbnbChargesGlobal,
  type AirbnbListingCharges,
  type AirbnbListingId,
  type AirbnbMonthVentilation,
  type AirbnbState,
  type AirbnbVentilationLine,
} from "../types/airbnb";
import styles from "./Airbnb.module.css";

type TabId = "ventilation" | "charges" | "synthese";

function initialMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);

/** Couleur bénéfice : vert si strictement positif, rouge si strictement négatif, neutre sinon. */
function benefClass(n: number): string {
  if (n > 0) return styles.benefPos;
  if (n < 0) return styles.benefNeg;
  return "";
}

function listingTotals(lines: AirbnbVentilationLine[]) {
  let b = 0;
  let t = 0;
  for (const row of lines) {
    b += lineBenefice(row);
    t += lineTotalFacture(row);
  }
  return { benefice: b, totalFacture: t };
}

const CHARGE_FIELDS: {
  key: keyof AirbnbListingCharges;
  label: string;
}[] = [
  { key: "loyer", label: "Loyer" },
  { key: "electricite", label: "Électricité" },
  { key: "gaz", label: "Gaz" },
  { key: "internet", label: "Internet" },
  { key: "fournitureAlimentaires", label: "Fournitures alimentaires" },
  { key: "fournitureMenagere", label: "Fournitures ménagères" },
  { key: "assurance", label: "Assurance" },
];

type SyntheseChartMode = "total" | "parAnnonce";

const SYNTHESE_SEGMENT_COLORS: Record<string, string> = {
  petitBureau: "#0ea5e9",
  familiale: "#8b5cf6",
  cosyChill: "#f59e0b",
  ptitDeuxieme: "#ec4899",
  _fichier: "#64748b",
};

function syntheseSegmentLegendLabel(id: string): string {
  if (id === "_fichier") return "Fichier (non ventilé)";
  return AIRBNB_LISTINGS.find((l) => l.id === id)?.label ?? id;
}

/** Diagramme en bâtons : ordonnées (€) à gauche, abscisse (années / mois) en bas. */
function SyntheseChart({
  mode,
  barsTotal,
  groupedBuckets,
}: {
  mode: SyntheseChartMode;
  barsTotal: SyntheseBar[] | null;
  groupedBuckets: SyntheseGroupedBucket[] | null;
}) {

  const n =
    mode === "total"
      ? Math.max(barsTotal!.length, 1)
      : Math.max(groupedBuckets!.length, 1);

  const flatVals: number[] =
    mode === "total"
      ? barsTotal!.map((b) => b.value)
      : groupedBuckets!.flatMap((b) => b.segments.map((s) => s.value));

  const w = Math.max(920, n * (mode === "parAnnonce" ? 92 : 56));
  const h = 340;
  const margin = { top: 28, right: 20, bottom: 92, left: 58 };
  const cw = w - margin.left - margin.right;
  const ch = h - margin.top - margin.bottom;

  const minV = Math.min(0, ...flatVals);
  const maxV = Math.max(0, ...flatVals, 1);
  const rng = maxV - minV || 1;
  const pad = rng * 0.08;
  const yLo = minV - pad;
  const yHi = maxV + pad;
  const ySpan = yHi - yLo || 1;

  const yScale = (v: number) =>
    margin.top + ch - ((v - yLo) / ySpan) * ch;
  const zeroY = yScale(0);

  const gap = Math.min(6, cw / (n * 5));
  const bandW = cw / n;
  const barW = Math.max(6, bandW - gap);

  const tickN = 6;
  const yTicks = Array.from(
    { length: tickN },
    (_, i) => yLo + (i / Math.max(tickN - 1, 1)) * (yHi - yLo)
  );

  const labelY = h - margin.bottom + 18;

  function valueLabelY(
    v: number,
    top: number,
    bh: number
  ): { y: number; baseline: "auto" | "hanging" } {
    if (v > 0) return { y: top - 4, baseline: "auto" };
    if (v < 0) return { y: top + bh + 4, baseline: "hanging" };
    return { y: zeroY - 5, baseline: "auto" };
  }

  let barsBody: ReactNode;
  if (mode === "total") {
    barsBody = barsTotal!.map((b, i) => {
      const cx = margin.left + i * bandW + bandW / 2;
      const xBar = cx - barW / 2;
      const yVal = yScale(b.value);
      const top = Math.min(zeroY, yVal);
      const bh = Math.max(Math.abs(zeroY - yVal), b.value === 0 ? 2 : 0.5);
      const fill =
        b.value > 0
          ? "rgba(34, 197, 94, 0.9)"
          : b.value < 0
            ? "rgba(239, 68, 68, 0.88)"
            : "rgba(148, 163, 184, 0.5)";
      const vl = valueLabelY(b.value, top, bh);
      return (
        <g key={b.key}>
          <rect x={xBar} y={top} width={barW} height={bh} rx={4} fill={fill} />
          <text
            x={cx}
            y={vl.y}
            textAnchor="middle"
            dominantBaseline={vl.baseline}
            fill="var(--workspace-text)"
            fontSize="9.5"
            fontWeight="600"
          >
            {eur(b.value)}
          </text>
          <text
            x={cx}
            y={labelY}
            textAnchor="end"
            fill="var(--workspace-muted)"
            fontSize="10"
            transform={`rotate(-42 ${cx} ${labelY})`}
          >
            {b.label}
          </text>
        </g>
      );
    });
  } else {
    barsBody = groupedBuckets!.map((b, i) => {
      const groupLeft = margin.left + i * bandW + gap / 2;
      const wavail = bandW - gap;
      const slotW = Math.max(3, wavail / b.segments.length - 0.75);
      const cx = groupLeft + wavail / 2;
      return (
        <g key={b.key}>
          {b.segments.map((seg, j) => {
            const x = groupLeft + j * (slotW + 0.75);
            const tcx = x + slotW / 2;
            const yVal = yScale(seg.value);
            const top = Math.min(zeroY, yVal);
            const bh = Math.max(
              Math.abs(zeroY - yVal),
              seg.value === 0 ? 1.5 : 0.5
            );
            const fill = SYNTHESE_SEGMENT_COLORS[seg.id] ?? "#94a3b8";
            const vl = valueLabelY(seg.value, top, bh);
            const showVal = Math.abs(seg.value) >= 0.01;
            return (
              <g key={`${b.key}-${seg.id}`}>
                <rect
                  x={x}
                  y={top}
                  width={slotW}
                  height={bh}
                  rx={2}
                  fill={fill}
                  fillOpacity={seg.value === 0 ? 0.22 : 0.9}
                />
                {showVal ? (
                  <text
                    x={tcx}
                    y={vl.y}
                    textAnchor="middle"
                    dominantBaseline={vl.baseline}
                    fill="var(--workspace-text)"
                    fontSize={slotW < 18 ? 7 : 8}
                    fontWeight="600"
                  >
                    {eur(seg.value)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <text
            x={cx}
            y={labelY}
            textAnchor="end"
            fill="var(--workspace-muted)"
            fontSize="10"
            transform={`rotate(-42 ${cx} ${labelY})`}
          >
            {b.label}
          </text>
        </g>
      );
    });
  }

  return (
    <div className={styles.chartSvgWrap}>
    <svg
      className={styles.chartSvg}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={
        mode === "total"
          ? "Diagramme en bâtons des bénéfices consolidés"
          : "Diagramme en bâtons des bénéfices par logement"
      }
    >
      <rect
        x={margin.left}
        y={margin.top}
        width={cw}
        height={ch}
        rx={8}
        fill="rgba(148, 163, 184, 0.06)"
        stroke="rgba(148, 163, 184, 0.14)"
        strokeWidth="1"
      />
      {yTicks.map((t, ti) => {
        const y = yScale(t);
        return (
          <line
            key={`gy-${ti}`}
            x1={margin.left}
            x2={margin.left + cw}
            y1={y}
            y2={y}
            stroke={
              Math.abs(y - zeroY) < 1
                ? "transparent"
                : "rgba(148,163,184,0.14)"
            }
            strokeDasharray="4 4"
          />
        );
      })}
      <line
        x1={margin.left}
        x2={margin.left + cw}
        y1={zeroY}
        y2={zeroY}
        stroke="var(--workspace-text)"
        strokeOpacity={0.4}
        strokeWidth={1.5}
      />
      {yTicks.map((t, ti) => {
        const y = yScale(t);
        return (
          <text
            key={`yt-${ti}`}
            x={margin.left - 8}
            y={y + 4}
            textAnchor="end"
            fill={
              t > 0 ? "#22c55e" : t < 0 ? "#ef4444" : "var(--workspace-muted)"
            }
            fontSize="9"
          >
            {eur(t)}
          </text>
        );
      })}
      {barsBody}
    </svg>
    </div>
  );
}

export function Airbnb() {
  const initialStoreRef = useRef<AirbnbState | null>(null);
  const [store, setStore] = useState<AirbnbState>(() => {
    const s = loadAirbnbState();
    initialStoreRef.current = s;
    return s;
  });
  const [tab, setTab] = useState<TabId>("ventilation");
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [draft, setDraft] = useState<AirbnbMonthVentilation>(() =>
    defaultMonthVentilation(initialMonth())
  );
  const [chargesDraft, setChargesDraft] = useState<AirbnbChargesGlobal>(() =>
    cloneChargesGlobal(initialStoreRef.current!.chargesGlobal)
  );
  const [detailMonth, setDetailMonth] = useState<string | null>(null);
  const [fichierEditBenef, setFichierEditBenef] = useState("");
  const [fichierEditRevenus, setFichierEditRevenus] = useState("");
  const [syntheseChartMode, setSyntheseChartMode] =
    useState<SyntheseChartMode>("total");
  const [syntheseView, setSyntheseView] = useState<SyntheseViewQuery>(() =>
    defaultSyntheseViewQuery(
      listSyntheseDataMonths(initialStoreRef.current ?? loadAirbnbState()),
    ),
  );

  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    saveAirbnbState(store);
  }, [store]);

  useEffect(() => {
    setChargesDraft(cloneChargesGlobal(store.chargesGlobal));
  }, [store.chargesGlobal]);

  useEffect(() => {
    const found = storeRef.current.ventilations.find(
      (v) => v.month === selectedMonth
    );
    setDraft(
      found ? cloneMonthVentilation(found) : defaultMonthVentilation(selectedMonth)
    );
  }, [selectedMonth]);

  // Sauvegarde automatique (brouillon) de la ventilation pendant la saisie,
  // pour permettre de reprendre plus tard sans cliquer « Enregistrer ».
  useEffect(() => {
    if (tab !== "ventilation") return;
    const t = setTimeout(() => {
      const toSave = cloneMonthVentilation(draft);
      setStore((s) => {
        const i = s.ventilations.findIndex((v) => v.month === toSave.month);
        const vent = [...s.ventilations];
        if (i === -1) vent.push(toSave);
        else vent[i] = toSave;
        return { ...s, ventilations: vent };
      });
    }, 650);
    return () => clearTimeout(t);
  }, [tab, draft]);

  const merged = useMemo(() => buildMergedSynthese(store), [store]);

  /** Plus récent en premier (synthèse : tableau). */
  const syntheseNewestFirst = useMemo(
    () => [...merged].sort((a, b) => b.month.localeCompare(a.month)),
    [merged]
  );

  const syntheseDataMonths = useMemo(
    () => listSyntheseDataMonths(store),
    [store],
  );

  const syntheseSelectYears = useMemo(
    () => listSyntheseSelectYears(syntheseDataMonths),
    [syntheseDataMonths],
  );

  const syntheseMonthOptions = useMemo(() => {
    const years = syntheseSelectYears;
    if (years.length === 0) return [currentYearMonth()];
    const from = `${years[0]}-01`;
    const lastY = years[years.length - 1];
    const to = currentYearMonth();
    const end = `${lastY}-12` > to ? `${lastY}-12` : to;
    return monthsInclusive(from, end);
  }, [syntheseSelectYears]);

  const syntheseBarsTotal = useMemo(
    () =>
      syntheseChartMode === "total"
        ? buildSyntheseTotalBars(store, syntheseView)
        : null,
    [syntheseChartMode, store, syntheseView],
  );

  const syntheseGroupedBars = useMemo(
    () =>
      syntheseChartMode === "parAnnonce"
        ? buildSyntheseGroupedBars(store, syntheseView)
        : null,
    [syntheseChartMode, store, syntheseView],
  );

  const chartKpi = useMemo(
    () => computeSyntheseViewTotals(store, syntheseView),
    [store, syntheseView],
  );

  const listingFilterActive = !isAllListingsSelected(syntheseView.listingIds);

  const monthVentilationTotals = useMemo(
    () => computeVentilationMonthTotals(draft),
    [draft]
  );

  const monthChargesTotal = useMemo(
    () =>
      AIRBNB_LISTINGS.reduce(
        (s, { id }) =>
          s +
          listingChargesTotal(
            chargesDraft.listings[id] ??
              store.chargesGlobal.listings[id] ??
              emptyListingCharges()
          ),
        0
      ),
    [chargesDraft, store.chargesGlobal]
  );

  const monthBeneficeNet = monthVentilationTotals.benefices - monthChargesTotal;

  function setListingCharge(
    listingId: AirbnbListingId,
    patch: Partial<AirbnbListingCharges>
  ) {
    setChargesDraft((d) => ({
      listings: {
        ...d.listings,
        [listingId]: { ...d.listings[listingId], ...patch },
      },
    }));
  }

  function setLine(
    listingId: AirbnbListingId,
    lineId: string,
    patch: Partial<AirbnbVentilationLine>
  ) {
    setDraft((d) => ({
      ...d,
      listings: {
        ...d.listings,
        [listingId]: d.listings[listingId].map((row) =>
          row.id === lineId ? { ...row, ...patch } : row
        ),
      },
    }));
  }

  function addLine(listingId: AirbnbListingId) {
    setDraft((d) => ({
      ...d,
      listings: {
        ...d.listings,
        [listingId]: [...d.listings[listingId], newLine()],
      },
    }));
  }

  function removeLine(listingId: AirbnbListingId, lineId: string) {
    setDraft((d) => ({
      ...d,
      listings: {
        ...d.listings,
        [listingId]: d.listings[listingId].filter((r) => r.id !== lineId),
      },
    }));
  }

  function saveVentilation() {
    const toSave = cloneMonthVentilation(draft);
    setStore((s) => {
      const i = s.ventilations.findIndex((v) => v.month === toSave.month);
      const vent = [...s.ventilations];
      if (i === -1) vent.push(toSave);
      else vent[i] = toSave;
      return { ...s, ventilations: vent };
    });
  }

  function saveCharges() {
    const toSave = cloneChargesGlobal(chargesDraft);
    setStore((s) => ({ ...s, chargesGlobal: toSave }));
  }

  const syntheseDetail =
    detailMonth != null ? getAirbnbMonthDetail(store, detailMonth) : null;

  useEffect(() => {
    if (detailMonth != null && syntheseDetail?.source === "fichier") {
      setFichierEditBenef(String(syntheseDetail.totalPercuBrut));
      setFichierEditRevenus(String(syntheseDetail.totalFacture));
    }
  }, [
    detailMonth,
    syntheseDetail?.month,
    syntheseDetail?.source,
    syntheseDetail?.totalPercuBrut,
    syntheseDetail?.totalFacture,
  ]);

  function saveFichierSyntheseEdit() {
    if (detailMonth == null) return;
    const benefices = parseEuroInputDisplay(fichierEditBenef);
    const revenus = parseEuroInputDisplay(fichierEditRevenus);
    setStore((s) => ({
      ...s,
      syntheseFichierOverrides: {
        ...s.syntheseFichierOverrides,
        [detailMonth]: { benefices, revenus },
      },
    }));
  }

  function resetFichierSyntheseToSeed() {
    if (detailMonth == null) return;
    setStore((s) => {
      const next = { ...s.syntheseFichierOverrides };
      delete next[detailMonth];
      return { ...s, syntheseFichierOverrides: next };
    });
  }

  const fichierDraftBenef = parseEuroInputDisplay(fichierEditBenef);
  const fichierDraftRevenus = parseEuroInputDisplay(fichierEditRevenus);
  const fichierHasOverride =
    detailMonth != null && !!store.syntheseFichierOverrides[detailMonth];

  function setSyntheseGranularity(granularity: SyntheseGranularity) {
    setSyntheseView((q) => ({ ...q, granularity }));
  }

  function setSyntheseFromYear(year: number) {
    setSyntheseView((q) => {
      const fromMonth = `${year}-01`;
      const toMonth = fromMonth > q.toMonth ? `${year}-12` : q.toMonth;
      return { ...q, fromMonth, toMonth };
    });
  }

  function setSyntheseToYear(year: number) {
    const nowYm = currentYearMonth();
    const toMonth =
      year === yearOfMonth(nowYm) ? nowYm : `${year}-12`;
    setSyntheseView((q) => {
      const fromMonth = q.fromMonth > toMonth ? `${year}-01` : q.fromMonth;
      return { ...q, fromMonth, toMonth };
    });
  }

  function setSyntheseFromMonth(fromMonth: string) {
    setSyntheseView((q) => ({
      ...q,
      fromMonth,
      toMonth: fromMonth > q.toMonth ? fromMonth : q.toMonth,
    }));
  }

  function setSyntheseToMonth(toMonth: string) {
    setSyntheseView((q) => ({
      ...q,
      toMonth,
      fromMonth: q.fromMonth > toMonth ? toMonth : q.fromMonth,
    }));
  }

  function toggleSyntheseListing(id: AirbnbListingId) {
    setSyntheseView((q) => {
      if (isAllListingsSelected(q.listingIds)) {
        return { ...q, listingIds: [id] };
      }
      const has = q.listingIds.includes(id);
      const next = has
        ? q.listingIds.filter((x) => x !== id)
        : [...q.listingIds, id];
      if (next.length === 0 || next.length === AIRBNB_LISTINGS.length) {
        return { ...q, listingIds: [] };
      }
      return { ...q, listingIds: next };
    });
  }

  function resetSyntheseView() {
    setSyntheseView(defaultSyntheseViewQuery(syntheseDataMonths));
  }

  const syntheseLegendListingIds: Array<AirbnbListingId | "_fichier"> =
    listingFilterActive
      ? [...AIRBNB_LISTINGS.map((l) => l.id).filter((id) =>
          syntheseView.listingIds.includes(id),
        )]
      : [...AIRBNB_LISTINGS.map((l) => l.id), "_fichier"];

  return (
    <PageFrame title="Airbnb">
      <div className={styles.page}>
        <p className={styles.intro}>
          Module inspiré du classeur « ventilation airbnb » (baux courts /
          séjours). <strong>Ventilation</strong> : facturé, frais, déduction par
          annonce. <strong>Charges</strong> : montants fixes pour tous les mois
          (loyer, énergie, assurances, etc.), déduits du bénéfice de chaque
          annonce en ventilation — modifiables à tout moment dans l’onglet dédié.{" "}
          <strong>Synthèse</strong> : total facturé et bénéfices. Les mois issus
          du <strong>fichier source</strong> sont affichés sans déduction des
          charges ; vous pouvez <strong>corriger leurs montants</strong> depuis
          le détail (clic sur la ligne du mois). Les <strong>charges</strong> ne
          s’appliquent aux bénéfices en synthèse que pour les mois saisis dans
          l’onglet Ventilation.
        </p>

        <div className={styles.tabs} role="tablist" aria-label="Sections Airbnb">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "ventilation"}
            className={`${styles.tab} ${tab === "ventilation" ? styles.tabActive : ""}`}
            onClick={() => setTab("ventilation")}
          >
            Ventilation
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "charges"}
            className={`${styles.tab} ${tab === "charges" ? styles.tabActive : ""}`}
            onClick={() => setTab("charges")}
          >
            Charges
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "synthese"}
            className={`${styles.tab} ${tab === "synthese" ? styles.tabActive : ""}`}
            onClick={() => setTab("synthese")}
          >
            Synthèse
          </button>
        </div>

        {tab === "ventilation" ? (
          <>
            <div className={styles.toolbar}>
              <div className={styles.monthField}>
                <label htmlFor="airbnb-month">Mois concerné</label>
                <input
                  id="airbnb-month"
                  className={styles.monthInput}
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={saveVentilation}
                >
                  Enregistrer la ventilation du mois
                </button>
              </div>
            </div>
            <p className={styles.hint}>
              Pour chaque annonce, ajoutez une ligne par réservation ou regroupement
              (facturé TTC, frais plateforme, déductions). Bénéfice brut = facturé
              + frais − déduction. Les charges de l’annonce (onglet Charges) sont
              réparties sur les lignes au prorata du bénéfice brut ; la colonne{" "}
              <strong>Bénéfice net</strong> reflète cette déduction.
            </p>

            {AIRBNB_LISTINGS.map(({ id, label }) => {
              const lines = draft.listings[id];
              const sub = listingTotals(lines);
              const listingCh = listingChargesTotal(
                chargesDraft.listings[id] ??
                  store.chargesGlobal.listings[id] ??
                  emptyListingCharges()
              );
              const lineNets = lineNetBeneficesWithListingCharges(lines, listingCh);
              const netListing = sub.benefice - listingCh;
              const listingActive = airbnbListingIsActiveInMonth(
                id,
                selectedMonth
              );
              return (
                <div key={id} className={styles.listingCard}>
                  <h3 className={styles.listingTitle}>
                    {label}
                    <span className={styles.listingBadge}>Ventilation</span>
                  </h3>
                  {!listingActive ? (
                    <p className={styles.hint}>
                      Hors période d’activité pour ce mois : non pris en compte
                      dans les totaux, la synthèse et le détail
                      {AIRBNB_LISTING_ACTIVE_FROM[id]
                        ? ` (activité à partir de ${formatMonthFr(AIRBNB_LISTING_ACTIVE_FROM[id]!)})`
                        : ""}
                      .
                    </p>
                  ) : null}
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Libellé / séjour</th>
                          <th className={styles.num}>Facturé</th>
                          <th className={styles.num}>Frais</th>
                          <th className={styles.num}>Déduction</th>
                          <th className={styles.num}>Bénéfice brut</th>
                          <th className={styles.num}>Bénéfice net</th>
                          <th className={styles.num}>Total facturé</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((row, rowIdx) => {
                          const gBrut = lineBenefice(row);
                          const gNet = lineNets[rowIdx] ?? gBrut;
                          const gBrutOut = listingActive ? gBrut : 0;
                          const gNetOut = listingActive ? gNet : 0;
                          return (
                          <tr key={row.id}>
                            <td>
                              <input
                                value={row.libelle}
                                onChange={(e) =>
                                  setLine(id, row.id, {
                                    libelle: e.target.value,
                                  })
                                }
                                placeholder="ex. Réservation 12–15"
                              />
                            </td>
                            <td className={styles.num}>
                              <input
                                inputMode="decimal"
                                value={row.facture}
                                onChange={(e) =>
                                  setLine(id, row.id, {
                                    facture: e.target.value,
                                  })
                                }
                                placeholder="0"
                              />
                            </td>
                            <td className={styles.num}>
                              <input
                                inputMode="decimal"
                                value={row.frais}
                                onChange={(e) =>
                                  setLine(id, row.id, { frais: e.target.value })
                                }
                                placeholder="0"
                              />
                            </td>
                            <td className={styles.num}>
                              <input
                                inputMode="decimal"
                                value={row.deduction}
                                onChange={(e) =>
                                  setLine(id, row.id, {
                                    deduction: e.target.value,
                                  })
                                }
                                placeholder="0"
                              />
                            </td>
                            <td
                              className={`${styles.num} ${styles.cellCalc} ${benefClass(gBrutOut)}`}
                            >
                              {eur(gBrutOut)}
                            </td>
                            <td
                              className={`${styles.num} ${styles.cellCalc} ${styles.cellCalcSemi} ${benefClass(gNetOut)}`}
                            >
                              {eur(gNetOut)}
                            </td>
                            <td
                              className={`${styles.num} ${styles.cellCalc} ${styles.cellCalcStrong}`}
                            >
                              {eur(
                                listingActive ? lineTotalFacture(row) : 0
                              )}
                            </td>
                            <td>
                              {lines.length > 1 ? (
                                <button
                                  type="button"
                                  className={styles.btnRemove}
                                  onClick={() => removeLine(id, row.id)}
                                  aria-label="Supprimer la ligne"
                                >
                                  Retirer
                                </button>
                              ) : null}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className={styles.btnRow}
                    onClick={() => addLine(id)}
                  >
                    + Ligne pour {label}
                  </button>
                  <div className={styles.listingSubtotal}>
                    <span>
                      Sous-total ventilation (bénéfice) :{" "}
                      <strong
                        className={benefClass(
                          listingActive ? sub.benefice : 0
                        )}
                      >
                        {eur(listingActive ? sub.benefice : 0)}
                      </strong>
                    </span>
                    <span>
                      Charges déduites :{" "}
                      <strong>{eur(listingActive ? listingCh : 0)}</strong>
                    </span>
                    <span>
                      Bénéfice net annonce :{" "}
                      <strong
                        className={benefClass(listingActive ? netListing : 0)}
                      >
                        {eur(listingActive ? netListing : 0)}
                      </strong>
                    </span>
                    <span>
                      Sous-total facturé :{" "}
                      <strong>
                        {eur(listingActive ? sub.totalFacture : 0)}
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })}

            <div className={styles.monthTotal}>
              <p className={styles.monthTotalTitle}>
                Total mois ({formatMonthFr(selectedMonth)})
              </p>
              <div className={styles.monthTotalGrid}>
                <div className={styles.monthTotalCell}>
                  <strong className={styles.monthTotalEmphasis}>
                    Total perçu
                  </strong>
                  <strong
                    className={`${styles.monthTotalFigure} ${benefClass(monthVentilationTotals.benefices)}`}
                  >
                    {eur(monthVentilationTotals.benefices)}
                  </strong>
                </div>
                <div className={styles.monthTotalCell}>
                  <strong className={styles.monthTotalEmphasis}>
                    Total facturé
                  </strong>
                  <strong className={styles.monthTotalFigure}>
                    {eur(monthVentilationTotals.revenus)}
                  </strong>
                </div>
                <div className={styles.monthTotalCell}>
                  <strong className={styles.monthTotalEmphasis}>
                    Total déductions
                  </strong>
                  <strong className={styles.monthTotalFigure}>
                    {eur(monthVentilationTotals.deductions)}
                  </strong>
                </div>
                <div className={styles.monthTotalCell}>
                  <strong className={styles.monthTotalEmphasis}>
                    Bénéfice du mois (tous biens)
                  </strong>
                  <strong
                    className={`${styles.monthTotalFigure} ${benefClass(monthBeneficeNet)}`}
                  >
                    {eur(monthBeneficeNet)}
                  </strong>
                </div>
              </div>
              <p className={styles.monthTotalFootnote}>
                Total perçu = somme des bénéfices ventilation avant charges. Le
                bénéfice du mois = total perçu − total des charges fixes (même
                déduction pour tous les mois une fois enregistrées).
              </p>
            </div>
          </>
        ) : tab === "charges" ? (
          <>
            <div className={styles.toolbar}>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={saveCharges}
                >
                  Enregistrer les charges
                </button>
              </div>
            </div>
            <p className={styles.hint}>
              Ces montants sont <strong>identiques pour chaque mois</strong>{" "}
              (ventilation et synthèse). Vous pouvez les mettre à jour quand vous
              le souhaitez ; pensez à enregistrer pour appliquer partout.
            </p>
            {AIRBNB_LISTINGS.map(({ id, label }) => (
              <div key={id} className={styles.listingCard}>
                <h3 className={styles.listingTitle}>
                  {label}
                  <span className={styles.listingBadge}>Charges</span>
                </h3>
                <div className={styles.chargesGrid}>
                  {CHARGE_FIELDS.map(({ key, label: fieldLabel }) => (
                    <label key={key} className={styles.chargeField}>
                      <span>{fieldLabel}</span>
                      <input
                        inputMode="decimal"
                        value={chargesDraft.listings[id][key]}
                        onChange={(e) =>
                          setListingCharge(id, { [key]: e.target.value })
                        }
                        placeholder="0"
                      />
                    </label>
                  ))}
                </div>
                <p className={styles.chargeListingTotal}>
                  Total charges annonce :{" "}
                  <strong>
                    {eur(listingChargesTotal(chargesDraft.listings[id]))}
                  </strong>
                </p>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className={styles.kpiRow}>
              <div className={styles.kpi}>
                <p className={styles.kpiLabel}>
                  Bénéfices (fichier brut, saisie après charges)
                </p>
                <p
                  className={`${styles.kpiValue} ${benefClass(chartKpi.benefices)}`}
                >
                  {eur(chartKpi.benefices)}
                </p>
              </div>
              <div className={styles.kpi}>
                <p className={styles.kpiLabel}>Total facturé (période affichée)</p>
                <p className={styles.kpiValue}>{eur(chartKpi.revenus)}</p>
              </div>
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>
                Bénéfices — synthèse par période et par logement
              </h3>
              <div
                className={styles.chartFilterRow}
                role="group"
                aria-label="Type de cumul du graphique"
              >
                <button
                  type="button"
                  className={`${styles.chartFilterBtn} ${syntheseChartMode === "total" ? styles.chartFilterBtnActive : ""}`}
                  aria-pressed={syntheseChartMode === "total"}
                  onClick={() => setSyntheseChartMode("total")}
                >
                  Bénéfice total
                </button>
                <button
                  type="button"
                  className={`${styles.chartFilterBtn} ${syntheseChartMode === "parAnnonce" ? styles.chartFilterBtnActive : ""}`}
                  aria-pressed={syntheseChartMode === "parAnnonce"}
                  onClick={() => setSyntheseChartMode("parAnnonce")}
                >
                  Par logement
                </button>
              </div>

              <div className={styles.chartControls}>
                <div
                  className={styles.chartFilterRow}
                  role="group"
                  aria-label="Découpage de la période"
                >
                  <span className={styles.chartControlLabel}>Affichage</span>
                  <button
                    type="button"
                    className={`${styles.chartFilterBtn} ${syntheseView.granularity === "year" ? styles.chartFilterBtnActive : ""}`}
                    aria-pressed={syntheseView.granularity === "year"}
                    onClick={() => setSyntheseGranularity("year")}
                  >
                    Par an
                  </button>
                  <button
                    type="button"
                    className={`${styles.chartFilterBtn} ${syntheseView.granularity === "month" ? styles.chartFilterBtnActive : ""}`}
                    aria-pressed={syntheseView.granularity === "month"}
                    onClick={() => setSyntheseGranularity("month")}
                  >
                    Par mois
                  </button>
                </div>

                <div className={styles.chartRangeRow}>
                  <label className={styles.chartSelectField}>
                    De
                    {syntheseView.granularity === "year" ? (
                      <select
                        className={styles.chartSelect}
                        value={yearOfMonth(syntheseView.fromMonth)}
                        onChange={(e) =>
                          setSyntheseFromYear(Number(e.target.value))
                        }
                      >
                        {syntheseSelectYears.map((y) => (
                          <option key={`from-y-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className={styles.chartSelect}
                        value={syntheseView.fromMonth}
                        onChange={(e) => setSyntheseFromMonth(e.target.value)}
                      >
                        {syntheseMonthOptions.map((m) => (
                          <option key={`from-m-${m}`} value={m}>
                            {formatMonthFr(m)}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                  <label className={styles.chartSelectField}>
                    À
                    {syntheseView.granularity === "year" ? (
                      <select
                        className={styles.chartSelect}
                        value={yearOfMonth(syntheseView.toMonth)}
                        onChange={(e) =>
                          setSyntheseToYear(Number(e.target.value))
                        }
                      >
                        {syntheseSelectYears.map((y) => (
                          <option key={`to-y-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className={styles.chartSelect}
                        value={syntheseView.toMonth}
                        onChange={(e) => setSyntheseToMonth(e.target.value)}
                      >
                        {syntheseMonthOptions.map((m) => (
                          <option key={`to-m-${m}`} value={m}>
                            {formatMonthFr(m)}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                  <button
                    type="button"
                    className={styles.chartResetBtn}
                    onClick={resetSyntheseView}
                  >
                    Réinitialiser
                  </button>
                </div>

                <div
                  className={styles.chartFilterRow}
                  role="group"
                  aria-label="Filtrer par logement"
                >
                  <span className={styles.chartControlLabel}>Logement</span>
                  <button
                    type="button"
                    className={`${styles.chartFilterBtn} ${!listingFilterActive ? styles.chartFilterBtnActive : ""}`}
                    aria-pressed={!listingFilterActive}
                    onClick={() =>
                      setSyntheseView((q) => ({ ...q, listingIds: [] }))
                    }
                  >
                    Tous
                  </button>
                  {AIRBNB_LISTINGS.map(({ id, label }) => {
                    const active =
                      listingFilterActive &&
                      syntheseView.listingIds.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`${styles.chartFilterBtn} ${active ? styles.chartFilterBtnActive : ""}`}
                        aria-pressed={active}
                        onClick={() => toggleSyntheseListing(id)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className={styles.chartSubtitle}>
                {syntheseChartMode === "total"
                  ? "Un bâton par période choisie (mêmes montants que les indicateurs ci-dessus : fichier brut, saisie après charges). Les filtres ne modifient pas les données enregistrées."
                  : "Pour chaque période, un groupe de bâtons par logement sélectionné (saisie : net après charges). La part grise « fichier » n’apparaît que si tous les logements sont affichés."}
              </p>
              {chartKpi.fichierExcluDuFiltreLogement ? (
                <p className={styles.chartFilterNote}>
                  Mois issus du fichier Excel (non ventilés par logement) exclus
                  du cumul tant qu’un filtre logement est actif.
                </p>
              ) : null}
              <SyntheseChart
                mode={syntheseChartMode}
                barsTotal={syntheseBarsTotal}
                groupedBuckets={syntheseGroupedBars}
              />
              {syntheseChartMode === "total" ? (
                <div className={styles.chartLegend}>
                  <span>
                    <span
                      className={styles.legendSwatch}
                      style={{
                        background:
                          "linear-gradient(180deg,#4ade80,#16a34a)",
                      }}
                    />{" "}
                    Bénéfice positif
                  </span>
                  <span>
                    <span
                      className={styles.legendSwatch}
                      style={{
                        background:
                          "linear-gradient(180deg,#fca5a5,#dc2626)",
                      }}
                    />{" "}
                    Bénéfice négatif
                  </span>
                </div>
              ) : (
                <div className={styles.chartLegend}>
                  {syntheseLegendListingIds.map((id) => (
                    <span key={id}>
                      <span
                        className={styles.legendSwatch}
                        style={{ background: SYNTHESE_SEGMENT_COLORS[id] }}
                      />{" "}
                      {syntheseSegmentLegendLabel(id)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.listingCard}>
              <h3 className={styles.listingTitle}>Tableau récapitulatif</h3>
              <p className={styles.recapHint}>
                Du plus récent au plus ancien (toutes les données, indépendant
                des filtres du graphique). Colonne Bénéfices : valeur fichier
                si source Excel, net après charges si source Saisie app. Cliquez
                une ligne pour le détail ; pour un mois « Fichier Excel », vous
                pouvez y ajuster bénéfice et total facturé (enregistré localement).
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.recapTable}>
                  <thead>
                    <tr>
                      <th>Période</th>
                      <th className={styles.num}>Bénéfices</th>
                      <th className={styles.num}>Total facturé</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syntheseNewestFirst.map((r) => (
                      <tr
                        key={r.month}
                        className={styles.recapRowClick}
                        onClick={() => setDetailMonth(r.month)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetailMonth(r.month);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Détail pour ${formatMonthFr(r.month)}`}
                      >
                        <td>{formatMonthFr(r.month)}</td>
                        <td className={`${styles.num} ${benefClass(r.benefices)}`}>
                          {eur(r.benefices)}
                        </td>
                        <td className={styles.num}>{eur(r.revenus)}</td>
                        <td>
                          <span
                            className={`${styles.sourceBadge} ${r.source === "saisie" ? styles.sourceSaisie : styles.sourceFichier}`}
                          >
                            {r.source === "saisie" ? "Saisie app" : "Fichier Excel"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {detailMonth != null && syntheseDetail ? (
          <div
            className={styles.modalOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="airbnb-detail-title"
            onClick={() => setDetailMonth(null)}
          >
            <div
              className={styles.modalPanel}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2 id="airbnb-detail-title" className={styles.modalTitle}>
                  Détail — {formatMonthFr(syntheseDetail.month)}
                </h2>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setDetailMonth(null)}
                  aria-label="Fermer"
                >
                  Fermer
                </button>
              </div>
              <p className={styles.modalMeta}>
                Source :{" "}
                {syntheseDetail.source === "saisie"
                  ? "Saisie ventilation app — bénéfice net après déduction des charges fixes."
                  : "Données fichier — bénéfice consolidé sans déduction des charges (affichage à titre informatif pour les postes de charges saisis)."}
              </p>
              {syntheseDetail.source === "fichier" ? (
                <div className={styles.fichierEditPanel}>
                  <p className={styles.fichierEditTitle}>
                    Corriger les montants (remplace les valeurs importées pour ce
                    mois, enregistré dans ce navigateur)
                  </p>
                  <div className={styles.fichierEditGrid}>
                    <label className={styles.fichierEditField}>
                      <span>Total perçu (bénéfices brut)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={styles.detailKpiInput}
                        value={fichierEditBenef}
                        onChange={(e) => setFichierEditBenef(e.target.value)}
                        aria-label="Bénéfice brut fichier"
                      />
                    </label>
                    <label className={styles.fichierEditField}>
                      <span>Total facturé</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={styles.detailKpiInput}
                        value={fichierEditRevenus}
                        onChange={(e) => setFichierEditRevenus(e.target.value)}
                        aria-label="Total facturé fichier"
                      />
                    </label>
                  </div>
                  <div className={styles.fichierEditActions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={saveFichierSyntheseEdit}
                    >
                      Enregistrer les montants
                    </button>
                    {fichierHasOverride ? (
                      <button
                        type="button"
                        className={styles.btnRow}
                        onClick={resetFichierSyntheseToSeed}
                      >
                        Rétablir le fichier Excel
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className={styles.detailKpis}>
                <div>
                  <span className={styles.detailKpiLabel}>Total perçu (brut)</span>
                  {syntheseDetail.source === "fichier" ? (
                    <strong
                      className={`${styles.detailKpiVal} ${benefClass(fichierDraftBenef)}`}
                    >
                      {eur(fichierDraftBenef)}
                    </strong>
                  ) : (
                    <strong
                      className={`${styles.detailKpiVal} ${benefClass(syntheseDetail.totalPercuBrut)}`}
                    >
                      {eur(syntheseDetail.totalPercuBrut)}
                    </strong>
                  )}
                </div>
                <div>
                  <span className={styles.detailKpiLabel}>Total facturé</span>
                  {syntheseDetail.source === "fichier" ? (
                    <strong className={styles.detailKpiVal}>
                      {eur(fichierDraftRevenus)}
                    </strong>
                  ) : (
                    <strong className={styles.detailKpiVal}>
                      {eur(syntheseDetail.totalFacture)}
                    </strong>
                  )}
                </div>
                <div>
                  <span className={styles.detailKpiLabel}>Total charges</span>
                  <strong className={styles.detailKpiVal}>
                    {eur(syntheseDetail.chargesTotal)}
                  </strong>
                </div>
                <div>
                  <span className={styles.detailKpiLabel}>Bénéfice net</span>
                  <strong
                    className={`${styles.detailKpiVal} ${benefClass(
                      syntheseDetail.source === "fichier"
                        ? fichierDraftBenef
                        : syntheseDetail.beneficeNet
                    )}`}
                  >
                    {eur(
                      syntheseDetail.source === "fichier"
                        ? fichierDraftBenef
                        : syntheseDetail.beneficeNet
                    )}
                  </strong>
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.detailTable}>
                  <thead>
                    <tr>
                      <th>Annonce</th>
                      <th className={styles.num}>Ventilation (bénéfice)</th>
                      <th className={styles.num}>Facturé</th>
                      <th className={styles.num}>Charges</th>
                      <th className={styles.num}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syntheseDetail.listings.map((row) => (
                      <tr key={row.id}>
                        <td>{row.label}</td>
                        <td className={styles.num}>
                          {row.beneficeVentilation != null ? (
                            <span className={benefClass(row.beneficeVentilation)}>
                              {eur(row.beneficeVentilation)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={styles.num}>
                          {row.totalFactureVentilation != null
                            ? eur(row.totalFactureVentilation)
                            : "—"}
                        </td>
                        <td className={styles.num}>{eur(row.charges)}</td>
                        <td className={styles.num}>
                          {row.beneficeNet != null ? (
                            <span className={benefClass(row.beneficeNet)}>
                              {eur(row.beneficeNet)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageFrame>
  );
}
