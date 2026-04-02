import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { useAuth } from "../context/AuthContext";
import { useWorkspaceLock } from "../hooks/useWorkspaceLock";
import {
  archiverDevis,
  ajouterDevis,
  desarchiverDevis,
  listerDevis,
  mettreAJourDevis,
  supprimerDevis,
  type Devis,
  type DevisStatut,
} from "../lib/devisStorage";
import { withResourceLock } from "../lib/workspaceLockApi";
import styles from "./DevisListe.module.css";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

const STATUT_LABEL: Record<DevisStatut, string> = {
  brouillon: "Brouillon",
  enregistre: "Enregistré",
  archive: "Archivé",
};

export function DevisListe() {
  const { isAuthenticated } = useAuth();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const liste = useMemo(() => listerDevis(), [version]);

  const [filtre, setFiltre] = useState<"tous" | DevisStatut>("tous");
  const visible = useMemo(() => {
    if (filtre === "tous") return liste;
    return liste.filter((d) => d.statut === filtre);
  }, [liste, filtre]);

  const [editId, setEditId] = useState<string | null>(null);

  const [draftTitre, setDraftTitre] = useState("");
  const [draftClient, setDraftClient] = useState("");
  const [draftMontant, setDraftMontant] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftStatut, setDraftStatut] = useState<DevisStatut>("brouillon");

  const editLockKey =
    isAuthenticated && editId && editId !== "new"
      ? `devis:${editId}`
      : null;
  const devisLock = useWorkspaceLock(editLockKey);

  useEffect(() => {
    if (!editId || editId === "new" || !devisLock.ready) return;
    if (devisLock.isLockedOut && devisLock.lockedByLabel) {
      window.alert(
        `Ce devis est déjà en cours d’utilisation (${devisLock.lockedByLabel}).`,
      );
      setEditId(null);
    }
  }, [
    editId,
    devisLock.ready,
    devisLock.isLockedOut,
    devisLock.lockedByLabel,
  ]);

  function openNew() {
    setEditId("new");
    setDraftTitre("");
    setDraftClient("");
    setDraftMontant("");
    setDraftNotes("");
    setDraftStatut("brouillon");
  }

  function openEdit(d: Devis) {
    setEditId(d.id);
    setDraftTitre(d.titre);
    setDraftClient(d.client);
    setDraftMontant(d.montantHt);
    setDraftNotes(d.notes);
    setDraftStatut(d.statut === "archive" ? "archive" : d.statut);
  }

  function closeForm() {
    setEditId(null);
  }

  function onSubmitForm(e: FormEvent) {
    e.preventDefault();
    const titre = draftTitre.trim() || "Sans titre";
    if (editId === "new") {
      ajouterDevis({
        titre,
        client: draftClient.trim(),
        montantHt: draftMontant.trim(),
        notes: draftNotes.trim(),
        statut: draftStatut,
      });
    } else if (editId) {
      mettreAJourDevis(editId, {
        titre,
        client: draftClient.trim(),
        montantHt: draftMontant.trim(),
        notes: draftNotes.trim(),
        statut: draftStatut,
        archivedAt:
          draftStatut === "archive" ? new Date().toISOString() : undefined,
      });
    }
    closeForm();
    refresh();
  }

  return (
    <PageFrame
      title="Gestion des devis"
      actions={
        <>
          <button
            type="button"
            className={frameStyles.headerCta}
            onClick={openNew}
          >
            Nouveau devis
          </button>
        </>
      }
    >
      <div className={styles.page}>
        <p className={styles.intro}>
          Devis locaux (navigateur), synchronisés avec le même{" "}
          <strong>nuage partagé</strong> que les biens et rapports (Réglages → Nuage).
          Tous les comptes voient les mêmes devis après synchronisation.
        </p>

        <div className={styles.filtres}>
          {(
            [
              ["tous", "Tous"],
              ["enregistre", "Enregistrés"],
              ["brouillon", "Brouillons"],
              ["archive", "Archivés"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={
                filtre === k ? styles.filtreBtnActive : styles.filtreBtn
              }
              onClick={() => setFiltre(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {editId &&
        (editId === "new" || (devisLock.ready && devisLock.canEdit)) ? (
          <form className={styles.formCard} onSubmit={(e) => void onSubmitForm(e)}>
            <h2 className={styles.formTitle}>
              {editId === "new" ? "Nouveau devis" : "Modifier le devis"}
            </h2>
            <label className={styles.label}>
              Titre
              <input
                className={styles.input}
                value={draftTitre}
                onChange={(e) => setDraftTitre(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Client
              <input
                className={styles.input}
                value={draftClient}
                onChange={(e) => setDraftClient(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Montant HT (texte libre)
              <input
                className={styles.input}
                value={draftMontant}
                onChange={(e) => setDraftMontant(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Notes
              <textarea
                className={styles.textarea}
                rows={4}
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
              />
            </label>
            {editId !== "new" ? (
              <label className={styles.label}>
                Statut
                <select
                  className={styles.input}
                  value={draftStatut}
                  onChange={(e) =>
                    setDraftStatut(e.target.value as DevisStatut)
                  }
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="enregistre">Enregistré</option>
                  <option value="archive">Archivé</option>
                </select>
              </label>
            ) : (
              <label className={styles.label}>
                Statut initial
                <select
                  className={styles.input}
                  value={draftStatut}
                  onChange={(e) =>
                    setDraftStatut(e.target.value as DevisStatut)
                  }
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="enregistre">Enregistré</option>
                </select>
              </label>
            )}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={closeForm}
              >
                Annuler
              </button>
              <button type="submit" className={styles.btnPrimary}>
                Enregistrer
              </button>
            </div>
          </form>
        ) : editId && editId !== "new" && !devisLock.ready ? (
          <p className={styles.lockWait} role="status">
            Vérification du verrou…
          </p>
        ) : null}

        {visible.length === 0 ? (
          <p className={styles.empty}>Aucun devis pour ce filtre.</p>
        ) : (
          <ul className={styles.list}>
            {visible.map((d) => (
              <li key={d.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>{d.titre}</h2>
                  <span
                    className={
                      d.statut === "archive"
                        ? styles.badgeArchive
                        : styles.badge
                    }
                  >
                    {STATUT_LABEL[d.statut]}
                  </span>
                </div>
                <dl className={styles.dl}>
                  <div>
                    <dt>Client</dt>
                    <dd>{d.client || "—"}</dd>
                  </div>
                  <div>
                    <dt>Montant HT</dt>
                    <dd>{d.montantHt || "—"}</dd>
                  </div>
                  <div>
                    <dt>Mis à jour</dt>
                    <dd>{fmtDate(d.updatedAt)}</dd>
                  </div>
                </dl>
                {d.notes ? <p className={styles.notes}>{d.notes}</p> : null}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btnEdit}
                    onClick={() => openEdit(d)}
                  >
                    Modifier
                  </button>
                  {d.statut !== "archive" ? (
                  <button
                    type="button"
                    className={styles.btnArchive}
                    onClick={() => {
                      void (async () => {
                        const r = await withResourceLock(
                          `devis:${d.id}`,
                          () => {
                            archiverDevis(d.id);
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
                  ) : (
                    <button
                      type="button"
                      className={styles.btnRestore}
                      onClick={() => {
                        void (async () => {
                          const r = await withResourceLock(
                            `devis:${d.id}`,
                            () => {
                              desarchiverDevis(d.id);
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
                      Désarchiver
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.btnDelete}
                    onClick={() => {
                      if (
                        !confirm(
                          `Supprimer définitivement le devis « ${d.titre} » ?`,
                        )
                      ) {
                        return;
                      }
                      void (async () => {
                        const r = await withResourceLock(
                          `devis:${d.id}`,
                          () => {
                            supprimerDevis(d.id);
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
                    Supprimer
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
