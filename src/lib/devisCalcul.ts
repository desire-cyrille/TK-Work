import type {
  DevisContenu,
  DevisDomainesActifs,
  DevisModele,
  DevisZone,
  DomaineActionsMultiples,
  DomaineDeplacement,
  DomaineForfait,
  DomainePermanence,
  DomaineRestauration,
  LigneActionTemps,
  LigneDeplacement,
  LigneForfait,
  LigneRestauration,
  TarifsZone,
} from "./devisTypes";

export type LigneBudget = {
  cle: keyof DevisDomainesActifs;
  libelle: string;
  montant: number;
  actif: boolean;
};

const LIBELLES: Record<keyof DevisDomainesActifs, string> = {
  deplacement: "Déplacement",
  restauration: "Restauration",
  preparationMiseEnPlace: "Préparation de la mise en place",
  miseEnPlaceTerrain: "Mise en place terrain",
  forfait: "Forfait",
  permanence: "Permanence",
};

export function montantLigneForfait(l: LigneForfait): number {
  return Math.max(0, l.quantite) * Math.max(0, l.tarifUnitaire);
}

/** Colonne « Quantité » du PDF pour une ligne forfait (qté × PU). */
export function quantiteLibelleLigneForfaitPdf(lf: LigneForfait): string {
  const q = lf.quantite.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const pu = lf.tarifUnitaire.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${q} × ${pu} €`;
}

/** Quantité seule (sans « × PU ») pour le PDF devis forfaitaire. */
export function quantiteSeuleLigneForfaitPdf(lf: LigneForfait): string {
  return lf.quantite.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

/** Détail d’un bloc forfait fusionné sur une ligne du tableau PDF. */
export type LigneForfaitPdfDetail = {
  libelle: string;
  quantite: string;
  montant: number;
};

export function totalForfait(d: DomaineForfait): number {
  let s = 0;
  for (const l of d.lignes) {
    s += montantLigneForfait(l);
  }
  return s;
}

function tarifUnite(t: TarifsZone, u: string): number {
  switch (u) {
    case "heure":
      return t.tarifHeure;
    case "jour":
      return t.tarifJour;
    case "semaine":
      return t.tarifSemaine;
    case "mois":
      return t.tarifMois;
    default:
      return 0;
  }
}

/** Montant ligne déplacement = tarif trajet HT × nombre (km informatif). */
export function montantLigneDeplacement(l: LigneDeplacement): number {
  return Math.max(0, l.tarifTrajetHt) * Math.max(0, l.nombre);
}

export function montantLigneRestauration(
  l: LigneRestauration,
  tarifs: TarifsZone,
): number {
  const puRepas = l.prixRepas > 0 ? l.prixRepas : tarifs.prixRepasDefaut;
  const repas =
    l.nbPersonnes * l.joursPresence * l.repasParJour * puRepas;
  const puPdj =
    l.prixPetitDejeuner > 0
      ? l.prixPetitDejeuner
      : tarifs.prixPetitDejeunerDefaut;
  const pdj =
    l.nbPersonnes *
    l.joursPresence *
    l.petitDejeunerParJour *
    puPdj;
  return repas + pdj;
}

export function montantLigneActionTemps(
  l: LigneActionTemps,
  tarifs: TarifsZone,
): number {
  return l.quantite * tarifUnite(tarifs, l.unite);
}

export function totalDeplacement(d: DomaineDeplacement): number {
  let s = 0;
  for (const l of d.lignes) {
    s += montantLigneDeplacement(l);
  }
  return s;
}

export function totalRestauration(
  d: DomaineRestauration,
  tarifs: TarifsZone,
): number {
  let s = 0;
  for (const l of d.lignes) {
    s += montantLigneRestauration(l, tarifs);
  }
  return s;
}

export function totalActionsMultiples(
  d: DomaineActionsMultiples,
  tarifs: TarifsZone,
): number {
  let s = 0;
  for (const b of d.blocs) {
    for (const l of b.lignes) {
      s += montantLigneActionTemps(l, tarifs);
    }
  }
  return s;
}

/** Tarif unitaire HT effectif (€) pour la permanence selon l’unité. */
export function tarifUnitairePermanence(
  p: DomainePermanence,
  tarifs: TarifsZone,
): number {
  const u = p.unite;
  if (u === "heure") {
    return p.tarifHeure > 0 ? p.tarifHeure : tarifs.tarifHeure;
  }
  if (u === "jour") {
    return p.tarifJour > 0 ? p.tarifJour : tarifs.tarifJour;
  }
  if (u === "semaine") {
    return p.tarifSemaine > 0 ? p.tarifSemaine : tarifs.tarifSemaine;
  }
  return p.tarifMois > 0 ? p.tarifMois : tarifs.tarifMois;
}

/** Montant HT = nombre × tarif unitaire selon le type. */
export function totalPermanence(
  p: DomainePermanence,
  tarifs: TarifsZone,
): number {
  return Math.max(0, p.nombre) * tarifUnitairePermanence(p, tarifs);
}

export function lignesBudget(
  contenu: DevisContenu,
  tarifs: TarifsZone,
): LigneBudget[] {
  const act = contenu.domainesActifs;
  const lignes: LigneBudget[] = [
    {
      cle: "deplacement",
      libelle: LIBELLES.deplacement,
      montant: totalDeplacement(contenu.deplacement),
      actif: act.deplacement,
    },
    {
      cle: "restauration",
      libelle: LIBELLES.restauration,
      montant: totalRestauration(contenu.restauration, tarifs),
      actif: act.restauration,
    },
    {
      cle: "preparationMiseEnPlace",
      libelle: LIBELLES.preparationMiseEnPlace,
      montant: totalActionsMultiples(
        contenu.preparationMiseEnPlace,
        tarifs,
      ),
      actif: act.preparationMiseEnPlace,
    },
    {
      cle: "miseEnPlaceTerrain",
      libelle: LIBELLES.miseEnPlaceTerrain,
      montant: totalActionsMultiples(contenu.miseEnPlaceTerrain, tarifs),
      actif: act.miseEnPlaceTerrain,
    },
    {
      cle: "forfait",
      libelle: LIBELLES.forfait,
      montant: totalForfait(contenu.forfait),
      actif: act.forfait,
    },
    {
      cle: "permanence",
      libelle: LIBELLES.permanence,
      montant: totalPermanence(contenu.permanence, tarifs),
      actif: act.permanence,
    },
  ];
  return lignes;
}

export function sousTotalBudgetHt(
  contenu: DevisContenu,
  tarifs: TarifsZone,
): number {
  return lignesBudget(contenu, tarifs)
    .filter((l) => l.actif)
    .reduce((a, l) => a + l.montant, 0);
}

export function totauxBudget(
  contenu: DevisContenu,
  tarifs: TarifsZone,
): {
  lignes: LigneBudget[];
  sousTotalHt: number;
  fraisGestion: number;
  totalHt: number;
} {
  const lignes = lignesBudget(contenu, tarifs);
  const sousTotalHt = lignes
    .filter((l) => l.actif)
    .reduce((a, l) => a + l.montant, 0);
  const pct = Math.max(0, contenu.fraisGestionPourcent);
  const fraisGestion = sousTotalHt * (pct / 100);
  const totalHt = sousTotalHt + fraisGestion;
  return { lignes, sousTotalHt, fraisGestion, totalHt };
}

export function tarifsPourZone(
  zone: DevisZone,
  globaux: import("./devisTypes").DevisParametresGlobaux,
): TarifsZone {
  return zone === "idf" ? globaux.idf : globaux.horsIdf;
}

/** Ordre d’affichage type tableau Excel / devis papier (modèle détaillé). */
export const ORDRE_LIGNES_PDF: (keyof DevisDomainesActifs)[] = [
  "preparationMiseEnPlace",
  "miseEnPlaceTerrain",
  "permanence",
  "deplacement",
  "restauration",
];

export function ordreLignesBudgetPdf(
  _contenu: DevisContenu,
  modele: DevisModele,
): (keyof DevisDomainesActifs)[] {
  if (modele === "forfaitaire") {
    return ["forfait", "permanence", "deplacement", "restauration"];
  }
  return [
    "preparationMiseEnPlace",
    "miseEnPlaceTerrain",
    "permanence",
    "deplacement",
    "restauration",
  ];
}

export const PDF_CATEGORIE_LIB: Record<keyof DevisDomainesActifs, string> = {
  preparationMiseEnPlace: "PRÉPARATION",
  miseEnPlaceTerrain: "MISE EN PLACE",
  forfait: "FORFAIT",
  permanence: "PERMANENCE",
  deplacement: "DÉPLACEMENT",
  restauration: "RESTAURATION",
};

/** Couleurs proches du modèle papier (RVB). */
export const PDF_CATEGORIE_COULEUR: Record<
  keyof DevisDomainesActifs,
  [number, number, number]
> = {
  preparationMiseEnPlace: [15, 118, 110],
  miseEnPlaceTerrain: [22, 163, 74],
  forfait: [196, 120, 42],
  permanence: [126, 34, 206],
  deplacement: [5, 150, 105],
  restauration: [37, 99, 235],
};

export type LigneBudgetPdf = LigneBudget & {
  quantiteLibelle: string;
  detailLigne?: string;
  /** Devis forfaitaire : une seule ligne tableau PDF, plusieurs fonctions en sous-lignes. */
  forfaitPdfBloc?: LigneForfaitPdfDetail[];
};

export function quantiteLibelleDomaine(
  cle: keyof DevisDomainesActifs,
  contenu: DevisContenu,
): string {
  switch (cle) {
    case "deplacement": {
      if (contenu.deplacement.lignes.length === 0) return "—";
      const n = contenu.deplacement.lignes.reduce(
        (a, l) => a + Math.max(0, l.nombre),
        0,
      );
      return n > 0
        ? `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`
        : "—";
    }
    case "restauration": {
      const repas = contenu.restauration.lignes.reduce(
        (a, l) =>
          a + l.nbPersonnes * l.joursPresence * l.repasParJour,
        0,
      );
      const pdj = contenu.restauration.lignes.reduce(
        (a, l) =>
          a +
          l.nbPersonnes * l.joursPresence * l.petitDejeunerParJour,
        0,
      );
      const parts: string[] = [];
      if (repas > 0) parts.push(`${Math.round(repas)} repas`);
      if (pdj > 0) parts.push(`${Math.round(pdj)} petit-déj`);
      return parts.length ? parts.join(" · ") : "—";
    }
    case "preparationMiseEnPlace":
    case "miseEnPlaceTerrain": {
      const dom =
        cle === "preparationMiseEnPlace"
          ? contenu.preparationMiseEnPlace
          : contenu.miseEnPlaceTerrain;
      let h = 0;
      let j = 0;
      let s = 0;
      let m = 0;
      for (const b of dom.blocs) {
        for (const l of b.lignes) {
          if (l.unite === "heure") h += l.quantite;
          else if (l.unite === "jour") j += l.quantite;
          else if (l.unite === "semaine") s += l.quantite;
          else m += l.quantite;
        }
      }
      const parts: string[] = [];
      if (h) parts.push(`${h} h`);
      if (j) parts.push(`${j} j`);
      if (s) parts.push(`${s} sem.`);
      if (m) parts.push(`${m} m.`);
      return parts.length ? parts.join(" · ") : "—";
    }
    case "forfait": {
      const n = contenu.forfait.lignes.length;
      return n ? `${n} poste${n > 1 ? "s" : ""}` : "—";
    }
    case "permanence": {
      const p = contenu.permanence;
      if (p.nombre <= 0) return "—";
      const suf =
        p.unite === "heure"
          ? " h"
          : p.unite === "jour"
            ? " j."
            : p.unite === "semaine"
              ? " sem."
              : " m.";
      return `${p.nombre.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}${suf}`;
    }
    default:
      return "—";
  }
}

export function detailSousLignePdf(
  cle: keyof DevisDomainesActifs,
  contenu: DevisContenu,
): string | undefined {
  switch (cle) {
    case "permanence": {
      const p = contenu.permanence;
      const base =
        "Montant = nombre × tarif unitaire (type) ; tarifs 0 € = grille zone";
      if (p.nbHeuresParJour > 0) {
        return `${base} — variables : ${p.nbHeuresParJour} h/j`;
      }
      return base;
    }
    case "deplacement":
      return "Synthèse : somme des prix totaux (tarif trajet HT × nombre)";
    case "restauration":
      return "Repas et petits-déjeuners (personnes × jours × repas ou pdj/j)";
    case "forfait":
      return "Montant par ligne : quantité × tarif unitaire HT";
    default:
      return undefined;
  }
}

export function lignesBudgetPourPdf(
  contenu: DevisContenu,
  tarifs: TarifsZone,
  modele: DevisModele = "detaille",
): LigneBudgetPdf[] {
  const base = lignesBudget(contenu, tarifs);
  const map = new Map(base.map((l) => [l.cle, l]));
  const order = ordreLignesBudgetPdf(contenu, modele);
  const out: LigneBudgetPdf[] = [];

  for (const cle of order) {
    const l = map.get(cle)!;
    if (cle === "forfait" && modele === "forfaitaire") {
      const lignesF = contenu.forfait.lignes;
      if (l.actif && lignesF.length > 0) {
        const forfaitPdfBloc: LigneForfaitPdfDetail[] = lignesF.map((lf) => {
          const intitule = (lf.libelle.trim() || "Poste").toUpperCase();
          return {
            libelle: intitule,
            quantite: quantiteSeuleLigneForfaitPdf(lf),
            montant: montantLigneForfait(lf),
          };
        });
        const montantTotal = forfaitPdfBloc.reduce((a, x) => a + x.montant, 0);
        out.push({
          cle: "forfait",
          libelle: PDF_CATEGORIE_LIB.forfait,
          montant: montantTotal,
          actif: true,
          quantiteLibelle: "—",
          detailLigne: undefined,
          forfaitPdfBloc,
        });
      } else {
        out.push({
          ...l,
          libelle: PDF_CATEGORIE_LIB.forfait,
          quantiteLibelle: quantiteLibelleDomaine(cle, contenu),
          detailLigne: detailSousLignePdf(cle, contenu),
        });
      }
      continue;
    }
    out.push({
      ...l,
      libelle: PDF_CATEGORIE_LIB[cle],
      quantiteLibelle: quantiteLibelleDomaine(cle, contenu),
      detailLigne: detailSousLignePdf(cle, contenu),
    });
  }
  return out;
}
