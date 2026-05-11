import type { BiensState } from "../context/biensStorage";

export type DashboardPatrimoineStats = {
  biensSousLocation: number;
  biensPropres: number;
  nombreBailleurs: number;
};

const logementIdsActifs = (logements: BiensState["logements"]) =>
  new Set(logements.filter((l) => l.statut === "actif").map((l) => l.id));

/**
 * Indicateurs du tableau de bord « Gestion de biens ».
 * - Sous-location : logements actifs ayant au moins un bail avec sous-bailleur renseigné.
 * - Biens « propres » : logements actifs sans aucun tel bail.
 * - Bailleurs : nombre de fiches bailleur enregistrées.
 */
export function computeDashboardPatrimoineStats(
  state: Pick<BiensState, "logements" | "contratsLocation" | "bailleurs">
): DashboardPatrimoineStats {
  const actifs = logementIdsActifs(state.logements);
  const sousLocIds = new Set<string>();
  for (const c of state.contratsLocation) {
    if (!c.locataireSousBailleurId.trim()) continue;
    if (!actifs.has(c.logementId)) continue;
    sousLocIds.add(c.logementId);
  }
  let biensPropres = 0;
  for (const l of state.logements) {
    if (l.statut !== "actif") continue;
    if (!sousLocIds.has(l.id)) biensPropres += 1;
  }
  return {
    biensSousLocation: sousLocIds.size,
    biensPropres,
    nombreBailleurs: state.bailleurs.length,
  };
}
