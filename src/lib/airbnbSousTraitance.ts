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
  uniqueDue: number;
  variableDue: number;
  percentDue: number;
  fraisDue: number;
  due: number;
};

export type SousTraitancePayout = {
  rows: SousTraitancePayoutRow[];
  caTotal: number;
  locationTotal: number;
  uniqueTotal: number;
  variableTotal: number;
  percentTotal: number;
  fraisTotal: number;
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
    let uniqueDue = 0;
    let variableDue = 0;
    let percentDue = 0;
    let fraisDue = 0;
    let due = 0;
    if (active) {
      if (params.mode === "percent") {
        percentDue = ca * (params.percent / 100);
        const fraisUnit = parseEuroInputDisplay(
          params.fraisMensuels[id] ?? "",
        );
        fraisDue = locations > 0 ? fraisUnit : 0;
        due = percentDue + fraisDue;
      } else {
        const variableUnit = parseEuroInputDisplay(params.forfaits[id] ?? "");
        const uniqueUnit = parseEuroInputDisplay(
          params.fraisUniques[id] ?? "",
        );
        uniqueDue = locations > 0 ? uniqueUnit : 0;
        variableDue = variableUnit * locations;
        due = uniqueDue + variableDue;
      }
    }
    return {
      listingId: id,
      label,
      active,
      locations,
      ca,
      uniqueDue,
      variableDue,
      percentDue,
      fraisDue,
      due,
    };
  });
  return {
    rows,
    caTotal: rows.reduce((s, r) => s + r.ca, 0),
    locationTotal: rows.reduce((s, r) => s + r.locations, 0),
    uniqueTotal: rows.reduce((s, r) => s + r.uniqueDue, 0),
    variableTotal: rows.reduce((s, r) => s + r.variableDue, 0),
    percentTotal: rows.reduce((s, r) => s + r.percentDue, 0),
    fraisTotal: rows.reduce((s, r) => s + r.fraisDue, 0),
    dueTotal: rows.reduce((s, r) => s + r.due, 0),
  };
}
