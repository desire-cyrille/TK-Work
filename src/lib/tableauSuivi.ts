/** Tableau de suivi par site : blocs alignés sur les domaines du rapport + sujets multiples. */

import type { RapportDomaineDef } from "../data/rapportParkingDomains";

export type TableauSuiviColonne = { id: string; label: string };

export const COL_DOMAINE_ID = "ts_dom";
export const COL_SUJET_ID = "ts_suj";
/** Colonne « État » : valeurs = codes couleur uniquement (pas de texte libre). */
export const COL_ETAT_ID = "ts_etat";

export type TableauSuiviEtatCode =
  | "fonctionnel"
  | "non_fonctionnel"
  | "en_cours"
  | "impossible";

/** Libellés alignés sur la légende PDF / écran. */
export const TABLEAU_ETAT_LEGENDE: readonly {
  code: TableauSuiviEtatCode;
  label: string;
  couleur: string;
  rgb: readonly [number, number, number];
}[] = [
  {
    code: "fonctionnel",
    label: "Mis en place et fonctionnel",
    couleur: "#16a34a",
    rgb: [22, 163, 74],
  },
  {
    code: "non_fonctionnel",
    label: "Mis en place mais dysfonctionne",
    couleur: "#2563eb",
    rgb: [37, 99, 235],
  },
  {
    code: "en_cours",
    label: "En cours de mise en place",
    couleur: "#ea580c",
    rgb: [234, 88, 12],
  },
  {
    code: "impossible",
    label: "Ne peut être mis en place",
    couleur: "#171717",
    rgb: [23, 23, 23],
  },
] as const;

const ETAT_CODES_SET = new Set<string>(
  TABLEAU_ETAT_LEGENDE.map((e) => e.code),
);

/** @deprecated anciens id — migrés automatiquement */
const LEGACY_DOM = "ts_cat";
const LEGACY_SUJ = "ts_pt";

export type TableauSuiviSujetRow = {
  id: string;
  sujet: string;
  /** Colonnes autres que domaine / sujet */
  cellules: Record<string, string>;
};

export type TableauSuiviBloc = {
  /** Id domaine rapport, ou `custom:uuid` pour libellé libre */
  domaineId: string;
  domaineLabel: string;
  sujets: TableauSuiviSujetRow[];
};

export type TableauSuiviContenu = {
  blocs: TableauSuiviBloc[];
  /** Domaines du projet volontairement retirés du tableau (ne pas réinjecter à l’alignement). */
  domainesRetires?: string[];
};

/** Ancien format (une ligne = toutes les colonnes en cellules). */
export type TableauSuiviLigne = {
  id: string;
  cellules: Record<string, string>;
};

export const TABLEAU_SUIVI_COLONNES_DEFAUT: TableauSuiviColonne[] = [
  { id: COL_DOMAINE_ID, label: "Domaine" },
  { id: COL_SUJET_ID, label: "Sujet" },
  { id: "ts_resp", label: "Responsable" },
  { id: "ts_etat", label: "État" },
  { id: "ts_obs", label: "Observation" },
  { id: "ts_suivi", label: "Suivis / Relance" },
];

const SQUELETTE_SUJETS_PAR_LABEL: Record<string, string[]> = {
  Technique: ["SSI", "Désenfumage"],
  Management: ["Planning"],
  Commercial: ["Signalétique", "Site internet"],
  Infrastructure: ["Fuite"],
  Procédure: ["Exploitation"],
  Ménage: ["Matériel"],
};

function newRowId(): string {
  return crypto.randomUUID();
}

export function migrerIdsColonnesTableau(
  cols: TableauSuiviColonne[],
): TableauSuiviColonne[] {
  return cols.map((c) => {
    if (c.id === LEGACY_DOM) {
      return { ...c, id: COL_DOMAINE_ID, label: c.label.trim() || "Domaine" };
    }
    if (c.id === LEGACY_SUJ) {
      return { ...c, id: COL_SUJET_ID, label: c.label.trim() || "Sujet" };
    }
    return { ...c };
  });
}

