import type {
  RapportActiviteFiche,
  RapportActiviteProjet,
  RapportBrouillonState,
  RapportDomaineDef,
  SiteContenuRapport,
} from "./rapportActiviteTypes";
import {
  brouillonVidePourProjet,
  contenuSiteVide,
} from "./rapportActiviteTypes";

function fichesValidesTriees(
  fiches: RapportActiviteFiche[],
  projetId: string,
): RapportActiviteFiche[] {
  const pid = projetId.trim();
  return fiches
    .filter((f) => f.projetId === pid && f.statut === "valide")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function fusionnerTexteDomaines(
  a: Record<string, { texte?: string; infos?: string[]; photos: string[] }>,
  b: Record<string, { texte?: string; infos?: string[]; photos: string[] }>,
): Record<string, { texte?: string; infos?: string[]; photos: string[] }> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, { texte?: string; infos?: string[]; photos: string[] }> = {};
  for (const k of keys) {
    const ta = (a[k]?.texte ?? "").trim();
    const tb = (b[k]?.texte ?? "").trim();
    const texte = [ta, tb].filter(Boolean).join("\n\n—\n\n");
    const infos = [
      ...((Array.isArray(a[k]?.infos) ? a[k]!.infos! : []) as string[]),
      ...((Array.isArray(b[k]?.infos) ? b[k]!.infos! : []) as string[]),
    ]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
    const photos = [...(a[k]?.photos ?? []), ...(b[k]?.photos ?? [])];
    out[k] = { texte, infos: infos.length ? infos : undefined, photos };
  }
  return out;
}

function fusionnerSites(
  acc: Record<string, SiteContenuRapport>,
  add: Record<string, SiteContenuRapport>,
  domaines: RapportDomaineDef[],
): Record<string, SiteContenuRapport> {
  const out: Record<string, SiteContenuRapport> = {};
  const ids = new Set([...Object.keys(acc), ...Object.keys(add)]);
  for (const siteId of ids) {
    const a = acc[siteId] ?? contenuSiteVide(domaines);
    const b = add[siteId];
    if (!b) {
      out[siteId] = a;
      continue;
    }
    out[siteId] = {
      domainesTexte: fusionnerTexteDomaines(a.domainesTexte, b.domainesTexte),
      tableauLignes: [
        ...a.tableauLignes,
        ...b.tableauLignes.map((r) => ({ ...r, id: crypto.randomUUID() })),
      ],
    };
  }
  return out;
}

/** Dernier rapport quotidien validé avec date strictement avant `jourISO` (YYYY-MM-DD). */
export function dernierQuotidienAvant(
  fiches: RapportActiviteFiche[],
  projetId: string,
  jourISO: string,
): RapportActiviteFiche | undefined {
  const j = jourISO.trim().slice(0, 10);
  const list = fichesValidesTriees(fiches, projetId).filter(
    (f) => f.typeRapport === "quotidien" && f.dateRapport.slice(0, 10) < j,
  );
  return list.sort((a, b) => b.dateRapport.localeCompare(a.dateRapport))[0];
}

function quotidiensDuMois(
  fiches: RapportActiviteFiche[],
  projetId: string,
  moisCle: string,
): RapportActiviteFiche[] {
  const m = moisCle.trim().slice(0, 7);
  return fiches
    .filter(
      (f) =>
        f.projetId === projetId.trim() &&
        f.statut === "valide" &&
        f.typeRapport === "quotidien" &&
        f.dateRapport.startsWith(m),
    )
    .sort((a, b) => a.dateRapport.localeCompare(b.dateRapport));
}

function mensuelsValides(
  fiches: RapportActiviteFiche[],
  projetId: string,
): RapportActiviteFiche[] {
  return fiches
    .filter(
      (f) =>
        f.projetId === projetId.trim() &&
        f.statut === "valide" &&
        f.typeRapport === "mensuel",
    )
    .sort((a, b) => (a.moisCle ?? "").localeCompare(b.moisCle ?? ""));
}

/**
 * Construit un brouillon prérempli selon le type (sans écraser les clés de domaine
 * absentes des sources — aligné sur les domaines du projet).
 */
export function brouillonPrefillDepuisType(
  projet: RapportActiviteProjet,
  fiches: RapportActiviteFiche[],
  cible: Pick<
    RapportBrouillonState,
    "typeRapport" | "dateRapport" | "moisCle" | "titreDocument"
  >,
): RapportBrouillonState {
  const base = brouillonVidePourProjet(projet);
  const domaineDefs = projet.domaines;

  let mergedParSite: Record<string, SiteContenuRapport> = { ...base.parSite };
  for (const sid of Object.keys(mergedParSite)) {
    mergedParSite[sid] = contenuSiteVide(domaineDefs);
  }

  const type = cible.typeRapport;
  const jour = cible.dateRapport.slice(0, 10);
  const mois = (cible.moisCle ?? jour.slice(0, 7)).slice(0, 7);

  if (type === "simple") {
    return {
      ...base,
      ...cible,
      visuels: { ...base.visuels, photosParSite: { ...base.visuels.photosParSite } },
      parSite: mergedParSite,
    };
  }

  if (type === "quotidien") {
    const src = dernierQuotidienAvant(fiches, projet.id, jour);
    if (src?.payload?.parSite) {
      mergedParSite = fusionnerSites(
        mergedParSite,
        src.payload.parSite,
        domaineDefs,
      );
    }
    return {
      ...base,
      ...cible,
      dateRapport: jour,
      visuels: src?.payload.visuels
        ? { ...src.payload.visuels }
        : { ...base.visuels },
      parSite: mergedParSite,
      syntheseGlobale: src?.payload.syntheseGlobale ?? "",
    };
  }

  if (type === "mensuel") {
    const qs = quotidiensDuMois(fiches, projet.id, mois);
    for (const q of qs) {
      if (q.payload?.parSite) {
        mergedParSite = fusionnerSites(
          mergedParSite,
          q.payload.parSite,
          domaineDefs,
        );
      }
    }
    let syn = "";
    for (const q of qs) {
      if (q.payload?.syntheseGlobale?.trim()) {
        syn += (syn ? "\n\n—\n\n" : "") + q.payload.syntheseGlobale.trim();
      }
    }
    return {
      ...base,
      ...cible,
      moisCle: mois,
      dateRapport: `${mois}-01`,
      parSite: mergedParSite,
      syntheseGlobale: syn,
    };
  }

  /* fin_mission */
  const mens = mensuelsValides(fiches, projet.id);
  const sources: RapportActiviteFiche[] =
    mens.length > 0 ? mens : fichesValidesTriees(fiches, projet.id).filter((f) => f.typeRapport === "quotidien");

  for (const f of sources) {
    if (f.payload?.parSite) {
      mergedParSite = fusionnerSites(
        mergedParSite,
        f.payload.parSite,
        domaineDefs,
      );
    }
  }
  let synFin = "";
  for (const f of sources) {
    if (f.payload?.syntheseGlobale?.trim()) {
      synFin += (synFin ? "\n\n—\n\n" : "") + f.payload.syntheseGlobale.trim();
    }
  }

  return {
    ...base,
    ...cible,
    parSite: mergedParSite,
    syntheseGlobale: synFin,
  };
}
