import type { MoisComputed } from "./moisFinance";

/** Mois déjà soldés (statut Payé), pour toute la location ou une plage YYYY-MM. */
export type PorteeQuittancesPayees =
  | { mode: "toutes" }
  | { mode: "periode"; de: string; a: string };

const MOIS_CLE = /^\d{4}-\d{2}$/;

export function bornesPeriodeQuittances(
  de: string,
  a: string,
): { from: string; to: string } | null {
  const debut = de.trim();
  const fin = a.trim();
  if (!MOIS_CLE.test(debut) || !MOIS_CLE.test(fin)) return null;
  return debut <= fin
    ? { from: debut, to: fin }
    : { from: fin, to: debut };
}

/** Mois payés, du plus ancien au plus récent. Une période invalide ne renvoie rien. */
export function moisQuittancesPayees(
  mois: MoisComputed[],
  portee: PorteeQuittancesPayees,
): MoisComputed[] {
  const payes = mois.filter((m) => m.statut === "paye");
  if (portee.mode === "toutes") return payes;
  const bornes = bornesPeriodeQuittances(portee.de, portee.a);
  if (!bornes) return [];
  return payes.filter(
    (m) => m.moisCle >= bornes.from && m.moisCle <= bornes.to,
  );
}

function slugFichier(s: string): string {
  const t = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return t.slice(0, 42) || "bien";
}

export function nomFichierQuittancesPayees(
  titreLogement: string | undefined,
  portee: PorteeQuittancesPayees,
): string {
  const slug = slugFichier(titreLogement ?? "logement");
  if (portee.mode === "toutes") {
    return `Quittances_payees_${slug}_toutes.pdf`;
  }
  const bornes = bornesPeriodeQuittances(portee.de, portee.a);
  const suffixe = bornes ? `${bornes.from}_${bornes.to}` : "periode";
  return `Quittances_payees_${slug}_${suffixe}.pdf`;
}
