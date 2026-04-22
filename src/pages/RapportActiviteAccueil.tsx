import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import {
  archiverProjet,
  desarchiverProjet,
  projetsActifsRapportActivite,
  projetsArchivesRapportActivite,
  statsRapportActiviteAccueil,
  supprimerProjetDefinitif,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const onglet =
    searchParams.get("onglet") === "archives" ? "archives" : "projets";
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const stats = useMemo(() => statsRapportActiviteAccueil(), [version]);
  const projetsActifs = useMemo(() => projetsActifsRapportActivite(), [version]);
  const projetsArch = useMemo(() => projetsArchivesRapportActivite(), [version]);

  function setOnglet(next: "projets" | "archives") {
    setSearchParams(next === "archives" ? { onglet: "archives" } : {}, {
      replace: true,
    });
  }

  return (
    <PageFrame
      title="Rapport d’activité"
      actions={
        <button
          type="button"
          className={frameStyles.headerCtaSecondary}
          onClick={() => refresh()}
        >
          Actualiser
        </button>
      }
    >
      <div className={styles.page}>
        <div className={styles.tabsMain} role="tablist" aria-label="Sections">
          <button
            type="button"
            className={onglet === "projets" ? styles.tabMainActive : styles.tabMain}
            onClick={() => setOnglet("projets")}
          >
            Projets
          </button>
          <button
            type="button"
            className={
              onglet === "archives" ? styles.tabMainActive : styles.tabMain
            }
            onClick={() => setOnglet("archives")}
          >
            Archives
          </button>
        </div>

        <p className={styles.intro}>
          {onglet === "projets"
            ? "Les projets actifs sont visibles ici. Archivez un projet pour le retirer de cette liste sans le supprimer."
            : "Les projets archivés restent stockés. Vous pouvez les restaurer ou les supprimer définitivement."}
        </p>

        <div className={styles.stats} role="group" aria-label="Indicateurs">
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.nbProjets}</span>
            <span className={styles.statLabel}>Projets actifs</span>
            <span className={styles.statHint}>hors archives</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.nbRapports}</span>
            <span className={styles.statLabel}>Rapports enregistrés</span>
            <span className={styles.statHint}>tous projets confondus</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.nbSites}</span>
            <span className={styles.statLabel}>Sites gérés</span>
            <span className={styles.statHint}>sur les projets actifs</span>
          </div>
        </div>

        {onglet === "projets" ? (
          <>
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
                Projets
              </h2>
              {projetsActifs.length === 0 ? (
                <p className={styles.empty}>
                  Aucun projet actif. Créez un projet ou restaurez-en un depuis
                  l’onglet Archives.
                </p>
              ) : (
                <ul className={styles.list}>
                  {projetsActifs.map((p) => (
                    <li key={p.id} className={styles.listItem}>
                      <div className={styles.rowCard}>
                        <Link
                          to={`/rapport-activite/projet/${p.id}/redaction`}
                          className={styles.listLink}
                        >
                          <span className={styles.listTitle}>{p.titre}</span>
                          <span className={styles.listMeta}>
                            {p.sites.length}{" "}
                            {p.sites.length <= 1 ? "site" : "sites"} · mis à jour{" "}
                            {fmtCourt(p.updatedAt)}
                          </span>
                        </Link>
                        <button
                          type="button"
                          className={styles.btnArchive}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Archiver le projet « ${p.titre} » ? Il sera déplacé vers l’onglet Archives.`,
                              )
                            ) {
                              archiverProjet(p.id);
                              refresh();
                            }
                          }}
                        >
                          Archiver
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <section className={styles.section} aria-labelledby="liste-archives">
            <h2 id="liste-archives" className={styles.sectionTitle}>
              Projets archivés
            </h2>
            {projetsArch.length === 0 ? (
              <p className={styles.empty}>Aucun projet archivé.</p>
            ) : (
              <ul className={styles.list}>
                {projetsArch.map((p) => (
                  <li key={p.id} className={styles.listItem}>
                    <div className={styles.rowCard}>
                      <Link
                        to={`/rapport-activite/projet/${p.id}/redaction`}
                        className={styles.listLink}
                      >
                        <span className={styles.listTitle}>{p.titre}</span>
                        <span className={styles.listMeta}>
                          archivé · {fmtCourt(p.updatedAt)}
                        </span>
                      </Link>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => {
                            desarchiverProjet(p.id);
                            refresh();
                          }}
                        >
                          Restaurer
                        </button>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Supprimer définitivement « ${p.titre} » et tous ses rapports ? Cette action est irréversible.`,
                              )
                            ) {
                              supprimerProjetDefinitif(p.id);
                              refresh();
                            }
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </PageFrame>
  );
}
