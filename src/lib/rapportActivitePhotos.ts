/**
 * Plafonds d’import des photos de rapport d’activité.
 * Les binaires vont en IndexedDB (pas dans le JSON du projet).
 * Le PDF affiche l’ensemble des photos importées (plus seulement les 3 premières).
 */

/** Photos par domaine, pour un site. */
export const MAX_PHOTOS_DOMAINE = 24;

/** Photos d’aperçu / visuels par site. */
export const MAX_PHOTOS_VISUELS_PAR_SITE = 36;

export function messagePlafondPhotos(
  contexte: string,
  plafond: number,
  ignorees: number,
): string {
  if (ignorees <= 0) return "";
  return `${contexte} : plafond de ${plafond} photos atteint. ${ignorees} fichier(s) non ajouté(s).`;
}
