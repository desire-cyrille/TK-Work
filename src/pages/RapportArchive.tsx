import { useMemo, useState } from "react";
import { PageFrame } from "../components/PageFrame";
import {
  projetsArchives,
  restaurerProjet,
  supprimerProjetEntry,
} from "../lib/rapportProjetStorage";
import {
  compterRapportsPourProjet,
  supprimerRapportsPourProjet,
} from "../lib/rapportChainStorage";
import styles from "./RapportArchive.module.css";

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function RapportArchive() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const liste = useMemo(() => projetsArchives(), [version]);

  return (
    <PageFrame title="Archive — projets de rapports">
      <div className={styles.page}>
        <p className={styles.intro}>
          Projets archivés : consultez les métadonnées, restaurez un projet vers
          l’onglet <strong>Projets</strong>, ou supprimez définitivement un projet et{" "}
          <strong>tous ses rapports</strong> stockés localement.
        </p>
        {liste.length === 0 ? (
          <p className={styles.empty}>Aucun projet archivé.</p>
        ) : (
          <ul className={styles.list}>
            {liste.map((p) => {
              const n = compterRapportsPourProjet(p.id);
              return (
                <li key={p.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.titre}>{p.titre}</h2>
                    <span className={styles.badge}>Archivé</span>
                  </div>
                  <dl className={styles.dl}>
                    <div>
                      <dt>Sites</dt>
                      <dd>{p.sites.length}</dd>
                    </div>
                    <div>
                      <dt>Rapports</dt>
                      <dd>{n}</dd>
                    </div>
                    <div>
                      <dt>Archivé le</dt>
                      <dd>{fmtDate(p.archivedAt)}</dd>
                    </div>
                  </dl>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnRestore}
                      onClick={() => {
                        restaurerProjet(p.id);
                        refresh();
                      }}
                    >
                      Restaurer
                    </button>
                    <button
                      type="button"
                      className={styles.btnDelete}
                      onClick={() => {
                        if (
                          confirm(
                            `Supprimer définitivement « ${p.titre} » et ses ${n} rapport(s) ? Cette action est irréversible.`,
                          )
                        ) {
                          supprimerRapportsPourProjet(p.id);
                          supprimerProjetEntry(p.id);
                          refresh();
                        }
                      }}
                    >
                      Supprimer définitivement
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageFrame>
  );
}
