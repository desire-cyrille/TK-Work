/**
 * Duplication de devis (lecture + copie). Ne réécrit pas le devis source.
 * Les dates ISO / JJ/MM/AAAA trouvées dans les textes sont décalées
 * selon la nouvelle date du devis.
 */

import type { DevisContenu } from "./devisTypes";
import { newId, normaliserContenuDevis } from "./devisTypes";

type DevisPourGroupe = {
  titre: string;
  dateDevis?: string;
  createdAt: string;
};

export function dateDevisEffective(
  d: Pick<DevisPourGroupe, "dateDevis" | "createdAt">,
): string {
  const explicit = (d.dateDevis ?? "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const created = (d.createdAt ?? "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(created)) return created;
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function titreGroupeCle(titre: string): string {
  return titre.trim().toLowerCase().replace(/\s+/g, " ");
}

export type DevisGroupeTitre<T extends DevisPourGroupe = DevisPourGroupe> = {
  cle: string;
  titre: string;
  devis: T[];
};

/** Regroupe les devis de même titre (casse / espaces ignorés). */
export function regrouperDevisParTitre<T extends DevisPourGroupe>(
  liste: T[],
): DevisGroupeTitre<T>[] {
  const map = new Map<string, DevisGroupeTitre<T>>();
  const order: string[] = [];
  for (const d of liste) {
    const cle = titreGroupeCle(d.titre) || "sans titre";
    let g = map.get(cle);
    if (!g) {
      g = { cle, titre: d.titre.trim() || "Sans titre", devis: [] };
      map.set(cle, g);
      order.push(cle);
    }
    g.devis.push(d);
  }
  return order.map((cle) => {
    const g = map.get(cle)!;
    g.devis.sort((a, b) =>
      dateDevisEffective(b).localeCompare(dateDevisEffective(a)),
    );
    return g;
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function utcYmd(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function addDaysIso(iso: string, deltaDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function deltaJoursIso(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T12:00:00Z`);
  const b = Date.parse(`${toIso}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function decalerDatesDansTexte(texte: string, deltaDays: number): string {
  if (!texte || deltaDays === 0) return texte;
  const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  const FR = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g;
  let out = texte.replace(ISO, (full, ys, ms, ds) => {
    const iso = utcYmd(Number(ys), Number(ms), Number(ds));
    if (!iso) return full;
    return addDaysIso(iso, deltaDays) ?? full;
  });
  out = out.replace(FR, (full, ds, ms, ys) => {
    const iso = utcYmd(Number(ys), Number(ms), Number(ds));
    if (!iso) return full;
    const next = addDaysIso(iso, deltaDays);
    if (!next) return full;
    const sep = full.includes(".") ? "." : "/";
    const [y, m, d] = next.split("-");
    const dPart = String(ds).length === 1 ? String(Number(d)) : d;
    const mPart = String(ms).length === 1 ? String(Number(m)) : m;
    return `${dPart}${sep}${mPart}${sep}${y}`;
  });
  return out;
}

function decalerChaine(v: string, delta: number): string {
  return decalerDatesDansTexte(v, delta);
}

/** Recopie le contenu avec de nouveaux identifiants internes (blocs / lignes). */
export function clonerContenuDevisAvecNouveauxIds(
  contenu: DevisContenu,
): DevisContenu {
  const c = normaliserContenuDevis(
    JSON.parse(JSON.stringify(contenu)) as DevisContenu,
  );
  c.preparationMiseEnPlace = {
    blocs: c.preparationMiseEnPlace.blocs.map((b) => ({
      ...b,
      id: newId(),
      lignes: b.lignes.map((l) => ({ ...l, id: newId() })),
    })),
  };
  c.miseEnPlaceTerrain = {
    blocs: c.miseEnPlaceTerrain.blocs.map((b) => ({
      ...b,
      id: newId(),
      lignes: b.lignes.map((l) => ({ ...l, id: newId() })),
    })),
  };
  c.deplacement = {
    lignes: c.deplacement.lignes.map((l) => ({ ...l, id: newId() })),
  };
  c.restauration = {
    lignes: c.restauration.lignes.map((l) => ({ ...l, id: newId() })),
  };
  c.forfait = {
    lignes: c.forfait.lignes.map((l) => ({ ...l, id: newId() })),
  };
  return c;
}

export function decalerDatesContenu(
  contenu: DevisContenu,
  deltaDays: number,
): DevisContenu {
  if (deltaDays === 0) return contenu;
  const c = JSON.parse(JSON.stringify(contenu)) as DevisContenu;
  c.titrePageGarde = decalerChaine(c.titrePageGarde, deltaDays);
  c.sousTitrePageGarde = decalerChaine(c.sousTitrePageGarde, deltaDays);
  c.descriptionPrestation = decalerChaine(c.descriptionPrestation, deltaDays);
  c.texteConclusion = decalerChaine(c.texteConclusion, deltaDays);
  c.deplacement = {
    lignes: c.deplacement.lignes.map((l) => ({
      ...l,
      adresseDepart: decalerChaine(l.adresseDepart, deltaDays),
      adresseArrivee: decalerChaine(l.adresseArrivee, deltaDays),
    })),
  };
  c.restauration = {
    lignes: c.restauration.lignes.map((l) => ({
      ...l,
      libelle: decalerChaine(l.libelle, deltaDays),
    })),
  };
  c.preparationMiseEnPlace = {
    blocs: c.preparationMiseEnPlace.blocs.map((b) => ({
      ...b,
      titre: decalerChaine(b.titre, deltaDays),
      lignes: b.lignes.map((l) => ({
        ...l,
        libelle: decalerChaine(l.libelle, deltaDays),
      })),
    })),
  };
  c.miseEnPlaceTerrain = {
    blocs: c.miseEnPlaceTerrain.blocs.map((b) => ({
      ...b,
      titre: decalerChaine(b.titre, deltaDays),
      lignes: b.lignes.map((l) => ({
        ...l,
        libelle: decalerChaine(l.libelle, deltaDays),
      })),
    })),
  };
  c.forfait = {
    lignes: c.forfait.lignes.map((l) => ({
      ...l,
      libelle: decalerChaine(l.libelle, deltaDays),
    })),
  };
  return c;
}
