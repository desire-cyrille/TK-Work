/**
 * Prorata temporis sur mois civils (loyer mensuel × somme des jours/duration du mois par segment).
 * Dates attendues : AAAA-MM-JJ (champ type="date").
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export function parsePartsDateIso(s: string): {
  y: number;
  m: number;
  d: number;
} | null {
  const m = ISO_DATE.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** Nombre de jours dans le mois civil (1–12), en calendrier UTC. */
export function joursDansMoisCivil(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** Jours calendaires entre deux dates inclusives ; null si invalide ou fin &lt; début. */
export function joursCalendairesInclusive(
  debutIso: string,
  finIso: string
): number | null {
  const a = parsePartsDateIso(debutIso);
  const b = parsePartsDateIso(finIso);
  if (!a || !b) return null;
  const t0 = Date.UTC(a.y, a.m - 1, a.d);
  const t1 = Date.UTC(b.y, b.m - 1, b.d);
  if (t1 < t0) return null;
  return Math.floor((t1 - t0) / 86400000) + 1;
}

/**
 * Ratio à appliquer au loyer / charges mensuels : pour chaque mois civil touché,
 * (jours occupés dans ce mois) / (jours dans ce mois), puis somme.
 * Un seul mois : identique à « jours / jours du mois ».
 */
export function ratioProrataTemporisMoisCivils(
  debutIso: string,
  finIso: string
): number | null {
  const a = parsePartsDateIso(debutIso);
  const b = parsePartsDateIso(finIso);
  if (!a || !b) return null;

  let y = a.y;
  let m = a.m;
  let d = a.d;

  if (y > b.y || (y === b.y && m > b.m) || (y === b.y && m === b.m && d > b.d)) {
    return null;
  }

  let ratio = 0;

  for (;;) {
    const dim = joursDansMoisCivil(y, m);
    if (d > dim) return null;

    const finSegmentJour =
      y === b.y && m === b.m ? Math.min(b.d, dim) : dim;

    if (finSegmentJour < d) return null;

    const jSeg = finSegmentJour - d + 1;
    ratio += jSeg / dim;

    if (y === b.y && m === b.m) break;

    if (m === 12) {
      y += 1;
      m = 1;
    } else {
      m += 1;
    }
    d = 1;
  }

  return ratio;
}
