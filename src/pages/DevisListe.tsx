import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import { PdfPreviewDialog, type PdfApercu } from "../components/PdfPreviewDialog";
import frameStyles from "../components/PageFrame.module.css";
import { useAuth } from "../context/AuthContext";
import { tarifsPourZone, totauxBudget } from "../lib/devisCalcul";
import { lireParametresDevisDefaut } from "../lib/devisDefaultsStorage";
import {
  listerClientsDevis,
  memoriserClientDevis,
} from "../lib/devisClientsStorage";
import {
  ajouterDevis,
  archiverDevis,
  desarchiverDevis,
  listerDevis,
  supprimerDevis,
  type Devis,
  type DevisStatut,
} from "../lib/devisStorage";
import {
  genererDevisPdfBlob,
  nomFichierPdfDevis,
} from "../lib/exportDevisPdf";
import { formatEuro } from "../lib/money";
import { withResourceLock } from "../lib/workspaceLockApi";
import styles from "./DevisListe.module.css";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const STATUT_LABEL: Record<DevisStatut, string> = {
  brouillon: "Brouillon",
  enregistre: "Enregistré",
  archive: "Archivé",
};

async function blobPdfPourDevis(d: Devis): Promise<Blob> {
  const g = lireParametresDevisDefaut();
  const tarifs = tarifsPourZone(d.zone, g);
  const totaux = totauxBudget(d.contenu, tarifs);
  return genererDevisPdfBlob(d, totaux);
}