export function dataColIds(colonnes: TableauSuiviColonne[]): string[] {
  return colonnes
    .map((c) => c.id)
    .filter((id) => id !== COL_DOMAINE_ID && id !== COL_SUJET_ID);
}

export function emptyDataCellules(colonnes: TableauSuiviColonne[]): Record<string, string> {
  return Object.fromEntries(dataColIds(colonnes).map((id) => [id, ""]));
}

export function clonerTableauSuiviContenu(ts: TableauSuiviContenu): TableauSuiviContenu {
  return structuredClone(ts);
}

/** Réduit une valeur stockée à un code état reconnu, ou chaîne vide. */
export function normaliserValeurEtat(stocke: string): string {
  const t = stocke.trim();
  if (ETAT_CODES_SET.has(t)) return t;
  if (!t) return "";
  const low = t.toLowerCase();
  if (
    low.includes("impossible") ||
    low.includes("ne peut pas") ||
    low.includes("ne peux pas") ||
    low.includes("ne peut être") ||
    low === "noir"
  ) {
    return "impossible";
  }
  if (low.includes("en cours")) return "en_cours";
  if (
    low.includes("dysfonctionne") ||
    low.includes("non fonctionnel") ||
    low.includes("non-fonctionnel") ||
    low.includes("non fonctionnelle")
  ) {
    return "non_fonctionnel";
  }
  if (
    low.includes("fonctionnel") ||
    low === "ok" ||
    low === "vert" ||
    low.includes("opérationnel")
  ) {
    return "fonctionnel";
  }
  if (low === "bleu") return "non_fonctionnel";
  if (low === "orange") return "en_cours";
  return "";
}

export function colonneEstEtat(colId: string): boolean {
  return colId === COL_ETAT_ID;
}

/** Domaine et Sujet sont obligatoires ; il doit rester au moins ces deux colonnes. */
export function peutSupprimerColonneTableau(
  colId: string,
  colonnes: TableauSuiviColonne[],
): boolean {
  if (colId === COL_DOMAINE_ID || colId === COL_SUJET_ID) return false;
  return colonnes.length > 2;
}

function filtrerDomainesRetiresValides(
  retires: string[],
  domaines: RapportDomaineDef[],
): string[] {
  const ids = new Set(domaines.map((d) => d.id));
  return [...new Set(retires.filter((id) => ids.has(id)))];
}

export function appliquerNormalisationEtatAuxCellules(
  cellules: Record<string, string>,
  colonnes: TableauSuiviColonne[],
): void {
  if (!colonnes.some((c) => c.id === COL_ETAT_ID)) return;
  cellules[COL_ETAT_ID] = normaliserValeurEtat(cellules[COL_ETAT_ID] ?? "");
}

export function createDefaultTableauBlocs(
  domaines: RapportDomaineDef[],
  colonnes: TableauSuiviColonne[],
): TableauSuiviBloc[] {
  return domaines.map((d) => {
    const seeds =
      SQUELETTE_SUJETS_PAR_LABEL[d.label] ?? [""];
    return {
      domaineId: d.id,
      domaineLabel: d.label,
      sujets: seeds.map((sujet) => ({
        id: newRowId(),
        sujet,
        cellules: { ...emptyDataCellules(colonnes) },
      })),
    };
  });
}

export function getColonnesTableauSuiviProjet(p: {
  tableauSuiviColonnes?: TableauSuiviColonne[];
} | null | undefined): TableauSuiviColonne[] {
  const raw = p?.tableauSuiviColonnes;
  if (Array.isArray(raw) && raw.length > 0) {
    const out = raw
      .map((c) => ({
        id: typeof c.id === "string" ? c.id.trim() : "",
        label: typeof c.label === "string" ? c.label : "",
      }))
      .filter((c) => c.id.length > 0);
    if (out.length > 0) return migrerIdsColonnesTableau(out.map((c) => ({ ...c })));
  }
  return TABLEAU_SUIVI_COLONNES_DEFAUT.map((c) => ({ ...c }));
}

