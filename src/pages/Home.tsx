import { PageFrame } from "../components/PageFrame";
import { beneficesParMois, dashboardStats } from "../data/dashboard";
import styles from "./Home.module.css";

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

export function Home() {
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
          <h2 className={styles.sectionTitle}>Bénéfices par mois</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mois</th>
                  <th className={styles.num}>Revenus</th>
                  <th className={styles.num}>Charges</th>
                  <th className={styles.num}>Bénéfice</th>
                </tr>
              </thead>
              <tbody>
                {beneficesParMois.map((row) => (
                  <tr key={row.mois}>
                    <td>{row.mois}</td>
                    <td className={styles.num}>{eur(row.revenus)}</td>
                    <td className={styles.num}>{eur(row.charges)}</td>
                    <td className={`${styles.num} ${styles.benefice}`}>
                      {eur(row.benefice)}
                    </td>
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
