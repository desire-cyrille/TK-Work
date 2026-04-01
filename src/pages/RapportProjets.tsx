import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import {
  archiverProjet,
  creerProjet,
  mettreAJourProjet,
  projetsActifs,
} from "../lib/rapportProjetStorage";
import { compterRapportsPourProjet } from "../lib/rapportChainStorage";
import styles from "./RapportProjets.module.css";

export function RapportProjets() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const liste = useMemo(() => projetsActifs(), [version]);

  return (
    <PageFrame
      title="Projets de rapports"
      actions={
        <button
          type="button"
          className={frameStyles.headerCta}
          onClick={() => {
            creerProjet();
            refresh();
          }}
        >
          Nouveau projet
        </button>
      }
    >
      <div className={styles.page}>
        <p className={styles.intro}>
          Chaque <strong>projet</strong> regroupe ses propres rapports (quotidiens,
          mensuels, fin de mission). Modifiez le titre et le nombre de sites gérés ;
          ouvrez l’éditeur pour rédiger la chaîne de rapports. Archiver un projet le
          retire de cette liste sans effacer les données tant qu’il n’est pas supprimé
          depuis l’onglet Archive.
        </p>
        {liste.length === 0 ? (
          <p className={styles.empty}>
            Aucun projet actif. Créez un projet pour commencer à enregistrer des
            rapports.
          </p>
        ) : (
          <ul className={styles.list}>
            {liste.map((p) => (
              <li key={p.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Titre du projet</span>
                    <input
                      className={styles.input}
                      defaultValue={p.titre}
                      key={`${p.id}-${p.updatedAt}`}
                      onBlur={(e) => {
                        const t = e.target.value.trim();
                        if (t && t !== p.titre) {
                          mettreAJourProjet(p.id, { titre: t });
                          refresh();
                        }
                      }}
                    />
                  </label>
                  <label className={styles.fieldSites}>
                    <span className={styles.fieldLabel}>Sites gérés</span>
                    <input
                      className={styles.inputNum}
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={p.nombreSites}
                      key={`sites-${p.id}-${p.updatedAt}`}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n !== p.nombreSites) {
                          mettreAJourProjet(p.id, { nombreSites: n });
                          refresh();
                        }
                      }}
                    />
                  </label>
                </div>
                <p className={styles.meta}>
                  {compterRapportsPourProjet(p.id)} rapport(s) enregistré(s) dans ce
                  projet.
                </p>
                <div className={styles.cardActions}>
                  <Link
                    className={styles.btnPrimary}
                    to={`/rapport-activite/edition/${p.id}`}
                  >
                    Éditer les rapports
                  </Link>
                  <Link
                    className={styles.btnSecondary}
                    to={`/rapport-activite/projet/${p.id}/rapports`}
                  >
                    Liste des rapports
                  </Link>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      if (
                        confirm(
                          `Archiver le projet « ${p.titre} » ? Vous pourrez le consulter ou le supprimer dans l’onglet Archive.`,
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
      </div>
    </PageFrame>
  );
}