export function normalizeColonnesTableauRaw(
  raw: unknown,
): TableauSuiviColonne[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: TableauSuiviColonne[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
    if (!id) continue;
    out.push({
      id,
      label: typeof o.label === "string" ? o.label : "",
    });
  }
  return out.length ? migrerIdsColonnesTableau(out) : undefined;
}

function migrerLignesVersBlocs(
  lignes: TableauSuiviLigne[],
  colonnes: TableauSuiviColonne[],
  domaines: RapportDomaineDef[],
): TableauSuiviBloc[] {
  const idDom = colonnes[0]?.id ?? COL_DOMAINE_ID;
  const idSuj = colonnes[1]?.id ?? COL_SUJET_ID;
  const groups = new Map<string, TableauSuiviSujetRow[]>();
  const order: string[] = [];

  for (const l of lignes) {
    const domText = (l.cellules[idDom] ?? "").trim();
    const sujText = (l.cellules[idSuj] ?? "").trim();
    const key = domText || "\u0000";
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    const cellules: Record<string, string> = {};
    for (const id of dataColIds(colonnes)) {
      cellules[id] = l.cellules[id] ?? "";
    }
    appliquerNormalisationEtatAuxCellules(cellules, colonnes);
    groups.get(key)!.push({
      id: l.id?.trim() ? l.id : newRowId(),
      sujet: sujText,
      cellules,
    });
  }

  const blocs: TableauSuiviBloc[] = [];
  for (const key of order) {
    const domText = key === "\u0000" ? "" : key;
    const d = domaines.find((x) => x.label.trim() === domText);
    const sujets = groups.get(key)!;
    if (d) {
      blocs.push({
        domaineId: d.id,
        domaineLabel: d.label,
        sujets,
      });
    } else {
      blocs.push({
        domaineId: `custom:${newRowId()}`,
        domaineLabel: domText || "—",
        sujets,
      });
    }
  }
  return blocs.length ? blocs : createDefaultTableauBlocs(domaines, colonnes);
}

export function remapBlocsPourColonnes(
  blocs: TableauSuiviBloc[],
  nouvellesColonnes: TableauSuiviColonne[],
): TableauSuiviBloc[] {
  return blocs.map((b) => ({
    ...b,
    sujets: b.sujets.map((s) => {
      const cellules: Record<string, string> = {};
      for (const id of dataColIds(nouvellesColonnes)) {
        cellules[id] = s.cellules[id] ?? "";
      }
      return { ...s, cellules };
    }),
  }));
}

export function alignerBlocsAvecDomainesRapport(
  blocs: TableauSuiviBloc[],
  domaines: RapportDomaineDef[],
  colonnes: TableauSuiviColonne[],
  domainesRetires: readonly string[] = [],
): TableauSuiviBloc[] {
  const retires = new Set(domainesRetires);
  const byId = new Map(blocs.map((b) => [b.domaineId, b]));
  const result: TableauSuiviBloc[] = [];

  for (const d of domaines) {
    if (retires.has(d.id)) continue;
    const ex = byId.get(d.id);
    if (ex) {
      result.push({
        ...ex,
        domaineLabel: d.label,
        sujets:
          ex.sujets.length > 0
            ? ex.sujets.map((s) => ({ ...s, cellules: { ...s.cellules } }))
            : [
                {
                  id: newRowId(),
                  sujet: "",
                  cellules: { ...emptyDataCellules(colonnes) },
                },
              ],
      });
    } else {
      result.push({
        domaineId: d.id,
        domaineLabel: d.label,
        sujets: [
          {
            id: newRowId(),
            sujet: "",
            cellules: { ...emptyDataCellules(colonnes) },
          },
        ],
      });
    }
  }

  const inResult = new Set(result.map((b) => b.domaineId));
  for (const b of blocs) {
    if (inResult.has(b.domaineId)) continue;
    inResult.add(b.domaineId);
    result.push({
      ...b,
      sujets:
        b.sujets.length > 0
          ? b.sujets.map((s) => ({ ...s, cellules: { ...s.cellules } }))
          : [
              {
                id: newRowId(),
                sujet: "",
                cellules: { ...emptyDataCellules(colonnes) },
              },
            ],
    });
  }

  return result;
}

