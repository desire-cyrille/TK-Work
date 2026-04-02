import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import {
  chargerRapportsEnregistres,
  libelleJourFr,
  libelleMoisCleFr,
  supprimerRapportEnregistre,
  type RapportEnregistre,
} from "../lib/rapportChainStorage";
import { getProjetById } from "../lib/rapportProjetStorage";
import { withResourceLock } from "../lib/workspaceLockApi";
import styles from "./RapportActivite.module.css";

function fmtCourt(d: string): string {
  const t = d.trim();
  if (!t) return "—";
  const x = new Date(t);
  if (Number.isNaN(x.getTime())) return t;
  return x.toLocaleDateString("fr-FR");
}

function libellePeriodeStock(r: RapportEnregistre): string {
  if (r.mode === "quotidien" && r.jourDate)
    return `Quotidien — ${libelleJourFr(r.jourDate)}`;
  if (r.mode === "mensuel" && r.moisCle)
    return `Mensuel — ${libelleMoisCleFr(r.moisCle)}`;
  return `Fin de mission — ${fmtCourt(r.missionDebut ?? "")} → ${fmtCourt(r.missionFin ?? "")}`;
}

export function RapportProjetListe() {
  const { projetId: projetIdParam } = useParams<{ projetId: string }>();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const pid = projetIdParam?.trim() ?? "";

  const projet = useMemo(() => (pid ? getProjetById(pid) : undefined), [pid]);

  const rapports = useMemo(() => {
    if (!pid) return [];
    return chargerRapportsEnregistres()
      .filter((r) => r.projetId === pid)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [pid, tick]);

  function refresh() {
    setTick((t) => t + 1);
  }

  if (!pid) {
    return <Navigate to="/rapport-activite/projets" replace />;
  }

  if (!projet) {
    return <Navigate to="/rapport-activite/projets" replace />;
  }

  return (
    <PageFrame
      title={`Rapports enregistrés — ${projet.titre}`}
      actions={
        <>
          <button
            type="button"
            className={frameStyles.headerCtaSecondary}
            onClick={() => navigate("/rapport-activite/projets")}
          >
            Projets
          </button>
          <button
            type="button"
            className={frameStyles.headerCta}
            onClick={() => navigate(`/rapport-activite/edition/${projet.id}`)}
          >
            Rédaction du rapport
          </button>
        </>
      }
    >
      <div className={styles.page}>
        {projet.archived ? (
          <p className={styles.intro}>
            <strong>Projet archivé</strong> — les rapports enregistrés restent
            accessibles. Pour restaurer le projet dans la liste active, utilisez
            l’onglet <strong>Archive</strong>.
          </p>
        ) : null}
        <p className={styles.intro}>
          Liste des <strong>rapports enregistrés</strong> pour ce projet (données
          locales du navigateur). Ouvrez un rapport dans l’éditeur pour le modifier,
          puis enregistrez à nouveau pour mettre à jour la fiche.
        </p>

        {rapports.length === 0 ? (
          <p className={styles.emptyTable}>
            Aucun rapport enregistré pour l’instant. Depuis l’édition, utilisez
            « Enregistrer » pour créer un brouillon ou une version figée, puis
            revenez ici pour la retrouver.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Période</th>
                  <th>Titre</th>
                  <th>Dernière mise à jour</th>
                  <th>Sources</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rapports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.mode === "quotidien"
                        ? "Quotidien"
                        : r.mode === "mensuel"
                          ? "Mensuel"
                          : "Fin de mission"}
                    </td>
                    <td>{libellePeriodeStock(r)}</td>
                    <td>{r.titre}</td>
                    <td>
                      {new Date(r.updatedAt).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td>
                      {r.sourceIds?.length ? r.sourceIds.length : "—"}
                    </td>
                    <td className={styles.chainActions}>
                      <button
                        type="button"
                        className={styles.chainLinkBtn}
                        onClick={() =>
                          navigate(
                            `/rapport-activite/edition/${projet.id}?charger=${encodeURIComponent(r.id)}`,
                          )
                        }
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className={styles.chainDelBtn}
                        onClick={() => {
                          if (
                            !confirm(
                              `Supprimer définitivement le rapport « ${r.titre} » (${libellePeriodeStock(r)}) ?`,
                            )
                          ) {
                            return;
                          }
                          void (async () => {
                            const rLock = await withResourceLock(
                              `projet:${projet.id}`,
                              () => {
                                supprimerRapportEnregistre(r.id);
                              },
                            );
                            if (!rLock.ok) {
                              window.alert(rLock.error);
                              return;
                            }
                            refresh();
                          })();
                        }}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
