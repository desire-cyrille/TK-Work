/** Colonnes et lignes du tableau de suivi (rapport d’activité), par site. */

export type TableauSuiviColonne = { id: string; label: string };

export type TableauSuiviLigne = {
  id: string;
  cellules: Record<string, string>;
};

export type TableauSuiviContenu = {
  lignes: TableauSuiviLigne[];
};

/** Défaut aligné sur la maquette (deux premières en-têtes vides dans le modèle). */
export const TABLEAU_SUIVI_COLONNES_DEFAUT: TableauSuiviColonne[] = [
  { id: "ts_cat", label: "" },
  { id: "ts_pt", label: "" },
  { id: "ts_resp", label: "Responsable" },
  { id: "ts_etat", label: "État" },
  { id: "ts_obs", label: "Observation" },
  { id: "ts_suivi", label: "Suivis / Relance" },
];

const SQUELETTE_LIGNES: { c0: string; c1: string }[] = [
  { c0: "Technique", c1: "SSI" },
  { c0: "Technique", c1: "DESENFUMAGE" },
  { c0: "Management", c1: "Planning" },
  { c0: "Commercial", c1: "Signalétique" },
  { c0: "Commercial", c1: "Site internet" },
  { c0: "Infrastructure", c1: "Fuite" },
  { c0: "Procédure", c1: "Exploitation" },
  { c0: "Ménage", c1: "Matériel" },
];

function newRowId(): string {
  return crypto.randomUUID();
}

function emptyCellules(colIds: string[]): Record<string, string> {
  return Object.fromEntries(colIds.map((id) => [id, ""]));
}

export function createDefaultTableauLignes(
  colonnes: TableauSuiviColonne[],
): TableauSuiviLigne[] {
  const ids = colonnes.map((c) => c.id);
  const id0 = ids[0];
  const id1 = ids[1];
  return SQUELETTE_LIGNES.map((sk) => {
    const cellules = emptyCellules(ids);
    if (id0) cellules[id0] = sk.c0;
    if (id1) cellules[id1] = sk.c1;
    return {
      id: newRowId(),
      cellules,
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
    if (out.length > 0) return out.map((c) => ({ ...c }));
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
  return out.length ? out : undefined;
}

export function remapLignesPourColonnes(
  lignes: TableauSuiviLigne[],
  nouvellesColonnes: TableauSuiviColonne[],
): TableauSuiviLigne[] {
  return lignes.map((l) => {
    const cellules: Record<string, string> = {};
    for (const c of nouvellesColonnes) {
      cellules[c.id] = l.cellules[c.id] ?? "";
    }
    return { ...l, cellules };
  });
}

function ligneCleFusion(ligne: TableauSuiviLigne, colonnes: TableauSuiviColonne[]): string {
  const a = colonnes[0]?.id;
  const b = colonnes[1]?.id;
  if (a && b) {
    return `${(ligne.cellules[a] ?? "").trim()}\n${(ligne.cellules[b] ?? "").trim()}`;
  }
  if (a) return (ligne.cellules[a] ?? "").trim() || ligne.id;
  return ligne.id;
}

export function normalizeTableauSuiviContenu(
  raw: unknown,
  colonnes: TableauSuiviColonne[],
): TableauSuiviContenu {
  const colIds = colonnes.map((c) => c.id);
  if (!raw || typeof raw !== "object") {
    return { lignes: createDefaultTableauLignes(colonnes) };
  }
  const o = raw as Record<string, unknown>;
  const lignesRaw = o.lignes;
  if (!Array.isArray(lignesRaw) || lignesRaw.length === 0) {
    return { lignes: createDefaultTableauLignes(colonnes) };
  }
  const id0 = colonnes[0]?.id;
  const id1 = colonnes[1]?.id;
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
    } else {
      Object.assign(cellules, emptyCellules(colIds));
    }
    const legCat = typeof r.categorie === "string" ? r.categorie : "";
    const legSub = typeof r.sousLibelle === "string" ? r.sousLibelle : "";
    if (legCat && id0 && !cellules[id0]?.trim()) cellules[id0] = legCat;
    if (legSub && id1 && !cellules[id1]?.trim()) cellules[id1] = legSub;
    lignes.push({ id, cellules });
  }
  return lignes.length
    ? { lignes }
    : { lignes: createDefaultTableauLignes(colonnes) };
}

export function fusionnerTableauSuiviPourSite<
  R extends {
    contenuParSite: { siteId: string; tableauSuivi?: TableauSuiviContenu }[];
  },
>(
  rapports: R[],
  siteId: string,
  colonnes: TableauSuiviColonne[],
  libelleSource: (r: R) => string,
): TableauSuiviContenu {
  const map = new Map<string, TableauSuiviLigne>();
  for (const r of rapports) {
    const bloc = r.contenuParSite.find((c) => c.siteId === siteId);
    const lignes = bloc?.tableauSuivi?.lignes ?? [];
    for (const ligne of lignes) {
      const k = ligneCleFusion(ligne, colonnes);
      const prev = map.get(k);
      if (!prev) {
        map.set(k, {
          id: ligne.id?.trim() ? ligne.id : newRowId(),
          cellules: { ...ligne.cellules },
        });
      } else {
        for (const c of colonnes) {
          const a = (prev.cellules[c.id] ?? "").trim();
          const b = (ligne.cellules[c.id] ?? "").trim();
          if (b) {
            prev.cellules[c.id] = a
              ? `${a}\n[${libelleSource(r)}]\n${b}`
              : b;
          }
        }
      }
    }
  }
  return {
    lignes: map.size ? [...map.values()] : createDefaultTableauLignes(colonnes),
  };
}
