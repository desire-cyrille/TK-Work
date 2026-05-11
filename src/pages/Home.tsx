import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import { useBiens } from "../context/BiensContext";
import { useFinance } from "../context/FinanceContext";
import { loadAirbnbState } from "../lib/airbnbStorage";
import { computeRevenusParMoisDashboard } from "../lib/dashboardBenefices";
import { computeDashboardPatrimoineStats } from "../lib/dashboardBiens";
import { fusionnerMoisFinanceAvecContrat } from "../lib/moisFinance";
import styles from "./Home.module.css";

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

export function Home() {
  const { pathname } = useLocation();
  const { logements, contratsLocation, bailleurs, chainesLocation } = useBiens();
  const { moisParContrat } = useFinance();
  const dashboardStats = useMemo(
    () =>
      computeDashboardPatrimoineStats({
        logements,
        contratsLocation,
        bailleurs,
      }),
    [logements, contratsLocation, bailleurs]
  );

  const revenusParMois = useMemo(() => {
    const airbnb = loadAirbnbState();
    return computeRevenusParMoisDashboard(
      contratsLocation,
      chainesLocation,
      (c) => fusionnerMoisFinanceAvecContrat(c, moisParContrat[c.id] ?? []),
      airbnb
    );
  }, [pathname, contratsLocation, chainesLocation, moisParContrat]);

  return (
    <PageFrame title="Tableau de bord">
      <div className={styles.page}>
        <p className={styles.subtitle}>
          Vue d&apos;ensemble de votre patrimoine
        </p>

        <section className={styles.cards}>
          <article className={styles.card}>
            <span className={styles.cardLabel}>Biens en sous-location</span>
            <strong className={styles.cardValue}>
              {dashboardStats.biensSousLocation}
            </strong>
          </article>
          <article className={styles.card}>
            <span className={styles.cardLabel}>Biens « propres »</span>
            <strong className={styles.cardValue}>
              {dashboardStats.biensPropres}
            </strong>
          </article>
          <article className={styles.card}>
            <span className={styles.cardLabel}>Nombre de bailleurs</span>
            <strong className={styles.cardValue}>
              {dashboardStats.nombreBailleurs}
            </strong>
          </article>
        </section>

        <section className={styles.tableSection}>
          <h2 className={styles.sectionTitle}>Revenu par mois</h2>
          <p className={styles.tableHint}>
            Six derniers mois : sommes encaissées sur les baux sous-location des
            chaînes (versements enregistrés côté « toi → sous-loc », équivalent
            TK Pro Synergie) + total revenu Airbnb du mois (comme l’onglet
            Airbnb). Charges = frais saisis sur tous les baux.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mois</th>
                  <th className={styles.num}>Revenus</th>
                  <th className={styles.num}>Charges</th>
                </tr>
              </thead>
              <tbody>
                {revenusParMois.map((row) => (
                  <tr key={row.moisCle}>
                    <td>{row.mois}</td>
                    <td className={styles.num}>{eur(row.revenus)}</td>
                    <td className={styles.num}>{eur(row.charges)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