export function DevisListe() {
  const navigate = useNavigate();
  const { profileEmail, isAuthenticated } = useAuth();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const liste = useMemo(() => listerDevis(), [version]);
  const clientsConnus = useMemo(() => listerClientsDevis(), [version]);

  const [filtre, setFiltre] = useState<"actifs" | "archives" | "tous">("actifs");
  const visible = useMemo(() => {
    if (filtre === "tous") return liste;
    if (filtre === "archives") return liste.filter((d) => d.statut === "archive");
    return liste.filter((d) => d.statut !== "archive");
  }, [liste, filtre]);

  const stats = useMemo(() => {
    const actifs = liste.filter((d) => d.statut !== "archive");
    const g = lireParametresDevisDefaut();
    let somme = 0;
    for (const d of actifs) {
      const tarifs = tarifsPourZone(d.zone, g);
      somme += totauxBudget(d.contenu, tarifs).totalHt;
    }
    return { nombre: actifs.length, sommeTotaleHt: somme };
  }, [liste, version]);

  const [modalCreer, setModalCreer] = useState(false);
  const [draftTitre, setDraftTitre] = useState("");
  const [draftClient, setDraftClient] = useState("");
  const [draftSociete, setDraftSociete] = useState("");
  const [draftEstSociete, setDraftEstSociete] = useState(false);
  const [draftZone, setDraftZone] = useState<"idf" | "hors_idf">("idf");

  const [pdfApercu, setPdfApercu] = useState<PdfApercu | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openModalCreer() {
    setDraftTitre("");
    setDraftClient("");
    setDraftSociete("");
    setDraftEstSociete(false);
    setDraftZone("idf");
    setModalCreer(true);
  }

  function onCreerDevis(e: FormEvent) {
    e.preventDefault();
    const titre = draftTitre.trim() || "Sans titre";
    memoriserClientDevis(
      draftEstSociete
        ? draftSociete.trim() || draftClient.trim()
        : draftClient.trim(),
      draftEstSociete,
    );
    const d = ajouterDevis({
      titre,
      client: draftEstSociete ? draftClient.trim() : draftClient.trim(),
      clientSociete: draftEstSociete ? draftSociete.trim() : undefined,
      clientEstSociete: draftEstSociete,
      zone: draftZone,
      montantHt: "",
      notes: "",
      statut: "brouillon",
      createdByEmail: profileEmail || undefined,
    });
    setModalCreer(false);
    refresh();
    navigate(`/devis/edition/${d.id}`);
  }

  async function ouvrirApercu(d: Devis) {
    setBusyId(d.id);
    try {
      const blob = await blobPdfPourDevis(d);
      if (pdfApercu?.blobUrl) URL.revokeObjectURL(pdfApercu.blobUrl);
      setPdfApercu({
        blobUrl: URL.createObjectURL(blob),
        fileName: nomFichierPdfDevis(d),
        title: `Aperçu — ${d.titre}`,
      });
    } catch {
      window.alert("Impossible de générer le PDF.");
    } finally {
      setBusyId(null);
    }
  }

  async function telechargerPdf(d: Devis) {
    setBusyId(d.id);
    try {
      const blob = await blobPdfPourDevis(d);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nomFichierPdfDevis(d);
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.alert("Impossible de générer le PDF.");
    } finally {
      setBusyId(null);
    }
  }

  async function partagerPdf(d: Devis) {
    setBusyId(d.id);
    try {
      const blob = await blobPdfPourDevis(d);
      const name = nomFichierPdfDevis(d);
      const file = new File([blob], name, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
      } else {
        window.alert(
          "Le partage n’est pas disponible sur cet appareil. Utilisez Télécharger.",
        );
      }
    } catch {
      /* annulé */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageFrame
        title="Gestion des devis"
        actions={
          <>
            <Link
              to="/devis/parametres"
              className={frameStyles.headerCtaSecondary}
              style={{ textDecoration: "none" }}
            >
              Paramètres
            </Link>
            <button
              type="button"
              className={frameStyles.headerCta}
              onClick={openModalCreer}
            >
              Créer un devis
            </button>
          </>
        }
      >
        <div className={styles.page}>
          <p className={styles.intro}>
            Données enregistrées dans ce navigateur et synchronisées avec le{" "}
            <strong>nuage partagé</strong> (page Fonctions). Les devis{" "}
            <strong>archivés</strong> ne comptent pas dans les totaux ci-dessous.
          </p>

          <div className={styles.statsCard}>
            <div>
              <span className={styles.statsLabel}>Devis actifs</span>
              <strong className={styles.statsValue}>{stats.nombre}</strong>
            </div>
            <div>
              <span className={styles.statsLabel}>
                Cumul total HT (actifs, calculé)
              </span>
              <strong className={styles.statsValue}>
                {formatEuro(stats.sommeTotaleHt)}
              </strong>
            </div>
          </div>

          <div className={styles.filtres}>
            {(
              [
                ["actifs", "Devis actifs"],
                ["archives", "Archives"],
                ["tous", "Tous"],
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

          {modalCreer ? (
            <div
              className={styles.modalBackdrop}
              role="presentation"
              onClick={() => setModalCreer(false)}
            >
              <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="devis-creer-titre"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="devis-creer-titre" className={styles.modalTitle}>
                  Nouveau devis
                </h2>
                <form onSubmit={onCreerDevis}>
                  <label className={styles.label}>
                    Titre du devis
                    <input
                      className={styles.input}
                      value={draftTitre}
                      onChange={(e) => setDraftTitre(e.target.value)}
                      required
                    />
                  </label>
                  <label className={styles.label}>
                    <input
                      type="checkbox"
                      checked={draftEstSociete}
                      onChange={(e) => setDraftEstSociete(e.target.checked)}
                    />{" "}
                    Société
                  </label>
                  {draftEstSociete ? (
                    <label className={styles.label}>
                      Raison sociale
                      <input
                        className={styles.input}
                        value={draftSociete}
                        onChange={(e) => setDraftSociete(e.target.value)}
                        list="devis-clients-datalist"
                      />
                    </label>
                  ) : null}
                  <label className={styles.label}>
                    {draftEstSociete ? "Contact (optionnel)" : "Client"}
                    <input
                      className={styles.input}
                      value={draftClient}
                      onChange={(e) => setDraftClient(e.target.value)}
                      list="devis-clients-datalist"
                    />
                  </label>
                  <datalist id="devis-clients-datalist">
                    {clientsConnus.map((c) => (
                      <option key={c.id} value={c.nom} />
                    ))}
                  </datalist>
                  <label className={styles.label}>
                    Zone tarifaire
                    <select
                      className={styles.input}
                      value={draftZone}
                      onChange={(e) =>
                        setDraftZone(
                          e.target.value === "hors_idf" ? "hors_idf" : "idf",
                        )
                      }
                    >
                      <option value="idf">Île-de-France</option>
                      <option value="hors_idf">Hors Île-de-France</option>
                    </select>
                  </label>
                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => setModalCreer(false)}
                    >
                      Annuler
                    </button>
                    <button type="submit" className={styles.btnPrimary}>
                      Ouvrir la rédaction
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {visible.length === 0 ? (
            <p className={styles.empty}>Aucun devis pour ce filtre.</p>
          ) : (
            <ul className={styles.list}>
              {visible.map((d) => {
                const g = lireParametresDevisDefaut();
                const tarifs = tarifsPourZone(d.zone, g);
                const tot = totauxBudget(d.contenu, tarifs);
                return (
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
                        <dd>
                          {d.clientEstSociete
                            ? d.clientSociete || d.client || "—"
                            : d.client || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Zone</dt>
                        <dd>
                          {d.zone === "idf"
                            ? "Île-de-France"
                            : "Hors Île-de-France"}
                        </dd>
                      </div>
                      <div>
                        <dt>Total HT (calculé)</dt>
                        <dd>{formatEuro(tot.totalHt)}</dd>
                      </div>
                      <div>
                        <dt>Mis à jour</dt>
                        <dd>{fmtDate(d.updatedAt)}</dd>
                      </div>
                      <div>
                        <dt>Auteur</dt>
                        <dd>{d.createdByEmail || "—"}</dd>
                      </div>
                    </dl>
                    <div className={styles.actions}>
                      <Link
                        className={styles.btnEdit}
                        to={`/devis/edition/${d.id}`}
                        style={{ textDecoration: "none", display: "inline-block" }}
                      >
                        Rédiger
                      </Link>
                      <button
                        type="button"
                        className={styles.btnEdit}
                        disabled={busyId === d.id}
                        onClick={() => void ouvrirApercu(d)}
                      >
                        Aperçu PDF
                      </button>
                      <button
                        type="button"
                        className={styles.btnEdit}
                        disabled={busyId === d.id}
                        onClick={() => void telechargerPdf(d)}
                      >
                        Télécharger
                      </button>
                      <button
                        type="button"
                        className={styles.btnEdit}
                        disabled={busyId === d.id}
                        onClick={() => void partagerPdf(d)}
                      >
                        Partager
                      </button>
                      {d.statut !== "archive" ? (
                        <button
                          type="button"
                          className={styles.btnArchive}
                          onClick={() => {
                            void (async () => {
                              if (!isAuthenticated) {
                                archiverDevis(d.id);
                                refresh();
                                return;
                              }
                              const r = await withResourceLock(
                                `devis:${d.id}`,
                                () => {
                                  archiverDevis(d.id);
                                },
                              );
                              if (!r.ok) window.alert(r.error);
                              else refresh();
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
                              if (!isAuthenticated) {
                                desarchiverDevis(d.id);
                                refresh();
                                return;
                              }
                              const r = await withResourceLock(
                                `devis:${d.id}`,
                                () => {
                                  desarchiverDevis(d.id);
                                },
                              );
                              if (!r.ok) window.alert(r.error);
                              else refresh();
                            })();
                          }}
                        >
                          Réactiver
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.btnDelete}
                        onClick={() => {
                          if (
                            !confirm(
                              `Supprimer définitivement « ${d.titre} » ?`,
                            )
                          ) {
                            return;
                          }
                          void (async () => {
                            if (!isAuthenticated) {
                              supprimerDevis(d.id);
                              refresh();
                              return;
                            }
                            const r = await withResourceLock(
                              `devis:${d.id}`,
                              () => {
                                supprimerDevis(d.id);
                              },
                            );
                            if (!r.ok) window.alert(r.error);
                            else refresh();
                          })();
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PageFrame>

      <PdfPreviewDialog
        open={Boolean(pdfApercu)}
        apercu={pdfApercu}
        onClose={() => {
          if (pdfApercu?.blobUrl) URL.revokeObjectURL(pdfApercu.blobUrl);
          setPdfApercu(null);
        }}
      />
    </>
  );
}