export function normalizeTableauSuiviContenu(
  raw: unknown,
  colonnes: TableauSuiviColonne[],
  domaines: RapportDomaineDef[],
): TableauSuiviContenu {
  function lireRetires(source: Record<string, unknown>): string[] {
    const dr = source.domainesRetires;
    if (!Array.isArray(dr)) return [];
    return filtrerDomainesRetiresValides(
      dr
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim()),
      domaines,
    );
  }

  if (!raw || typeof raw !== "object") {
    return { blocs: createDefaultTableauBlocs(domaines, colonnes), domainesRetires: [] };
  }
  const o = raw as Record<string, unknown>;
  const domainesRetires = lireRetires(o);

  const blocsRaw = o.blocs;
  if (Array.isArray(blocsRaw) && blocsRaw.length > 0) {
    const blocs: TableauSuiviBloc[] = [];
    for (const row of blocsRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const domaineId =
        typeof r.domaineId === "string" && r.domaineId.trim()
          ? r.domaineId.trim()
          : `custom:${newRowId()}`;
      const domaineLabel =
        typeof r.domaineLabel === "string" ? r.domaineLabel : "—";
      const sujetsRaw = r.sujets;
      const sujets: TableauSuiviSujetRow[] = [];
      if (Array.isArray(sujetsRaw)) {
        for (const sr of sujetsRaw) {
          if (!sr || typeof sr !== "object") continue;
          const s = sr as Record<string, unknown>;
          const id =
            typeof s.id === "string" && s.id.trim() ? s.id.trim() : newRowId();
          const sujet = typeof s.sujet === "string" ? s.sujet : "";
          const cellules: Record<string, string> = {};
          if (s.cellules && typeof s.cellules === "object" && s.cellules !== null) {
            const cr = s.cellules as Record<string, unknown>;
            for (const cid of dataColIds(colonnes)) {
              const v = cr[cid];
              cellules[cid] = typeof v === "string" ? v : "";
            }
          } else {
            Object.assign(cellules, emptyDataCellules(colonnes));
          }
          appliquerNormalisationEtatAuxCellules(cellules, colonnes);
          sujets.push({ id, sujet, cellules });
        }
      }
      blocs.push({
        domaineId,
        domaineLabel,
        sujets:
          sujets.length > 0
            ? sujets
            : [
                {
                  id: newRowId(),
                  sujet: "",
                  cellules: { ...emptyDataCellules(colonnes) },
                },
              ],
      });
    }
    if (blocs.length) {
      return {
        blocs: alignerBlocsAvecDomainesRapport(
          blocs,
          domaines,
          colonnes,
          domainesRetires,
        ),
        domainesRetires,
      };
    }
  }

  const lignesRaw = o.lignes;
  if (Array.isArray(lignesRaw) && lignesRaw.length > 0) {
    const lignes: TableauSuiviLigne[] = [];
    for (const row of lignesRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id =
        typeof r.id === "string" && r.id.trim() ? r.id.trim() : newRowId();
      const cellules: Record<string, string> = {};
      if (r.cellules && typeof r.cellules === "object" && r.cellules !== null) {
        const cr = r.cellules as Record<string, unknown>;
        for (const c of colonnes) {
          const v = cr[c.id];
          cellules[c.id] = typeof v === "string" ? v : "";
        }
      }
      lignes.push({ id, cellules });
    }
    return {
      blocs: alignerBlocsAvecDomainesRapport(
        migrerLignesVersBlocs(lignes, colonnes, domaines),
        domaines,
        colonnes,
        domainesRetires,
      ),
      domainesRetires,
    };
  }

  return {
    blocs: createDefaultTableauBlocs(domaines, colonnes),
    domainesRetires: [],
  };
}

export function tableauSuiviBlocsNonVides(contenu: TableauSuiviContenu): boolean {
  for (const b of contenu.blocs) {
    for (const s of b.sujets) {
      if (s.sujet.trim()) return true;
      for (const v of Object.values(s.cellules)) {
        if (v.trim()) return true;
      }
    }
  }
  return false;
}

