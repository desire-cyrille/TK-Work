import {
  categorieLocataireSurLogement,
  type CategorieLocataire,
  type Locataire,
} from "../types/domain";

export function libelleCategorieLocataire(c: CategorieLocataire): string {
  return c === "locataire" ? "Locataire" : "Sous-locataire";
}

/** Variante visuelle du badge (liste locataires). */
export function varianteBadgeRolesLocataire(
  l: Locataire
): "locataire" | "sous-locataire" | "mixte" {
  const roles = new Set<CategorieLocataire>();
  for (const id of l.logementsAssociesIds) {
    roles.add(categorieLocataireSurLogement(l, id));
  }
  if (roles.size > 1) return "mixte";
  if (roles.size === 1) return [...roles][0];
  return l.categorie;
}

/** Résumé des rôles lorsque la fiche couvre plusieurs biens avec rôles différents. */
export function libelleRolesLocataire(l: Locataire): string {
  const roles = new Set<CategorieLocataire>();
  for (const id of l.logementsAssociesIds) {
    roles.add(categorieLocataireSurLogement(l, id));
  }
  if (roles.size === 0) return libelleCategorieLocataire(l.categorie);
  if (roles.size === 1) {
    return libelleCategorieLocataire([...roles][0]);
  }
  return "Locataire et sous-locataire (selon le bien)";
}

/** Liste des intitulés de biens (pour affichage carte / détail). */
export function libelleBiensLocataire(
  l: Locataire,
  getLogement: (id: string) => { titre: string } | undefined
): string {
  if (!l.logementsAssociesIds.length) return "Aucun bien associé";
  const titres = l.logementsAssociesIds
    .map((id) => getLogement(id)?.titre.trim())
    .filter((t): t is string => Boolean(t));
  if (titres.length) return titres.join(" · ");
  return `${l.logementsAssociesIds.length} bien(s) (titres non résolus)`;
}

export function nomCompletLocataire(l: Locataire): string {
  if (l.typeOccupant === "personne_morale") {
    return l.raisonSociale.trim() || "Société sans dénomination";
  }
  const parts = [l.prenom.trim(), l.nom.trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : "Sans nom";
}

/** Ligne secondaire sous la raison sociale (représentant / contact) */
export function ligneRepresentantLocataire(l: Locataire): string | null {
  if (l.typeOccupant !== "personne_morale") return null;
  const parts = [l.representantPrenom.trim(), l.representantNom.trim()].filter(
    Boolean
  );
  if (!parts.length) return null;
  const civ = l.representantCivilite.trim();
  const nom = parts.join(" ");
  return civ ? `${civ} ${nom}` : nom;
}
