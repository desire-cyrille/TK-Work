import {
  AIRBNB_LISTINGS,
  type AirbnbListingId,
  type AirbnbVentilationLine,
} from "../types/airbnb";
import { normaliserEtTrierLignesVentilation } from "./airbnbVentilationSort";

export type AirbnbFactureProposee = {
  listingId: AirbnbListingId;
  listingLabel: string;
  month: string;
  /** Début de séjour AAAA-MM-JJ (tri des lignes). */
  dateSejour: string;
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
  const re = /-?[0-9]{1,6}(?:[.,][0-9]{2})?\s*(?:€|EUR)/gi;
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function extraireMoisEtSejour(text: string): {
  month: string | null;
  sejour: string | null;
  dateSejour: string | null;
} {
  const re =
    /(\d{1,2})\s*[–\-àto]+\s*(\d{1,2})\s*(janv|f[eé]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[eé]c)[a-zû.]*\s*(\d{4})/i;
  const m = text.replace(/\u00a0/g, " ").match(re);
  if (!m) return { month: null, sejour: null, dateSejour: null };
  const mois = MOIS.find((x) => x.re.test(m[3] ?? ""));
  const year = m[4] ?? "";
  const mm = mois?.mm;
  const day = Number(m[1]);
  const sejour = `${m[1]}–${m[2]} ${m[3]}.${year ? ` ${year}` : ""}`
    .replace(/\.\./g, ".")
    .trim();
  const dateSejour =
    mm && year && day >= 1 && day <= 31
      ? `${year}-${mm}-${pad2(day)}`
      : null;
  return {
    month: mm && year ? `${year}-${mm}` : null,
    sejour,
    dateSejour,
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

function lignesTexte(text: string): string[] {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[−–]/g, "-")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Bloc sous « Revenus », avant « Total ». Le total net n’est pas un montant de ventilation. */
function lignesBlocRevenus(text: string): string[] {
  const lines = lignesTexte(text);
  const start = lines.findIndex((l) => /^revenus\b/i.test(l));
  const from = start >= 0 ? lines.slice(start + 1) : lines;
  const end = from.findIndex((l) => /^total\b/i.test(l));
  return end >= 0 ? from.slice(0, end) : from;
}

function ligneNuitees(line: string): boolean {
  return /x\s*\d+\s*nuit/i.test(line) || /\d+\s*nuit/i.test(fold(line));
}

function nouveauChampMontant(line: string): boolean {
  return (
    /^(logement|frais\s+de\s+m[eé]nage|frais\s+de\s+service|total|revenus|confirmation)\b/i.test(
      line,
    ) || ligneNuitees(line)
  );
}

function ligneMontantSeul(line: string): boolean {
  if (!eurosDansTexte(line).length) return false;
  const reste = fold(line).replace(/\beur\b/g, "").replace(/[0-9]/g, "").trim();
  return reste.length === 0;
}

/** Montant d’un libellé, sur la même ligne ou sur les lignes suivantes (libellé coupé). */
function montantLibelle(lines: string[], libelle: RegExp): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (!libelle.test(lines[i] ?? "")) continue;
    const surLigne = eurosDansTexte(lines[i] ?? "");
    if (surLigne.length) return surLigne[surLigne.length - 1] ?? null;
    for (let j = i + 1; j < lines.length; j++) {
      const suiv = lines[j] ?? "";
      if (nouveauChampMontant(suiv)) break;
      const euros = eurosDansTexte(suiv);
      if (euros.length) return euros[euros.length - 1] ?? null;
    }
  }
  return null;
}

/**
 * Total de la ligne « x nuits » (colonne de droite), pas le prix d’une seule nuit
 * et pas le total net de la carte.
 */
function montantNuitees(lines: string[]): number | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!ligneNuitees(line)) continue;
    const euros = eurosDansTexte(line);
    const suiv = lines[i + 1] ?? "";
    if (suiv && ligneMontantSeul(suiv)) euros.push(...eurosDansTexte(suiv));
    if (!euros.length) continue;
    return euros.reduce((a, b) => (Math.abs(a) >= Math.abs(b) ? a : b));
  }
  return null;
}

/**
 * Interprète le texte d’une capture type « carte de réservation » Airbnb.
 * Facturé = ligne Logement, ou total de la ligne « x nuits ».
 * Frais = frais de ménage. Déduction = frais de service.
 * Le total net de la carte n’est pas repris.
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
  const { month, sejour, dateSejour } = extraireMoisEtSejour(text);
  const invite = extraireInvite(text);
  const bloc = lignesBlocRevenus(text);

  const facture =
    montantLibelle(bloc, /^logement\b/i) ?? montantNuitees(bloc);
  const fraisMenage = montantLibelle(bloc, /frais\s+de\s+m[eé]nage/i);
  const fraisService = montantLibelle(bloc, /frais\s+de\s+service/i);

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
      dateSejour: dateSejour ?? "",
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
    dateSejour: /^\d{4}-\d{2}-\d{2}$/.test(p.dateSejour)
      ? p.dateSejour
      : undefined,
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

/** Remplit la dernière ligne vide, sinon ajoute une ligne, puis trie par date. */
export function insererLigneVentilation(
  listings: Record<AirbnbListingId, AirbnbVentilationLine[]>,
  listingId: AirbnbListingId,
  line: AirbnbVentilationLine,
): Record<AirbnbListingId, AirbnbVentilationLine[]> {
  const rows = [...(listings[listingId] ?? [])];
  const last = rows[rows.length - 1];
  if (last && ligneVide(last)) rows[rows.length - 1] = { ...line, id: last.id };
  else rows.push(line);
  return {
    ...listings,
    [listingId]: normaliserEtTrierLignesVentilation(rows),
  };
}
