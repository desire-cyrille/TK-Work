import { useMemo } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import {
  compterRapportsPourProjet,
  getProjetRapportActivite,
  sauvegarderProjetRapportActivite,
} from "../lib/rapportActiviteStorage";
import styles from "./RapportActiviteAccueil.module.css";

export function RapportActiviteProjetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projet = useMemo(
    () => (id ? getProjetRapportActivite(id) : undefined),
    [id],
  );
  const nbRapports = useMemo(
    () => (projet ? compterRapportsPourProjet(projet.id) : 0),
    [projet],
  );

  if (!id?.trim()) {
    return <Navigate to="/rapport-activite/accueil" replace />;
  }
  if (!projet) {
    return <Navigate to="/rapport-activite/accueil" replace />;
  }

  function marquerTermine() {
    const p = projet;
    if (!p) return;
    if (
      !window.confirm(
        "Marquer ce projet comme terminé ? Il disparaîtra de la liste « en cours » sur l’accueil.",
      )
    ) {
      return;
    }
    sauvegarderProjetRapportActivite({ ...p, statut: "termine" });
    navigate("/rapport-activite/accueil");
  }

  return (
    <PageFrame
      title={projet.titre}
      actions={
        <>
          <Link
            to="/rapport-activite/accueil"
            className={frameStyles.headerCtaSecondary}
            style={{ textDecoration: "none" }}
          >
            Accueil rapport
          </Link>
          {projet.statut === "en_cours" ? (
            <button
              type="button"
              className={frameStyles.headerCtaSecondary}
              onClick={() => {
                marquerTermine();
              }}
            >
              Marquer terminé
            </button>
          ) : null}
        </>
      }
    >
      <div className={styles.page}>
        <p className={styles.intro}>
          Statut :{" "}
          <strong>
            {projet.statut === "en_cours" ? "En cours" : "Terminé"}
          </strong>
          {" · "}
          {projet.sites.length}{" "}
          {projet.sites.length <= 1 ? "site" : "sites"} ·{" "}
          {nbRapports}{" "}
          {nbRapports <= 1 ? "rapport enregistré" : "rapports enregistrés"}
        </p>

        <section className={styles.section} aria-labelledby="sites-titre">
          <h2 id="sites-titre" className={styles.sectionTitle}>
            Sites
          </h2>
          {projet.sites.length === 0 ? (
            <p className={styles.empty}>Aucun site.</p>
          ) : (
            <ul className={styles.list}>
              {projet.sites.map((s) => (
                <li key={s.id} className={styles.listItem}>
                  <div className={styles.listLink} style={{ cursor: "default" }}>
                    <span className={styles.listTitle}>{s.nom}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
