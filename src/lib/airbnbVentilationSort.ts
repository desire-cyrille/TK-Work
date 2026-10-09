import type { AirbnbVentilationLine } from "../types/airbnb";

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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Extrait une date de début de séjour (AAAA-MM-JJ) depuis un libellé libre. */
export function extraireDateSejourDepuisTexte(text: string): string | null {
  const s = text.replace(/\u00a0/g, " ");
  const range = s.match(
    /(\d{1,2})\s*[–\-àto]+\s*(\d{1,2})\s*(janv|f[eé]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[eé]c)[a-zû.]*\s*(\d{4})/i,
  );
  if (range) {
    const mois = MOIS.find((x) => x.re.test(range[3] ?? ""));
    if (mois) {
      const day = Number(range[1]);
      const year = range[4]!;
      if (day >= 1 && day <= 31) return `${year}-${mois.mm}-${pad2(day)}`;
    }
  }
  const iso = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})\b/);
  if (fr) {
    const day = Number(fr[1]);
    const month = Number(fr[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${fr[3]}-${pad2(month)}-${pad2(day)}`;
    }
  }
  return null;
}

export function dateSejourEffective(line: AirbnbVentilationLine): string | null {
  if (
    typeof line.dateSejour === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(line.dateSejour.trim())
  ) {
    return line.dateSejour.trim().slice(0, 10);
  }
  return extraireDateSejourDepuisTexte(line.libelle ?? "");
}

function ligneVide(row: AirbnbVentilationLine): boolean {
  return (
    !row.libelle.trim() &&
    !String(row.facture ?? "").trim() &&
    !String(row.frais ?? "").trim() &&
    !String(row.deduction ?? "").trim()
  );
}

/**
 * Plus ancienne en haut, plus récente en bas.
 * Sans date : après les datées ; ligne vide tout en bas (saisie).
 */
export function trierLignesVentilationParDate(
  lines: AirbnbVentilationLine[],
): AirbnbVentilationLine[] {
  return [...lines]
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const da = dateSejourEffective(a.row);
      const db = dateSejourEffective(b.row);
      const emptyA = ligneVide(a.row);
      const emptyB = ligneVide(b.row);
      if (emptyA !== emptyB) return emptyA ? 1 : -1;
      if (da && db && da !== db) return da.localeCompare(db);
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

/** Enrichit `dateSejour` si absente mais lisible dans le libellé, puis trie. */
export function normaliserEtTrierLignesVentilation(
  lines: AirbnbVentilationLine[],
): AirbnbVentilationLine[] {
  const enriched = lines.map((row) => {
    if (
      typeof row.dateSejour === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.dateSejour.trim())
    ) {
      return { ...row, dateSejour: row.dateSejour.trim().slice(0, 10) };
    }
    const fromLib = extraireDateSejourDepuisTexte(row.libelle ?? "");
    return fromLib ? { ...row, dateSejour: fromLib } : { ...row };
  });
  return trierLignesVentilationParDate(enriched);
}