export function fusionnerTableauSuiviPourSite<
  R extends {
    contenuParSite: { siteId: string; tableauSuivi?: TableauSuiviContenu }[];
  },
>(
  rapports: R[],
  siteId: string,
  colonnes: TableauSuiviColonne[],
  domaines: RapportDomaineDef[],
  libelleSource: (r: R) => string,
): TableauSuiviContenu {
  type Pack = {
    label: string;
    sujets: Map<string, Record<string, string>>;
  };
  const domainMap = new Map<string, Pack>();

  const retiresUnion = filtrerDomainesRetiresValides(
    [
      ...new Set(
        rapports.flatMap((r) => {
          const b = r.contenuParSite.find((c) => c.siteId === siteId);
          return b?.tableauSuivi?.domainesRetires ?? [];
        }),
      ),
    ],
    domaines,
  );

  for (const r of rapports) {
    const siteBloc = r.contenuParSite.find((c) => c.siteId === siteId);
    const blocs = siteBloc?.tableauSuivi?.blocs ?? [];
    for (const b of blocs) {
      if (!domainMap.has(b.domaineId)) {
        domainMap.set(b.domaineId, {
          label: b.domaineLabel,
          sujets: new Map(),
        });
      }
      const pack = domainMap.get(b.domaineId)!;
      if (b.domaineLabel.trim()) pack.label = b.domaineLabel;
      for (const s of b.sujets) {
        const sk = s.sujet.trim() || `\u0000${s.id}`;
        const cur = pack.sujets.get(sk);
        if (!cur) {
          const copy = { ...s.cellules };
          appliquerNormalisationEtatAuxCellules(copy, colonnes);
          pack.sujets.set(sk, copy);
        } else {
          for (const cid of dataColIds(colonnes)) {
            if (cid === COL_ETAT_ID) {
              const vNorm = normaliserValeurEtat(s.cellules[cid] ?? "");
              if (vNorm) cur[cid] = vNorm;
              continue;
            }
            const a = (cur[cid] ?? "").trim();
            const v = (s.cellules[cid] ?? "").trim();
            if (v) {
              cur[cid] = a ? `${a}\n[${libelleSource(r)}]\n${v}` : v;
            }
          }
        }
      }
    }
  }

  if (domainMap.size === 0) {
    if (retiresUnion.length === 0) {
      return {
        blocs: createDefaultTableauBlocs(domaines, colonnes),
        domainesRetires: [],
      };
    }
    return {
      blocs: alignerBlocsAvecDomainesRapport(
        [],
        domaines,
        colonnes,
        retiresUnion,
      ),
      domainesRetires: retiresUnion,
    };
  }

  const toSujetRows = (pack: Pack): TableauSuiviSujetRow[] =>
    [...pack.sujets.entries()].map(([sk, cellules]) => ({
      id: newRowId(),
      sujet: sk.startsWith("\u0000") ? "" : sk,
      cellules: { ...cellules },
    }));

  const blocs: TableauSuiviBloc[] = [];
  for (const d of domaines) {
    const pack = domainMap.get(d.id);
    if (!pack || pack.sujets.size === 0) continue;
    blocs.push({
      domaineId: d.id,
      domaineLabel: d.label,
      sujets: toSujetRows(pack),
    });
  }
  for (const [domaineId, pack] of domainMap) {
    if (domaines.some((d) => d.id === domaineId)) continue;
    if (pack.sujets.size === 0) continue;
    blocs.push({
      domaineId,
      domaineLabel: pack.label,
      sujets: toSujetRows(pack),
    });
  }

  if (blocs.length === 0) {
    if (retiresUnion.length === 0) {
      return {
        blocs: createDefaultTableauBlocs(domaines, colonnes),
        domainesRetires: [],
      };
    }
    return {
      blocs: alignerBlocsAvecDomainesRapport(
        [],
        domaines,
        colonnes,
        retiresUnion,
      ),
      domainesRetires: retiresUnion,
    };
  }

  return {
    blocs: alignerBlocsAvecDomainesRapport(
      blocs,
      domaines,
      colonnes,
      retiresUnion,
    ),
    domainesRetires: retiresUnion,
  };
}
