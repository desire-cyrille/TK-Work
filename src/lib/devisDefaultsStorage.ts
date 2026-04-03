import {
  type DevisParametresGlobaux,
  type TarifsZone,
  PIED_PAGE_PDF_DEFAUT,
  parametresGlobauxDefaut,
} from "./devisTypes";

export const DEVIS_DEFAULTS_STORAGE_KEY = "tk-gestion-devis-defaults-v1";

function loadRaw(): DevisParametresGlobaux {
  try {
    const s = localStorage.getItem(DEVIS_DEFAULTS_STORAGE_KEY);
    if (!s) return parametresGlobauxDefaut();
    const p = JSON.parse(s) as unknown;
    if (!p || typeof p !== "object") return parametresGlobauxDefaut();
    return mergeWithDefaut(p as Partial<DevisParametresGlobaux>);
  } catch {
    return parametresGlobauxDefaut();
  }
}

function mergeTarifs(z: Partial<TarifsZone> | undefined, def: TarifsZone): TarifsZone {
  if (!z || typeof z !== "object") return { ...def };
  return {
    tarifKm: typeof z.tarifKm === "number" ? z.tarifKm : def.tarifKm,
    prixRepasDefaut:
      typeof z.prixRepasDefaut === "number"
        ? z.prixRepasDefaut
        : def.prixRepasDefaut,
    tarifHeure:
      typeof z.tarifHeure === "number" ? z.tarifHeure : def.tarifHeure,
    tarifJour: typeof z.tarifJour === "number" ? z.tarifJour : def.tarifJour,
    tarifSemaine:
      typeof z.tarifSemaine === "number" ? z.tarifSemaine : def.tarifSemaine,
    tarifMois: typeof z.tarifMois === "number" ? z.tarifMois : def.tarifMois,
  };
}

function mergeWithDefaut(
  p: Partial<DevisParametresGlobaux>,
): DevisParametresGlobaux {
  const d = parametresGlobauxDefaut();
  const pied =
    typeof p.piedPagePdf === "string" && p.piedPagePdf.trim()
      ? p.piedPagePdf
      : d.piedPagePdf;
  return {
    idf: mergeTarifs(p.idf, d.idf),
    horsIdf: mergeTarifs(p.horsIdf, d.horsIdf),
    logoPdfDataUrl:
      typeof p.logoPdfDataUrl === "string" && p.logoPdfDataUrl.trim().length > 0
        ? p.logoPdfDataUrl
        : undefined,
    piedPagePdf: pied || PIED_PAGE_PDF_DEFAUT,
  };
}

export function lireParametresDevisDefaut(): DevisParametresGlobaux {
  return loadRaw();
}

export function enregistrerParametresDevisDefaut(
  data: DevisParametresGlobaux,
): void {
  localStorage.setItem(DEVIS_DEFAULTS_STORAGE_KEY, JSON.stringify(data));
}
