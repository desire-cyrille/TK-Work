import type {
  DevisContenu,
  DevisDomainesActifs,
  DevisZone,
  DomaineActionsMultiples,
  DomaineDeplacement,
  DomainePermanence,
  DomaineRestauration,
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
  permanence: "Permanence",
};

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

export function totalDeplacement(
  d: DomaineDeplacement,
  tarifs: TarifsZone,
): number {
  let s = 0;
  for (const l of d.lignes) {
    s +=
      l.nbPersonnes *
      l.distanceKm *
      tarifs.tarifKm *
      Math.max(0, l.coefficientDuree);
  }
  return s;
}

export function totalRestauration(
  d: DomaineRestauration,
  tarifs: TarifsZone,
): number {
  let s = 0;
  for (const l of d.lignes) {
    const pu =
      l.prixRepas > 0 ? l.prixRepas : tarifs.prixRepasDefaut;
    s += l.nbPersonnes * l.joursPresence * l.repasParJour * pu;
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
      s += l.quantite * tarifUnite(tarifs, l.unite);
    }
  }
  return s;
}

export function totalPermanence(p: DomainePermanence): number {
  switch (p.mode) {
    case "forfait_jours":
      return Math.max(0, p.nombreJoursTotal) * p.tarifJour;
    case "par_semaine":
      return (
        Math.max(0, p.nbSemaines) *
        Math.max(0, p.nbJoursParSemaine) *
        p.tarifJour
      );
    case "horaire":
      return (
        Math.max(0, p.nbSemaines) *
        Math.max(0, p.nbJoursParSemaine) *
        Math.max(0, p.nbHeuresParJour) *
        p.tarifHeure
      );
    default:
      return 0;
  }
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
      montant: totalDeplacement(contenu.deplacement, tarifs),
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
      cle: "permanence",
      libelle: LIBELLES.permanence,
      montant: totalPermanence(contenu.permanence),
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

/** Ordre d’affichage type tableau Excel / devis papier. */
export const ORDRE_LIGNES_PDF: (keyof DevisDomainesActifs)[] = [
  "preparationMiseEnPlace",
  "miseEnPlaceTerrain",
  "permanence",
  "deplacement",
  "restauration",
];

export const PDF_CATEGORIE_LIB: Record<keyof DevisDomainesActifs, string> = {
  preparationMiseEnPlace: "PRÉPARATION",
  miseEnPlaceTerrain: "MISE EN PLACE",
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
  permanence: [126, 34, 206],
  deplacement: [5, 150, 105],
  restauration: [37, 99, 235],
};

export type LigneBudgetPdf = LigneBudget & {
  quantiteLibelle: string;
  detailLigne?: string;
};

export function quantiteLibelleDomaine(
  cle: keyof DevisDomainesActifs,
  contenu: DevisContenu,
): string {
  switch (cle) {
    case "deplacement": {
      if (contenu.deplacement.lignes.length === 0) return "—";
      const coef = contenu.deplacement.lignes.reduce(
        (a, l) => a + Math.max(0, l.coefficientDuree),
        0,
      );
      if (coef > 0) {
        return `${coef.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} j.`;
      }
      const km = contenu.deplacement.lignes.reduce(
        (a, l) => a + l.nbPersonnes * l.distanceKm,
        0,
      );
      return km > 0 ? `${km.toFixed(0)} km` : "—";
    }
    case "restauration": {
      const n = contenu.restauration.lignes.reduce(
        (a, l) =>
          a + l.nbPersonnes * l.joursPresence * l.repasParJour,
        0,
      );
      return n > 0 ? `${Math.round(n)} repas` : "—";
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
    case "permanence": {
      const p = contenu.permanence;
      if (p.mode === "forfait_jours") {
        return p.nombreJoursTotal > 0 ? `${p.nombreJoursTotal} j.` : "—";
      }
      const jours = p.nbSemaines * p.nbJoursParSemaine;
      return jours > 0
        ? `${jours.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} j.`
        : "—";
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
      if (p.nbHeuresParJour > 0) {
        return `Estimé à ${p.nbHeuresParJour} h / jour`;
      }
      return undefined;
    }
    case "deplacement":
      return "Calculé au km (personnes × distance × durée)";
    case "restauration":
      return "Repas facturés (personnes × jours × repas/j)";
    default:
      return undefined;
  }
}

export function lignesBudgetPourPdf(
  contenu: DevisContenu,
  tarifs: TarifsZone,
): LigneBudgetPdf[] {
  const base = lignesBudget(contenu, tarifs);
  const map = new Map(base.map((l) => [l.cle, l]));
  return ORDRE_LIGNES_PDF.map((cle) => {
    const l = map.get(cle)!;
    return {
      ...l,
      libelle: PDF_CATEGORIE_LIB[cle],
      quantiteLibelle: quantiteLibelleDomaine(cle, contenu),
      detailLigne: detailSousLignePdf(cle, contenu),
    };
  });
}
