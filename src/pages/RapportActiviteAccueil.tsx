import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import {
  projetsEnCoursRapportActivite,
  statsRapportActiviteAccueil,
} from "../lib/rapportActiviteStorage";
import styles from "./RapportActiviteAccueil.module.css";

function fmtCourt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RapportActiviteAccueil() {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const stats = useMemo(() => statsRapportActiviteAccueil(), [version]);
  const projets = useMemo(() => projetsEnCoursRapportActivite(), [version]);

  return (
    <PageFrame
      title="Rapport d’activité"
      actions={
        <button
          type="button"
          className={frameStyles.headerCtaSecondary}
          onClick={() => {
            refresh();
          }}
        >
          Actualiser
        </button>
      }
    >
      <div className={styles.page}>
        <p className={styles.intro}>
          Vue d’ensemble de vos projets et de l’activité enregistrée. Les
          projets <strong>en cours</strong> apparaissent dans la liste ci-dessous.
        </p>

        <div className={styles.stats} role="group" aria-label="Indicateurs">
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.nbProjets}</span>
            <span className={styles.statLabel}>Projets</span>
            <span className={styles.statHint}>créés dans le module</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.nbRapports}</span>
            <span className={styles.statLabel}>Rapports enregistrés</span>
            <span className={styles.statHint}>tous projets confondus</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.nbSites}</span>
            <span className={styles.statLabel}>Sites gérés</span>
            <span className={styles.statHint}>total sur les projets</span>
          </div>
        </div>

        <div className={styles.ctaRow}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => navigate("/rapport-activite/projet/nouveau")}
          >
            Créer un projet
          </button>
        </div>

        <section className={styles.section} aria-labelledby="liste-projets">
          <h2 id="liste-projets" className={styles.sectionTitle}>
            Projets en cours
          </h2>
          {projets.length === 0 ? (
            <p className={styles.empty}>
              Aucun projet en cours. Utilisez « Créer un projet » pour commencer.
            </p>
          ) : (
            <ul className={styles.list}>
              {projets.map((p) => (
                <li key={p.id} className={styles.listItem}>
                  <Link
                    to={`/rapport-activite/projet/${p.id}`}
                    className={styles.listLink}
                  >
                    <span className={styles.listTitle}>{p.titre}</span>
                    <span className={styles.listMeta}>
                      {p.sites.length} site{p.sites.length > 1 ? "s" : ""} · mis à
                      jour {fmtCourt(p.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
