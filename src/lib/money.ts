export function parseEuro(raw: string): number {
  const n = Number(String(raw ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Montant TVA (€) pour une base HT et un taux saisi en % (ex. « 20 » pour 20 %). */
export function montantTvaEuro(
  baseHt: number,
  tauxPourcentBrut: string
): number {
  const base = Number.isFinite(baseHt) ? baseHt : 0;
  const t = parseEuro(tauxPourcentBrut);
  if (base <= 0 || t <= 0) return 0;
  return base * (t / 100);
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Montants pour PDF jsPDF : espaces normaux entre milliers (évite les U+202F
 * ou symboles mal rendus type « / » à la place du séparateur).
 */
export function formatEuroPdf(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const neg = n < 0;
  const v = Math.abs(n);
  const [intRaw, frac] = v.toFixed(2).split(".");
  const intGrouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${intGrouped},${frac} €`;
}
