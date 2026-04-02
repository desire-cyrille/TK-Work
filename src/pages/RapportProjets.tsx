import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { compterRapportsPourProjet } from "../lib/rapportChainStorage";
import {
  importerRapportProjetPackCommeNouveau,
  parseRapportProjetPackJson,
  telechargerRapportProjetPack,
} from "../lib/rapportProjetPack";
import {
  archiverProjet,
  creerProjet,
  mettreAJourProjet,
  projetsActifs,
} from "../lib/rapportProjetStorage";
import { withResourceLock } from "../lib/workspaceLockApi";
import styles from "./RapportProjets.module.css";

export function RapportProjets() {
  const [version, setVersion] = useState(0);
  const [packErr, setPackErr] = useState<string | null>(null);
  const importPackRef = useRef<HTMLInputElement>(null);
  const refresh = () => setVersion((v) => v + 1);

  const liste = useMemo(() => projetsActifs(), [version]);

  return (
    <PageFrame
      title="Projets de rapports"
      actions={
        <div className={styles.headerActions}>
          <input
            ref={importPackRef}
            type="file"
            accept="application/json,.json"
            className={styles.fileInputHidden}
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setPackErr(null);
              const reader = new FileReader();
              reader.onload = () => {
                const text = String(reader.result ?? "");
                const parsed = parseRapportProjetPackJson(text);
                if (!parsed.ok) {
                  setPackErr(parsed.error);
                  return;
                }
                const n = parsed.data.rapports.length;
                if (
                  !window.confirm(
                    `Importer le projet « ${parsed.data.projet.titre} » avec ${n} rapport(s) enregistré(s) ?\n\nUn nouveau projet sera créé (nouveaux identifiants), sans modifier vos projets existants.`,
                  )
                ) {
                  return;
                }
                const done = importerRapportProjetPackCommeNouveau(parsed.data);
                if (!done.ok) {
                  setPackErr(done.error);
                  return;
                }
                refresh();
                window.alert(
                  `Projet importé : ${done.rapportsImportes} rapport(s). Ouvrez « Éditer les rapports » sur « ${parsed.data.projet.titre} » dans la liste (nouvelle ligne).`,
                );
              };
              reader.onerror = () => setPackErr("Impossible de lire le fichier.");
              reader.readAsText(file, "UTF-8");
            }}
          />
          <button
            type="button"
            className={frameStyles.headerCtaSecondary}
            onClick={() => importPackRef.current?.click()}
          >
            Importer un projet…
          </button>
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
        </div>
      }
    >
      <div className={styles.page}>
        {packErr ? <p className={styles.packBanner}>{packErr}</p> : null}
        <p className={styles.intro}>
          Chaque <strong>projet</strong> regroupe ses propres rapports (quotidiens,
          mensuels, fin de mission). Modifiez le titre et le nombre de sites gérés ;
          ouvrez l’éditeur pour rédiger la chaîne de rapports.{" "}
          <strong>Exporter le projet</strong> télécharge un fichier JSON (paramètres
          du projet + tous ses rapports).           <strong>Importer un projet</strong> crée une <strong>copie</strong> avec
          de nouveaux identifiants. Archiver un projet le
          retire de cette liste sans effacer les données tant qu’il n’est pas supprimé
          depuis l’onglet Archive.
        </p>
        {liste.length === 0 ? (
          <p className={styles.empty}>
            Aucun projet actif. Créez un projet, ou importez-en un depuis un fichier
            JSON (<strong>Importer un projet…</strong> en haut de page).
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
                        void (async () => {
                          const t = e.target.value.trim();
                          if (!t || t === p.titre) return;
                          const r = await withResourceLock(
                            `projet:${p.id}`,
                            () => {
                              mettreAJourProjet(p.id, { titre: t });
                            },
                          );
                          if (!r.ok) {
                            window.alert(r.error);
                            e.target.value = p.titre;
                            return;
                          }
                          refresh();
                        })();
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
                        void (async () => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n) || n === p.nombreSites) return;
                          const r = await withResourceLock(
                            `projet:${p.id}`,
                            () => {
                              mettreAJourProjet(p.id, { nombreSites: n });
                            },
                          );
                          if (!r.ok) {
                            window.alert(r.error);
                            e.target.value = String(p.nombreSites);
                            return;
                          }
                          refresh();
                        })();
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
                      setPackErr(null);
                      const ok = telechargerRapportProjetPack(p.id);
                      if (!ok) {
                        setPackErr("Export impossible : projet introuvable.");
                      }
                    }}
                  >
                    Exporter le projet
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      if (
                        !confirm(
                          `Archiver le projet « ${p.titre} » ? Vous pourrez le consulter ou le supprimer dans l’onglet Archive.`,
                        )
                      ) {
                        return;
                      }
                      void (async () => {
                        const r = await withResourceLock(
                          `projet:${p.id}`,
                          () => {
                            archiverProjet(p.id);
                          },
                        );
                        if (!r.ok) {
                          window.alert(r.error);
                          return;
                        }
                        refresh();
                      })();
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
