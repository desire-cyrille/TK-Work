import type { AirbnbSyntheseRow } from "../types/airbnb";

/**
 * Extrait de la feuille « SYNTHESE » du fichier
 * « ventilation airbnb .xlsx » (bénéfices / revenus mensuels consolidés).
 * Les mois saisis dans l’application peuvent remplacer ces valeurs pour la synthèse.
 */
export const SYNTHESE_SEED: AirbnbSyntheseRow[] = [
  { month: "2024-07", benefices: 1334.25, revenus: 2284.25 },
  { month: "2024-08", benefices: 1910.47, revenus: 2860.47 },
  { month: "2024-09", benefices: 478.92, revenus: 1428.92 },
  { month: "2024-10", benefices: -831.67, revenus: 1418.33 },
  { month: "2024-11", benefices: -1304.76, revenus: 945.24 },
  { month: "2024-12", benefices: 1119.61, revenus: 3369.61 },
  { month: "2025-01", benefices: -311.49, revenus: 1938.51 },
  { month: "2025-02", benefices: -463.66, revenus: 1786.34 },
  { month: "2025-03", benefices: -656.96, revenus: 1593.04 },
  { month: "2025-04", benefices: 2668.3, revenus: 4918.3 },
  { month: "2025-05", benefices: 2691.54, revenus: 4941.54 },
  { month: "2025-06", benefices: 2408.47, revenus: 4658.47 },
  { month: "2025-07", benefices: 1315.44, revenus: 3565.44 },
  { month: "2025-08", benefices: 1593.14, revenus: 3843.14 },
  { month: "2025-09", benefices: 44.44, revenus: 2294.44 },
  { month: "2025-10", benefices: 1400.86, revenus: 3650.86 },
  { month: "2025-11", benefices: -653.96, revenus: 2896.04 },
  { month: "2025-12", benefices: 642.85, revenus: 4192.85 },
  { month: "2026-01", benefices: -1118.04, revenus: 2121.96 },
];
