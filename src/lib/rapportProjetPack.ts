/**
 * Export / import d’un projet « Rapport d’activité » + ses rapports enregistrés (fichier téléchargeable).
 */

import {
  aplatirAxesPourCompat,
  chargerRapportsEnregistres,
  ajouterRapportsEnFin,
  type ContenuSiteRapport,
  type RapportEnregistre,
} from "./rapportChainStorage";
import {
  ajouterProjetImporte,
  getDomainesRapportProjet,
  getProjetById,
  type RapportProjet,
  type RapportSiteProjet,
} from "./rapportProjetStorage";

export const RAPPORT_PROJET_PACK_FORMAT = "tk-gestion-rapport-projet-pack" as const;
export const RAPPORT_PROJET_PACK_VERSION = 1 as const;

export type RapportProjetPackV1 = {
  format: typeof RAPPORT_PROJET_PACK_FORMAT;
  version: typeof RAPPORT_PROJET_PACK_VERSION;
  exportedAt: string;
  projet: RapportProjet;
  rapports: RapportEnregistre[];
};

function newId() {
  return crypto.randomUUID();
}

export function buildRapportProjetPack(projetId: string): RapportProjetPackV1 | null {
  const projet = getProjetById(projetId.trim());
  if (!projet) return null;
  const pid = projet.id;
  const rapports = chargerRapportsEnregistres()
    .filter((r) => r.projetId === pid)
    .map((r) => structuredClone(r) as RapportEnregistre);
  return {
    format: RAPPORT_PROJET_PACK_FORMAT,
    version: RAPPORT_PROJET_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    projet: structuredClone(projet) as RapportProjet,
    rapports,
  };
}

