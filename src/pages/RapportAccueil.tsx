import { Link } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import { compterRapportsPourProjet } from "../lib/rapportChainStorage";
import { projetsActifs, statsModuleRapport } from "../lib/rapportProjetStorage";
import styles from "./RapportAccueil.module.css";

export function RapportAccueil() {
  const stats = statsModuleRapport(compterRapportsPourProjet);
  const actifs = projetsActifs();

  return (
    <PageFrame title="Rapport d’activité — Accueil">
      <div className={styles.page}>
        <p className={styles.intro}>
          Vue d’ensemble du module <strong>Rapport</strong> : projets ouverts,
          volume de rapports enregistrés et sites déclarés par projet (indicateurs
          locaux, sans lien avec la gestion de biens).
        </p>
        <div className={styles.stats}>
          <article className={styles.statCard}>
            <span className={styles.statValue}>{stats.projets}</span>
            <span className={styles.statLabel}>Projets actifs</span>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statValue}>{stats.rapports}</span>
            <span className={styles.statLabel}>Rapports enregistrés</span>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statValue}>{stats.sites}</span>
            <span className={styles.statLabel}>Sites gérés (total déclaré)</span>
          </article>
        </div>
        <p className={styles.hint}>
          Les chiffres portent sur les projets <strong>non archivés</strong>. Les
          sites sont la somme du champ « nombre de sites » renseigné sur chaque
          projet.
        </p>
        <aside className={styles.syncAside} aria-label="Synchronisation multi-appareils">
          <p className={styles.syncAsideText}>
            <strong>Même compte sur téléphone, tablette et ordinateur :</strong> les
            rapports et projets sont inclus dans la synchronisation. Après une
            modification, utilisez{" "}
            <Link className={styles.syncAsideLink} to="/fonctions#nuage">
              Fonctions → Nuage
            </Link>{" "}
            pour envoyer manuellement ; à la déconnexion un envoi est tenté
            automatiquement. Sur l’autre appareil, la connexion récupère le nuage
            si des données y sont présentes.
          </p>
        </aside>
        <div className={styles.actions}>
          <Link className={styles.linkCta} to="/rapport-activite/projets">
            Gérer les projets →
          </Link>
        </div>
        {actifs.length > 0 ? (
          <section className={styles.quick}>
            <h2 className={styles.quickTitle}>Accès rapide</h2>
            <ul className={styles.quickList}>
              {actifs.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link
                    className={styles.quickLink}
                    to={`/rapport-activite/edition/${p.id}`}
                  >
                    {p.titre}
                    <span className={styles.quickMeta}>
                      {compterRapportsPourProjet(p.id)} rapport(s)
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PageFrame>
  );
}
