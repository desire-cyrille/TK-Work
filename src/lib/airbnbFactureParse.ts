import {
  AIRBNB_LISTINGS,
  type AirbnbListingId,
  type AirbnbVentilationLine,
} from "../types/airbnb";

export type AirbnbFactureProposee = {
  listingId: AirbnbListingId;
  listingLabel: string;
  month: string;
  libelle: string;
  facture: string;
  frais: string;
  deduction: string;
};

const MOIS: { re: RegExp; mm: string }[] = [
  { re: /^janv/i, mm: "01" },
  { re: /^f[eé]vr/i, mm: "02" },
  { re: /^mars/i, mm: "03" },
  { re: /^avr/i, mm: "04" },
  { re: /^mai/i, mm: "05" },
  { re: /^juin/i, mm: "06" },
  { re: /^juil/i, mm: "07" },
  { re: /^ao[uû]t/i, mm: "08" },
  { re: /^sept/i, mm: "09" },
  { re: /^oct/i, mm: "10" },
  { re: /^nov/i, mm: "11" },
  { re: /^d[eé]c/i, mm: "12" },
];

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function formatEuroSaisie(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(Math.abs(n) * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(".", ",");
}

/** "152,00", "152.00", "15200" (OCR sans virgule) → nombre. */
export function parseEuroToken(raw: string): number | null {
  let s = raw
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(/EUR/gi, "")
    .replace(/[^\d,.\-−–]/g, "");
  if (!s) return null;
  s = s.replace(/[−–]/g, "-");
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1]!.length <= 2) s = `${parts[0]}.${parts[1]}`;
    else s = s.replace(/,/g, "");
  }
  let n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (!/[.,]/.test(raw) && /^\d{4,6}$/.test(s) && n >= 1000) {
    n = n / 100;
  }
  return neg ? -n : n;
}

function eurosDansTexte(s: string): number[] {
  const out: number[] = [];
  const re =
    /-?[0-9]{1,6}(?:[.,][0-9]{2})?\s*(?:€|EUR)?|[0-9]{1,6}(?:[.,][0-9]{2})?\s*(?:€|EUR)/gi;
  for (const m of s.match(re) ?? []) {
    const n = parseEuroToken(m);
    if (n != null) out.push(n);
  }
  return out;
}

export function matchListingLabel(
  text: string,
): { id: AirbnbListingId; label: string } | null {
  const f = fold(text);
  let best: { id: AirbnbListingId; label: string; score: number } | null = null;
  for (const l of AIRBNB_LISTINGS) {
    const labelFold = fold(l.label);
    const compact = labelFold.replace(/^l[ae] /, "");
    if (f.includes(labelFold) || f.includes(compact)) {
      const score = compact.length;
      if (!best || score > best.score) best = { id: l.id, label: l.label, score };
    }
  }
  return best ? { id: best.id, label: best.label } : null;
}

function extraireMoisEtSejour(text: string): {
  month: string | null;
  sejour: string | null;
} {
  const re =
    /(\d{1,2})\s*[–\-àto]+\s*(\d{1,2})\s*(janv|f[eé]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[eé]c)[a-zû.]*\s*(\d{4})/i;
  const m = text.replace(/\u00a0/g, " ").match(re);
  if (!m) return { month: null, sejour: null };
  const mois = MOIS.find((x) => x.re.test(m[3] ?? ""));
  const year = m[4] ?? "";
  const mm = mois?.mm;
  const sejour = `${m[1]}–${m[2]} ${m[3]}.${year ? ` ${year}` : ""}`
    .replace(/\.\./g, ".")
    .trim();
  return {
    month: mm && year ? `${year}-${mm}` : null,
    sejour,
  };
}

function extraireInvite(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (fold(line).includes("logement")) continue;
    if (matchListingLabel(line)) continue;
    if (/confirmation|d[eé]tails|revenus|frais|total/i.test(line)) continue;
    if (/^hmt/i.test(line)) continue;
    if (/^[\d€.,\s\-−]+$/.test(line)) continue;
    if (/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]+(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]+)+$/.test(line)) {
      return line.replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

function montantApresLibelle(text: string, libelle: RegExp): number | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!libelle.test(line)) continue;
    const euros = eurosDansTexte(line);
    if (euros.length > 0) return euros[euros.length - 1] ?? null;
  }
  const joined = text.replace(/\r?\n/g, " ");
  const m = joined.match(libelle);
  if (!m || m.index == null) return null;
  const slice = joined.slice(m.index, m.index + 80);
  const euros = eurosDansTexte(slice);
  return euros.length ? (euros[euros.length - 1] ?? null) : null;
}

/**
 * Interprète le texte d’une capture type « carte de réservation » Airbnb.
 * Facturé = total nuits (ligne Revenus), frais = ménage, déduction = frais de service.
 */
export function parseAirbnbFactureTexte(
  text: string,
): { ok: true; value: AirbnbFactureProposee } | { ok: false; error: string } {
  const listing = matchListingLabel(text);
  if (!listing) {
    return {
      ok: false,
      error:
        "Logement non reconnu. Vérifiez que le nom (Cosy Chill, familiale…) apparaît sur la capture.",
    };
  }
  const { month, sejour } = extraireMoisEtSejour(text);
  const invite = extraireInvite(text);

  let facture = montantApresLibelle(text, /revenus/i);
  const lignes = text.split(/\r?\n/);
  for (const line of lignes) {
    if (/x\s*\d+\s*nuit/i.test(line) || /\d+\s*nuit/i.test(fold(line))) {
      const euros = eurosDansTexte(line);
      if (euros.length >= 1) facture = euros[euros.length - 1] ?? facture;
    }
  }

  const fraisMenage = montantApresLibelle(text, /frais\s+de\s+m[eé]nage/i);
  const fraisService = montantApresLibelle(text, /frais\s+de\s+service/i);

  if (facture == null) {
    return {
      ok: false,
      error: "Montant facturé introuvable (ligne Revenus).",
    };
  }

  const libelleParts = [invite, sejour].filter(Boolean);
  const libelle =
    libelleParts.length > 0 ? libelleParts.join(" · ") : listing.label;

  return {
    ok: true,
    value: {
      listingId: listing.id,
      listingLabel: listing.label,
      month: month ?? "",
      libelle,
      facture: formatEuroSaisie(facture),
      frais: formatEuroSaisie(fraisMenage ?? 0),
      deduction: formatEuroSaisie(fraisService ?? 0),
    },
  };
}

export function ligneDepuisFacture(
  p: AirbnbFactureProposee,
  newId: () => string,
): AirbnbVentilationLine {
  return {
    id: newId(),
    libelle: p.libelle,
    facture: p.facture,
    frais: p.frais,
    deduction: p.deduction,
  };
}

function ligneVide(row: AirbnbVentilationLine): boolean {
  return (
    !row.libelle.trim() &&
    !row.facture.trim() &&
    !row.frais.trim() &&
    !row.deduction.trim()
  );
}

/** Remplit la dernière ligne vide, sinon ajoute une ligne. */
export function insererLigneVentilation(
  listings: Record<AirbnbListingId, AirbnbVentilationLine[]>,
  listingId: AirbnbListingId,
  line: AirbnbVentilationLine,
): Record<AirbnbListingId, AirbnbVentilationLine[]> {
  const rows = [...(listings[listingId] ?? [])];
  const last = rows[rows.length - 1];
  if (last && ligneVide(last)) rows[rows.length - 1] = { ...line, id: last.id };
  else rows.push(line);
  return { ...listings, [listingId]: rows };
}
