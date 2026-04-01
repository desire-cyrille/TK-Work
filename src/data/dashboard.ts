/** Données d'exemple — à remplacer par API ou base locale plus tard */
export const dashboardStats = {
  biensSousLocation: 8,
  biensPropres: 4,
  nombreBailleurs: 12,
};

export type LigneBenefice = {
  mois: string;
  revenus: number;
  charges: number;
  benefice: number;
};

export const beneficesParMois: LigneBenefice[] = [
  { mois: "Janvier 2026", revenus: 14200, charges: 5200, benefice: 9000 },
  { mois: "Décembre 2025", revenus: 13800, charges: 5100, benefice: 8700 },
  { mois: "Novembre 2025", revenus: 13550, charges: 4980, benefice: 8570 },
  { mois: "Octobre 2025", revenus: 13100, charges: 4800, benefice: 8300 },
];