export function telechargerRapportProjetPack(projetId: string): boolean {
  const pack = buildRapportProjetPack(projetId);
  if (!pack) return false;
  const blob = new Blob([JSON.stringify(pack, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  const slug = pack.projet.titre
    .replace(/[^\w\u00C0-\u024f\-]+/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  a.download = `rapport-projet_${slug || "export"}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

function isRapportProjetShape(o: unknown): o is RapportProjet {
  if (!o || typeof o !== "object") return false;
  const p = o as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.titre === "string" &&
    Array.isArray(p.sites) &&
    p.sites.length >= 1 &&
    Array.isArray(p.domainesRapport) &&
    p.domainesRapport.length >= 1
  );
}

export function parseRapportProjetPackJson(
  text: string,
):
  | { ok: true; data: RapportProjetPackV1 }
  | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "Fichier JSON invalide." };
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Contenu JSON attendu : objet racine." };
  }
  const o = raw as Record<string, unknown>;
  if (o.format !== RAPPORT_PROJET_PACK_FORMAT) {
    return {
      ok: false,
      error:
        "Ce fichier n’est pas un export de projet Rapport (format tk-gestion-rapport-projet-pack attendu).",
    };
  }
  if (o.version !== RAPPORT_PROJET_PACK_VERSION) {
    return {
      ok: false,
      error: `Version d’export non prise en charge (reçu : ${String(o.version)}).`,
    };
  }
  if (typeof o.exportedAt !== "string" || !o.exportedAt.trim()) {
    return { ok: false, error: "Export incomplet (date manquante)." };
  }
  if (!isRapportProjetShape(o.projet)) {
    return { ok: false, error: "Projet invalide dans le fichier (titre, sites, domaines)." };
  }
  if (!Array.isArray(o.rapports)) {
    return { ok: false, error: "Liste de rapports invalide." };
  }
  return {
    ok: true,
    data: {
      format: RAPPORT_PROJET_PACK_FORMAT,
      version: RAPPORT_PROJET_PACK_VERSION,
      exportedAt: o.exportedAt.trim(),
      projet: o.projet as RapportProjet,
      rapports: o.rapports as RapportEnregistre[],
    },
  };
}

function remapPhotosMensuelSelection(
  sel: string[] | undefined,
  rapportIdMap: Map<string, string>,
  siteIdMap: Map<string, string>,
): string[] | undefined {
  if (!sel?.length) return sel;
  return sel.map((cle) => {
    const parts = cle.split("|");
    if (parts.length !== 3) return cle;
    const [rid, sid, did] = parts;
    const nr = rapportIdMap.get(rid) ?? rid;
    const ns = siteIdMap.get(sid) ?? sid;
    return `${nr}|${ns}|${did}`;
  });
}

function cloneContenuParSite(
  rows: ContenuSiteRapport[],
  siteIdMap: Map<string, string>,
  fallbackSiteId: string,
): ContenuSiteRapport[] {
  return rows.map((c) => {
    let sid = c.siteId;
    if (sid === "__legacy__") sid = fallbackSiteId;
    else sid = siteIdMap.get(sid) ?? sid;
    const axes = structuredClone(c.axes) as ContenuSiteRapport["axes"];
    return {
      siteId: sid,
      axes,
      ...(c.tableauSuivi
        ? { tableauSuivi: structuredClone(c.tableauSuivi) }
        : {}),
    };
  });
}

export type ImporterRapportProjetPackResult =
  | { ok: true; nouveauProjetId: string; rapportsImportes: number }
  | { ok: false; error: string };

/**
 * Crée un **nouveau** projet et de nouveaux brouillons de rapports (nouveaux id),
 * pour éviter tout conflit avec les données déjà présentes.
 */
export function importerRapportProjetPackCommeNouveau(
  pack: RapportProjetPackV1,
): ImporterRapportProjetPackResult {
  const oldProjetId = pack.projet.id;
  const srcRapports = pack.rapports.filter((r) => r.projetId === oldProjetId);
  if (srcRapports.length !== pack.rapports.length) {
    return {
      ok: false,
      error:
        "Le fichier contient des rapports liés à un autre projet : import annulé.",
    };
  }

  const now = new Date().toISOString();
  const newProjetId = newId();
  const oldSites = pack.projet.sites;
  if (!oldSites.length) {
    return { ok: false, error: "Le projet exporté n’a aucun site." };
  }

  const siteIdMap = new Map<string, string>();
  const newSites: RapportSiteProjet[] = oldSites.map((s, i) => {
    const id = `${newProjetId}-s${i}`;
    siteIdMap.set(s.id, id);
    return {
      id,
      nom: typeof s.nom === "string" && s.nom.trim() ? s.nom.trim() : `Site ${i + 1}`,
      photoDataUrl:
        typeof s.photoDataUrl === "string" && s.photoDataUrl.startsWith("data:")
          ? s.photoDataUrl
          : undefined,
    };
  });

  const nouveauProjet: RapportProjet = {
    ...pack.projet,
    id: newProjetId,
    sites: newSites,
    nombreSites: newSites.length,
    archived: false,
    archivedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };

  const domaines = getDomainesRapportProjet(nouveauProjet);
  const fallbackSiteId = newSites[0]?.id ?? "";

  const sorted = [...srcRapports].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const rapportIdMap = new Map<string, string>();
  for (const r of sorted) {
    rapportIdMap.set(r.id, newId());
  }

  const nouveauxRapports: RapportEnregistre[] = sorted.map((r) => {
    const nid = rapportIdMap.get(r.id)!;
    const contenuParSite = cloneContenuParSite(
      r.contenuParSite,
      siteIdMap,
      fallbackSiteId,
    );
    const sourceIds = r.sourceIds?.length
      ? r.sourceIds
          .map((oid) => rapportIdMap.get(oid) ?? oid)
          .filter(Boolean)
      : undefined;
    const photosMensuelSelection = remapPhotosMensuelSelection(
      r.photosMensuelSelection,
      rapportIdMap,
      siteIdMap,
    );
    return {
      id: nid,
      projetId: newProjetId,
      mode: r.mode,
      titre: typeof r.titre === "string" ? r.titre : "Rapport",
      jourDate: r.jourDate,
      moisCle: r.moisCle,
      missionDebut: r.missionDebut,
      missionFin: r.missionFin,
      clientNom: r.clientNom,
      referenceMission: r.referenceMission,
      contenuParSite,
      axes: aplatirAxesPourCompat(contenuParSite, domaines),
      observations: typeof r.observations === "string" ? r.observations : "",
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      sourceIds,
      photosMensuelSelection,
      ...(r.inclureTableauSuiviPdf === false
        ? { inclureTableauSuiviPdf: false as const }
        : {}),
    };
  });

  ajouterProjetImporte(nouveauProjet);
  ajouterRapportsEnFin(nouveauxRapports);

  return {
    ok: true,
    nouveauProjetId: newProjetId,
    rapportsImportes: nouveauxRapports.length,
  };
}
