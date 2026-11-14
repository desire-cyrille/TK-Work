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
  listingLocationCountFromVentilation,
  parseEuroInputDisplay,
} from "./airbnbStorage";

export type SousTraitancePayoutRow = {
  listingId: AirbnbListingId;
  label: string;
  active: boolean;
  locations: number;
  ca: number;
  due: number;
};

export type SousTraitancePayout = {
  rows: SousTraitancePayoutRow[];
  caTotal: number;
  locationTotal: number;
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
    const locations = listingLocationCountFromVentilation(state, month, id);
    let due = 0;
    if (active) {
      if (params.mode === "percent") {
        due = ca * (params.percent / 100);
      } else {
        const unit = parseEuroInputDisplay(params.forfaits[id] ?? "");
        due = unit * locations;
      }
    }
    return { listingId: id, label, active, locations, ca, due };
  });
  return {
    rows,
    caTotal: rows.reduce((s, r) => s + r.ca, 0),
    locationTotal: rows.reduce((s, r) => s + r.locations, 0),
    dueTotal: rows.reduce((s, r) => s + r.due, 0),
  };
}
