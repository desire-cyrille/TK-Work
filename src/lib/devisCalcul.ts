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
