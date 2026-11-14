/**
 * Calcul du montant à verser au sous-traitant.
 * Lecture des ventilations déjà enregistrées — ne modifie pas le store.
 */

import {
  AIRBNB_LISTINGS,
  airbnbListingIsActiveInMonth,
  type AirbnbListingId,
  type AirbnbState,
} from "../types/airbnb";
import {
  cloneSousTraitance,
  listingCaFromVentilation,
  parseEuroInputDisplay,
} from "./airbnbStorage";

export type SousTraitancePayoutRow = {
  listingId: AirbnbListingId;
  label: string;
  active: boolean;
  ca: number;
  due: number;
};

export type SousTraitancePayout = {
  rows: SousTraitancePayoutRow[];
  caTotal: number;
  dueTotal: number;
};

export function resolvedSousTraitanceListingIds(
  listingIds: AirbnbListingId[],
): AirbnbListingId[] {
  if (listingIds.length === 0) return AIRBNB_LISTINGS.map((l) => l.id);
  return AIRBNB_LISTINGS.map((l) => l.id).filter((id) => listingIds.includes(id));
}

export function computeSousTraitancePayout(
  state: AirbnbState,
  month: string,
  listingIds: AirbnbListingId[] = [],
): SousTraitancePayout {
  const params = cloneSousTraitance(state.sousTraitance);
  const ids = resolvedSousTraitanceListingIds(listingIds);
  const rows: SousTraitancePayoutRow[] = ids.map((id) => {
    const label = AIRBNB_LISTINGS.find((l) => l.id === id)?.label ?? id;
    const active = airbnbListingIsActiveInMonth(id, month);
    const ca = listingCaFromVentilation(state, month, id);
    let due = 0;
    if (active) {
      if (params.mode === "percent") {
        due = ca * (params.percent / 100);
      } else {
        due = parseEuroInputDisplay(params.forfaits[id] ?? "");
      }
    }
    return { listingId: id, label, active, ca, due };
  });
  return {
    rows,
    caTotal: rows.reduce((s, r) => s + r.ca, 0),
    dueTotal: rows.reduce((s, r) => s + r.due, 0),
  };
}
