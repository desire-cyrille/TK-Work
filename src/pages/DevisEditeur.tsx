import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import { PdfPreviewDialog, type PdfApercu } from "../components/PdfPreviewDialog";
import frameStyles from "../components/PageFrame.module.css";
import { useAuth } from "../context/AuthContext";
import { useWorkspaceLock } from "../hooks/useWorkspaceLock";
import {
  montantLigneForfait,
  tarifsPourZone,
  totauxBudget,
} from "../lib/devisCalcul";
import { lireParametresDevisDefaut } from "../lib/devisDefaultsStorage";
import { memoriserClientDevis } from "../lib/devisClientsStorage";
import {
  getDevis,
  mettreAJourDevis,
  type Devis,
} from "../lib/devisStorage";
import type {
  BlocActions,
  DevisContenu,
  DevisDomainesActifs,
  DevisTheme,
  LigneActionTemps,
  LigneDeplacement,
  LigneForfait,
  LigneRestauration,
  ModePermanence,
  UniteTemps,
} from "../lib/devisTypes";
import { newId } from "../lib/devisTypes";
import {
  genererDevisPdfBlob,
  nomFichierPdfDevis,
} from "../lib/exportDevisPdf";
import { formatEuro } from "../lib/money";
import { withResourceLock } from "../lib/workspaceLockApi";
import styles from "./DevisEditeur.module.css";

const PDF_MAX_BYTES = 2 * 1024 * 1024;

const UNITES: { v: UniteTemps; l: string }[] = [
  { v: "heure", l: "Heure" },
  { v: "jour", l: "Jour" },
  { v: "semaine", l: "Semaine" },
  { v: "mois", l: "Mois" },
];

const MODES_PERM: { v: ModePermanence; l: string }[] = [
  { v: "forfait_jours", l: "Forfait (jours × tarif jour)" },
  { v: "par_semaine", l: "Par semaine (semaines × jours/sem. × tarif jour)" },
  { v: "horaire", l: "Horaire (semaines × jours × h/j × tarif horaire)" },
];

type OngletDevis =
  | "infos"
  | "garde"
  | "preparation"
  | "mise"
  | "forfait"
  | "permanence"
  | "deplacement"
  | "restauration"
  | "annexe"
  | "notes"
  | "synthese";

const ONGLETS_DETAILLE: { id: OngletDevis; label: string }[] = [
  { id: "infos", label: "Projet & client" },
  { id: "garde", label: "Garde & textes" },
  { id: "preparation", label: "Préparation" },
  { id: "mise", label: "Mise en place" },
  { id: "permanence", label: "Permanence" },
  { id: "deplacement", label: "Déplacement" },
  { id: "restauration", label: "Restauration" },
  { id: "annexe", label: "Annexe PDF" },
  { id: "notes", label: "Notes" },
  { id: "synthese", label: "Synthèse budget" },
];

const ONGLETS_FORFAIT: { id: OngletDevis; label: string }[] = [
  { id: "infos", label: "Projet & client" },
  { id: "garde", label: "Garde & textes" },
  { id: "forfait", label: "Forfait" },
  { id: "permanence", label: "Permanence" },
  { id: "deplacement", label: "Déplacement" },
  { id: "restauration", label: "Restauration" },
  { id: "annexe", label: "Annexe PDF" },
  { id: "notes", label: "Notes" },
  { id: "synthese", label: "Synthèse budget" },
];

function libelleCleDomaineActif(k: keyof DevisDomainesActifs): string {
  switch (k) {
    case "deplacement":
      return "Déplacement";
    case "restauration":
      return "Restauration";
    case "preparationMiseEnPlace":
      return "Préparation mise en place";
    case "miseEnPlaceTerrain":
      return "Mise en place terrain";
    case "forfait":
      return "Forfait";
    case "permanence":
      return "Permanence";
    default:
      return k;
  }
}

const CLES_SYNTHESE_DETAILLE: (keyof DevisDomainesActifs)[] = [
  "deplacement",
  "restauration",
  "preparationMiseEnPlace",
  "miseEnPlaceTerrain",
  "permanence",
];

const CLES_SYNTHESE_FORFAIT: (keyof DevisDomainesActifs)[] = [
  "deplacement",
  "restauration",
  "forfait",
  "permanence",
];

export function DevisEditeur() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profileEmail } = useAuth();
  const [devis, setDevis] = useState<Devis | null>(null);
  const [pdfApercu, setPdfApercu] = useState<PdfApercu | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<OngletDevis>("infos");

  const lock = useWorkspaceLock(
    id && id.length > 0 ? `devis:${id}` : null,
  );

  useEffect(() => {
    if (!id) {
      navigate("/devis", { replace: true });
      return;
    }
    const d = getDevis(id);
    if (!d) {
      navigate("/devis", { replace: true });
      return;
    }
    setDevis(d);
  }, [id, navigate]);

  useEffect(() => {
    if (!id || !lock.ready || lock.canEdit) return;
    if (lock.isLockedOut && lock.lockedByLabel) {
      window.alert(
        `Ce devis est utilisé ailleurs (${lock.lockedByLabel}).`,
      );
      navigate("/devis", { replace: true });
    }
  }, [id, lock.ready, lock.canEdit, lock.isLockedOut, lock.lockedByLabel, navigate]);

  useEffect(() => {
    if (!devis) return;
    const allowed =
      devis.modeleDevis === "forfaitaire" ? ONGLETS_FORFAIT : ONGLETS_DETAILLE;
    if (!allowed.some((o) => o.id === onglet)) {
      setOnglet("infos");
    }
  }, [devis?.id, devis?.modeleDevis, onglet]);

  const globaux = lireParametresDevisDefaut();
  const tarifs = useMemo(
    () => (devis ? tarifsPourZone(devis.zone, globaux) : globaux.idf),
    [devis, globaux],
  );

  const totaux = useMemo(
    () => (devis ? totauxBudget(devis.contenu, tarifs) : null),
    [devis, tarifs],
  );

  function patchDevis(p: Partial<Devis>) {
    if (!devis) return;
    setDevis({ ...devis, ...p });
  }

  function patchContenu(c: DevisContenu) {
    if (!devis) return;
    setDevis({ ...devis, contenu: c });
  }

  function patchTheme(t: DevisTheme) {
    if (!devis) return;
    setDevis({ ...devis, theme: t });
  }

  function enregistrer(e?: FormEvent) {
    e?.preventDefault();
    if (!devis || !totaux) return;
    memoriserClientDevis(
      devis.clientEstSociete
        ? devis.clientSociete || devis.client
        : devis.client,
      Boolean(devis.clientEstSociete),
    );
    void (async () => {
      const r = await withResourceLock(`devis:${devis.id}`, () => {
        mettreAJourDevis(devis.id, {
          ...devis,
          montantHt: formatEuro(totaux.totalHt),
          createdByEmail: devis.createdByEmail || profileEmail || undefined,
        });
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setErr(null);
      setDevis(getDevis(devis.id) ?? devis);
    })();
  }

  async function ouvrirPdf() {
    if (!devis || !totaux) return;
    setErr(null);
    try {
      const blob = await genererDevisPdfBlob(devis, totaux, tarifs);
      const prev = pdfApercu?.blobUrl;
      if (prev) URL.revokeObjectURL(prev);
      const blobUrl = URL.createObjectURL(blob);
      setPdfApercu({
        blobUrl,
        fileName: nomFichierPdfDevis(devis),
        title: "Aperçu du devis PDF",
      });
    } catch {
      setErr("Impossible de générer le PDF.");
    }
  }

  async function partagerPdf() {
    if (!devis || !totaux) return;
    try {
      const blob = await genererDevisPdfBlob(devis, totaux, tarifs);
      const name = nomFichierPdfDevis(devis);
      const file = new File([blob], name, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
      } else {
        setErr(
          "Le partage système n’est pas disponible ici. Utilisez « Aperçu PDF » puis Télécharger.",
        );
      }
    } catch {
      setErr("Partage annulé ou indisponible.");
    }
  }

  function onPdfComptaChange(f: File | null) {
    if (!devis) return;
    if (!f) {
      patchDevis({
        pdfComptabiliteBase64: undefined,
        pdfComptabiliteNom: undefined,
      });
      return;
    }
    if (f.type !== "application/pdf") {
      setErr("Le fichier doit être un PDF.");
      return;
    }
    if (f.size > PDF_MAX_BYTES) {
      setErr(
        `PDF trop volumineux (max. ${Math.round(PDF_MAX_BYTES / (1024 * 1024))} Mo pour le stockage local / nuage).`,
      );
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const res = r.result;
      if (typeof res === "string") {
        patchDevis({ pdfComptabiliteBase64: res, pdfComptabiliteNom: f.name });
        setErr(null);
      }
    };
    r.readAsDataURL(f);
  }

  if (!devis || !totaux) {
    return (
      <PageFrame title="Devis" actions={null}>
        <p className={styles.lockWait}>Chargement…</p>
      </PageFrame>
    );
  }

  if (!lock.ready) {
    return (
      <PageFrame title="Devis" actions={null}>
        <p className={styles.lockWait}>Vérification du verrou…</p>
      </PageFrame>
    );
  }

  if (!lock.canEdit) {
    return (
      <PageFrame title="Devis" actions={null}>
        <p className={styles.lockWait}>Accès en lecture seule ou verrouillé.</p>
      </PageFrame>
    );
  }

  const c = devis.contenu;
  const t = devis.theme;

  function setActifs(next: DevisDomainesActifs) {
    patchContenu({ ...c, domainesActifs: next });
  }

  return (
    <>
      <PageFrame
        title={
          (devis.titre || "Devis") +
          (devis.modeleDevis === "forfaitaire" ? " — Forfaitaire" : "")
        }
        actions={
          <>
            <Link
              to="/devis"
              className={frameStyles.headerCtaSecondary}
              style={{ textDecoration: "none" }}
            >
              Liste des devis
            </Link>
            <Link
              to="/devis/parametres"
              className={frameStyles.headerCtaSecondary}
              style={{ textDecoration: "none" }}
            >
              Paramètres globaux
            </Link>
          </>
        }
      >
        <form className={styles.editorWrap} onSubmit={enregistrer}>
          <div className={styles.topActions}>
            <button type="submit" className={styles.btnPrimary}>
              Enregistrer
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void ouvrirPdf()}
            >
              Aperçu PDF
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void partagerPdf()}
            >
              Partager (PDF)
            </button>
          </div>
          {err ? <p className={styles.errMsg}>{err}</p> : null}

          <div className={styles.tabs} role="tablist">
            {(devis.modeleDevis === "forfaitaire"
              ? ONGLETS_FORFAIT
              : ONGLETS_DETAILLE
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={onglet === t.id}
                className={
                  onglet === t.id ? `${styles.tab} ${styles.tabActive}` : styles.tab
                }
                onClick={() => setOnglet(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {onglet === "infos" ? (
          <section className={styles.section}>
            <h2>Projet & client</h2>
            <p className={styles.hint}>
              Modèle :{" "}
              <strong>
                {devis.modeleDevis === "forfaitaire"
                  ? "Forfaitaire"
                  : "Détaillé"}
              </strong>
              {devis.modeleDevis === "forfaitaire"
                ? " — le domaine « Forfait » remplace les onglets Préparation et Mise en place (montants en €)."
                : " — préparation et mise en place sont saisies en quantités × unités de temps."}
            </p>
            <div className={styles.grid2}>
              <label className={styles.label}>
                Titre du devis
                <input
                  className={styles.input}
                  value={devis.titre}
                  onChange={(e) => patchDevis({ titre: e.target.value })}
                />
              </label>
              <label className={styles.label}>
                Zone
                <select
                  className={styles.select}
                  value={devis.zone}
                  onChange={(e) =>
                    patchDevis({
                      zone: e.target.value === "hors_idf" ? "hors_idf" : "idf",
                    })
                  }
                >
                  <option value="idf">Île-de-France</option>
                  <option value="hors_idf">Hors Île-de-France</option>
                </select>
              </label>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  checked={Boolean(devis.clientEstSociete)}
                  onChange={(e) =>
                    patchDevis({ clientEstSociete: e.target.checked })
                  }
                />{" "}
                Client société
              </label>
              {devis.clientEstSociete ? (
                <label className={styles.label}>
                  Raison sociale
                  <input
                    className={styles.input}
                    value={devis.clientSociete ?? ""}
                    onChange={(e) =>
                      patchDevis({ clientSociete: e.target.value })
                    }
                  />
                </label>
              ) : null}
              <label className={styles.label}>
                {devis.clientEstSociete ? "Contact (optionnel)" : "Client"}
                <input
                  className={styles.input}
                  value={devis.client}
                  onChange={(e) => patchDevis({ client: e.target.value })}
                />
              </label>
              <label className={styles.label} style={{ gridColumn: "1 / -1" }}>
                Adresse (ligne affichée sur la page de garde du PDF)
                <input
                  className={styles.input}
                  value={devis.clientAdresse ?? ""}
                  onChange={(e) =>
                    patchDevis({ clientAdresse: e.target.value })
                  }
                  placeholder="Ex. 12 rue …, 75000 Paris"
                />
              </label>
              {devis.clientEstSociete ? (
                <>
                  <label className={styles.label}>
                    SIREN
                    <input
                      className={styles.input}
                      value={devis.clientSiren ?? ""}
                      onChange={(e) =>
                        patchDevis({ clientSiren: e.target.value })
                      }
                      placeholder="9 chiffres"
                    />
                  </label>
                  <label className={styles.label}>
                    N° TVA intracommunautaire
                    <input
                      className={styles.input}
                      value={devis.clientTva ?? ""}
                      onChange={(e) =>
                        patchDevis({ clientTva: e.target.value })
                      }
                      placeholder="Ex. FR12 123456789"
                    />
                  </label>
                </>
              ) : null}
            </div>
          </section>
          ) : null}

          {onglet === "garde" ? (
          <Fragment>
          <section className={styles.section}>
            <h2>Page de garde</h2>
            <div className={styles.grid2}>
              <label className={styles.label}>
                Titre affiché
                <input
                  className={styles.input}
                  value={c.titrePageGarde}
                  onChange={(e) =>
                    patchContenu({ ...c, titrePageGarde: e.target.value })
                  }
                />
              </label>
              <label className={styles.label}>
                Sous-titre
                <input
                  className={styles.input}
                  value={c.sousTitrePageGarde}
                  onChange={(e) =>
                    patchContenu({ ...c, sousTitrePageGarde: e.target.value })
                  }
                />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <h2>Couleurs (ce devis)</h2>
            <p className={styles.hint}>
              RVB 0–255. La page de garde conserve une mise en page dédiée ; le
              reste du PDF est centré avec ces couleurs d’accent.
            </p>
            <div className={styles.rgbRow}>
              {(
                [
                  ["gardeFond", "Fond garde"],
                  ["gardeTexte", "Texte garde"],
                  ["accent", "Accent"],
                ] as const
              ).map(([key, lab]) => (
                <div key={key} className={styles.rgbRow}>
                  <span className={styles.legend}>{lab}</span>
                  {[0, 1, 2].map((i) => (
                    <label key={i}>
                      {["R", "V", "B"][i]}
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={t[key][i]}
                        onChange={(e) => {
                          const n = Math.min(
                            255,
                            Math.max(0, Number(e.target.value) || 0),
                          );
                          const next: [number, number, number] = [...t[key]] as [
                            number,
                            number,
                            number,
                          ];
                          next[i] = n;
                          patchTheme({ ...t, [key]: next });
                        }}
                      />
                    </label>
                  ))}
                  <span
                    className={styles.previewSwatch}
                    style={{
                      background: `rgb(${t[key].join(",")})`,
                    }}
                    title="Aperçu"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2>Textes des pages</h2>
            <label className={styles.label}>
              Description de la prestation (centrée dans le PDF)
              <textarea
                className={styles.textarea}
                rows={5}
                value={c.descriptionPrestation}
                onChange={(e) =>
                  patchContenu({ ...c, descriptionPrestation: e.target.value })
                }
              />
            </label>
            <label className={styles.label}>
              Conclusion (centrée dans le PDF)
              <textarea
                className={styles.textarea}
                rows={3}
                value={c.texteConclusion}
                onChange={(e) =>
                  patchContenu({ ...c, texteConclusion: e.target.value })
                }
              />
            </label>
          </section>
          </Fragment>
          ) : null}

          {onglet === "deplacement" ? (
          <section className={styles.section}>
            <h2>Déplacement</h2>
            <p className={styles.hint}>
              Montant = personnes × km × tarif km (zone) × coefficient durée.
              Tarif km actuel : {tarifs.tarifKm.toFixed(2)} €/km.
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Libellé</th>
                    <th>Personnes</th>
                    <th>Distance km</th>
                    <th>Coeff. durée</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {c.deplacement.lignes.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          value={row.libelle}
                          onChange={(e) => {
                            const lignes = c.deplacement.lignes.map((x) =>
                              x.id === row.id
                                ? { ...x, libelle: e.target.value }
                                : x,
                            );
                            patchContenu({
                              ...c,
                              deplacement: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.tableMini}
                          value={row.nbPersonnes}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.deplacement.lignes.map((x) =>
                              x.id === row.id ? { ...x, nbPersonnes: n } : x,
                            );
                            patchContenu({
                              ...c,
                              deplacement: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.tableMini}
                          value={row.distanceKm}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.deplacement.lignes.map((x) =>
                              x.id === row.id ? { ...x, distanceKm: n } : x,
                            );
                            patchContenu({
                              ...c,
                              deplacement: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.tableMini}
                          value={row.coefficientDuree}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.deplacement.lignes.map((x) =>
                              x.id === row.id
                                ? { ...x, coefficientDuree: n }
                                : x,
                            );
                            patchContenu({
                              ...c,
                              deplacement: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={() =>
                            patchContenu({
                              ...c,
                              deplacement: {
                                lignes: c.deplacement.lignes.filter(
                                  (x) => x.id !== row.id,
                                ),
                              },
                            })
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                const ligne: LigneDeplacement = {
                  id: newId(),
                  libelle: "",
                  nbPersonnes: 1,
                  distanceKm: 0,
                  coefficientDuree: 1,
                };
                patchContenu({
                  ...c,
                  deplacement: {
                    lignes: [...c.deplacement.lignes, ligne],
                  },
                });
              }}
            >
              + Ligne
            </button>
          </section>
          ) : null}

          {onglet === "restauration" ? (
          <section className={styles.section}>
            <h2>Restauration</h2>
            <p className={styles.hint}>
              Montant repas = personnes × jours × repas/j × prix repas (0 ={" "}
              {tarifs.prixRepasDefaut.toFixed(2)} €). Petit-déjeuner = personnes ×
              jours × petit-déj/j × prix (0 ={" "}
              {tarifs.prixPetitDejeunerDefaut.toFixed(2)} €).
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Libellé</th>
                    <th>Personnes</th>
                    <th>Jours présence</th>
                    <th>Repas/j</th>
                    <th>Prix repas</th>
                    <th>Petit-déj/j</th>
                    <th>Prix petit-déj</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {c.restauration.lignes.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          value={row.libelle}
                          onChange={(e) => {
                            const lignes = c.restauration.lignes.map((x) =>
                              x.id === row.id
                                ? { ...x, libelle: e.target.value }
                                : x,
                            );
                            patchContenu({
                              ...c,
                              restauration: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.tableMini}
                          value={row.nbPersonnes}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.restauration.lignes.map((x) =>
                              x.id === row.id ? { ...x, nbPersonnes: n } : x,
                            );
                            patchContenu({
                              ...c,
                              restauration: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.tableMini}
                          value={row.joursPresence}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.restauration.lignes.map((x) =>
                              x.id === row.id
                                ? { ...x, joursPresence: n }
                                : x,
                            );
                            patchContenu({
                              ...c,
                              restauration: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.tableMini}
                          value={row.repasParJour}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.restauration.lignes.map((x) =>
                              x.id === row.id ? { ...x, repasParJour: n } : x,
                            );
                            patchContenu({
                              ...c,
                              restauration: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.tableMini}
                          value={row.prixRepas}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.restauration.lignes.map((x) =>
                              x.id === row.id ? { ...x, prixRepas: n } : x,
                            );
                            patchContenu({
                              ...c,
                              restauration: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.tableMini}
                          value={row.petitDejeunerParJour}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.restauration.lignes.map((x) =>
                              x.id === row.id
                                ? { ...x, petitDejeunerParJour: n }
                                : x,
                            );
                            patchContenu({
                              ...c,
                              restauration: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.tableMini}
                          value={row.prixPetitDejeuner}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.restauration.lignes.map((x) =>
                              x.id === row.id
                                ? { ...x, prixPetitDejeuner: n }
                                : x,
                            );
                            patchContenu({
                              ...c,
                              restauration: { lignes },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={() =>
                            patchContenu({
                              ...c,
                              restauration: {
                                lignes: c.restauration.lignes.filter(
                                  (x) => x.id !== row.id,
                                ),
                              },
                            })
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                const ligne: LigneRestauration = {
                  id: newId(),
                  libelle: "",
                  nbPersonnes: 1,
                  joursPresence: 1,
                  repasParJour: 1,
                  prixRepas: 0,
                  petitDejeunerParJour: 0,
                  prixPetitDejeuner: 0,
                };
                patchContenu({
                  ...c,
                  restauration: {
                    lignes: [...c.restauration.lignes, ligne],
                  },
                });
              }}
            >
              + Ligne
            </button>
          </section>
          ) : null}

          {onglet === "forfait" && devis.modeleDevis === "forfaitaire" ? (
          <section className={styles.section}>
            <h2>Forfait</h2>
            <p className={styles.hint}>
              Saisissez chaque poste : type (libellé), quantité, tarif unitaire HT.
              Le montant HT de la ligne est le produit quantité × tarif unitaire.
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Quantité</th>
                    <th>Tarif unitaire HT</th>
                    <th>Montant HT</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {c.forfait.lignes.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          value={row.libelle}
                          onChange={(e) => {
                            const lignes = c.forfait.lignes.map((x) =>
                              x.id === row.id
                                ? { ...x, libelle: e.target.value }
                                : x,
                            );
                            patchContenu({ ...c, forfait: { lignes } });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.tableMini}
                          value={row.quantite}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.forfait.lignes.map((x) =>
                              x.id === row.id ? { ...x, quantite: n } : x,
                            );
                            patchContenu({ ...c, forfait: { lignes } });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.tableMini}
                          value={row.tarifUnitaire}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            const lignes = c.forfait.lignes.map((x) =>
                              x.id === row.id
                                ? { ...x, tarifUnitaire: n }
                                : x,
                            );
                            patchContenu({ ...c, forfait: { lignes } });
                          }}
                        />
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatEuro(montantLigneForfait(row))}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={() =>
                            patchContenu({
                              ...c,
                              forfait: {
                                lignes: c.forfait.lignes.filter(
                                  (x) => x.id !== row.id,
                                ),
                              },
                            })
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                const ligne: LigneForfait = {
                  id: newId(),
                  libelle: "",
                  quantite: 1,
                  tarifUnitaire: 0,
                };
                patchContenu({
                  ...c,
                  forfait: {
                    lignes: [...c.forfait.lignes, ligne],
                  },
                });
              }}
            >
              + Ligne
            </button>
          </section>
          ) : null}

          {devis.modeleDevis !== "forfaitaire"
            ? ([
                  [
                    "preparationMiseEnPlace",
                    "Préparation de la mise en place",
                    "preparation",
                  ],
                  ["miseEnPlaceTerrain", "Mise en place terrain", "mise"],
                ] as const)
                .filter(([, , tab]) => onglet === tab)
                .map(([cle, titre]) => (
            <section key={cle} className={styles.section}>
              <h2>{titre}</h2>
              <p className={styles.hint}>
                Blocs d’actions : quantité × tarif selon l’unité (tarifs zone :
                h {tarifs.tarifHeure} € / j {tarifs.tarifJour} € / s.{" "}
                {tarifs.tarifSemaine} € / m. {tarifs.tarifMois} €).
              </p>
              {c[cle].blocs.map((bloc: BlocActions) => (
                <div key={bloc.id}>
                  <div className={styles.subHead}>
                    <input
                      className={styles.input}
                      style={{ maxWidth: "100%", marginRight: "0.5rem" }}
                      value={bloc.titre}
                      onChange={(e) => {
                        const blocs = c[cle].blocs.map((b) =>
                          b.id === bloc.id
                            ? { ...b, titre: e.target.value }
                            : b,
                        );
                        patchContenu({ ...c, [cle]: { blocs } });
                      }}
                    />
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => {
                        const blocs = c[cle].blocs.filter(
                          (b) => b.id !== bloc.id,
                        );
                        patchContenu({ ...c, [cle]: { blocs } });
                      }}
                    >
                      Supprimer le bloc
                    </button>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Qté</th>
                          <th>Unité</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {bloc.lignes.map((row: LigneActionTemps) => (
                          <tr key={row.id}>
                            <td>
                              <input
                                value={row.libelle}
                                onChange={(e) => {
                                  const blocs = c[cle].blocs.map((b) =>
                                    b.id !== bloc.id
                                      ? b
                                      : {
                                          ...b,
                                          lignes: b.lignes.map((x) =>
                                            x.id === row.id
                                              ? {
                                                  ...x,
                                                  libelle: e.target.value,
                                                }
                                              : x,
                                          ),
                                        },
                                  );
                                  patchContenu({ ...c, [cle]: { blocs } });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className={styles.tableMini}
                                value={row.quantite}
                                onChange={(e) => {
                                  const n = Number(e.target.value) || 0;
                                  const blocs = c[cle].blocs.map((b) =>
                                    b.id !== bloc.id
                                      ? b
                                      : {
                                          ...b,
                                          lignes: b.lignes.map((x) =>
                                            x.id === row.id
                                              ? { ...x, quantite: n }
                                              : x,
                                          ),
                                        },
                                  );
                                  patchContenu({ ...c, [cle]: { blocs } });
                                }}
                              />
                            </td>
                            <td>
                              <select
                                className={styles.select}
                                value={row.unite}
                                onChange={(e) => {
                                  const u = e.target.value as UniteTemps;
                                  const blocs = c[cle].blocs.map((b) =>
                                    b.id !== bloc.id
                                      ? b
                                      : {
                                          ...b,
                                          lignes: b.lignes.map((x) =>
                                            x.id === row.id
                                              ? { ...x, unite: u }
                                              : x,
                                          ),
                                        },
                                  );
                                  patchContenu({ ...c, [cle]: { blocs } });
                                }}
                              >
                                {UNITES.map((u) => (
                                  <option key={u.v} value={u.v}>
                                    {u.l}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.btnGhost}
                                onClick={() => {
                                  const blocs = c[cle].blocs.map((b) =>
                                    b.id !== bloc.id
                                      ? b
                                      : {
                                          ...b,
                                          lignes: b.lignes.filter(
                                            (x) => x.id !== row.id,
                                          ),
                                        },
                                  );
                                  patchContenu({ ...c, [cle]: { blocs } });
                                }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => {
                        const ligne: LigneActionTemps = {
                          id: newId(),
                          libelle: "",
                          quantite: 0,
                          unite: "heure",
                        };
                        const blocs = c[cle].blocs.map((b) =>
                          b.id === bloc.id
                            ? { ...b, lignes: [...b.lignes, ligne] }
                            : b,
                        );
                        patchContenu({ ...c, [cle]: { blocs } });
                      }}
                    >
                      + Ligne dans ce bloc
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ marginTop: "0.75rem" }}
                onClick={() => {
                  const b: BlocActions = {
                    id: newId(),
                    titre: "Nouveau bloc",
                    lignes: [],
                  };
                  patchContenu({
                    ...c,
                    [cle]: { blocs: [...c[cle].blocs, b] },
                  });
                }}
              >
                + Bloc d’actions
              </button>
            </section>
                ))
            : null}

          {onglet === "permanence" ? (
          <section className={styles.section}>
            <h2>Permanence</h2>
            <label className={styles.label}>
              Mode de calcul
              <select
                className={styles.select}
                value={c.permanence.mode}
                onChange={(e) =>
                  patchContenu({
                    ...c,
                    permanence: {
                      ...c.permanence,
                      mode: e.target.value as ModePermanence,
                    },
                  })
                }
              >
                {MODES_PERM.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.l}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.grid2}>
              <label className={styles.label}>
                Tarif jour (€)
                <input
                  type="number"
                  step="0.01"
                  className={styles.input}
                  value={c.permanence.tarifJour}
                  onChange={(e) =>
                    patchContenu({
                      ...c,
                      permanence: {
                        ...c.permanence,
                        tarifJour: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
              <label className={styles.label}>
                Tarif horaire (€)
                <input
                  type="number"
                  step="0.01"
                  className={styles.input}
                  value={c.permanence.tarifHeure}
                  onChange={(e) =>
                    patchContenu({
                      ...c,
                      permanence: {
                        ...c.permanence,
                        tarifHeure: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
              {c.permanence.mode === "forfait_jours" ? (
                <label className={styles.label}>
                  Nombre de jours facturés
                  <input
                    type="number"
                    step="0.01"
                    className={styles.input}
                    value={c.permanence.nombreJoursTotal}
                    onChange={(e) =>
                      patchContenu({
                        ...c,
                        permanence: {
                          ...c.permanence,
                          nombreJoursTotal: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </label>
              ) : (
                <>
                  <label className={styles.label}>
                    Nombre de semaines
                    <input
                      type="number"
                      step="0.01"
                      className={styles.input}
                      value={c.permanence.nbSemaines}
                      onChange={(e) =>
                        patchContenu({
                          ...c,
                          permanence: {
                            ...c.permanence,
                            nbSemaines: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    Jours par semaine
                    <input
                      type="number"
                      step="0.01"
                      className={styles.input}
                      value={c.permanence.nbJoursParSemaine}
                      onChange={(e) =>
                        patchContenu({
                          ...c,
                          permanence: {
                            ...c.permanence,
                            nbJoursParSemaine: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    Heures par jour
                    <input
                      type="number"
                      step="0.01"
                      className={styles.input}
                      value={c.permanence.nbHeuresParJour}
                      onChange={(e) =>
                        patchContenu({
                          ...c,
                          permanence: {
                            ...c.permanence,
                            nbHeuresParJour: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </label>
                </>
              )}
            </div>
          </section>
          ) : null}

          {onglet === "annexe" ? (
          <section className={styles.section}>
            <h2>PDF logiciel de comptabilité (annexe)</h2>
            <p className={styles.hint}>
              Importez l’export PDF : il sera fusionné après la synthèse budgétaire
              et avant la conclusion. Taille max recommandée{" "}
              {Math.round(PDF_MAX_BYTES / (1024 * 1024))} Mo (stockage local /
              synchronisation).
            </p>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) =>
                onPdfComptaChange(e.target.files?.[0] ?? null)
              }
            />
            {devis.pdfComptabiliteNom ? (
              <p className={styles.hint}>
                Fichier : {devis.pdfComptabiliteNom}{" "}
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => onPdfComptaChange(null)}
                >
                  Retirer
                </button>
              </p>
            ) : null}
          </section>
          ) : null}

          {onglet === "notes" ? (
          <section className={styles.section}>
            <h2>Notes internes</h2>
            <textarea
              className={styles.textarea}
              rows={3}
              value={devis.notes}
              onChange={(e) => patchDevis({ notes: e.target.value })}
            />
          </section>
          ) : null}

          {onglet === "synthese" ? (
          <section className={styles.section}>
            <h2>Domaines inclus dans le budget</h2>
            <p className={styles.hint}>
              Décochez un domaine pour l’exclure du total et du PDF (ligne
              « Hors budget »).
            </p>
            <div className={styles.checkRow}>
              {(devis.modeleDevis === "forfaitaire"
                ? CLES_SYNTHESE_FORFAIT
                : CLES_SYNTHESE_DETAILLE
              ).map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={c.domainesActifs[k]}
                    onChange={(e) =>
                      setActifs({ ...c.domainesActifs, [k]: e.target.checked })
                    }
                  />
                  {libelleCleDomaineActif(k)}
                </label>
              ))}
            </div>
            <label className={styles.label}>
              Frais de gestion (% du sous-total HT domaines inclus)
              <input
                type="number"
                step="0.01"
                className={styles.input}
                style={{ maxWidth: "8rem" }}
                value={c.fraisGestionPourcent}
                onChange={(e) =>
                  patchContenu({
                    ...c,
                    fraisGestionPourcent: Number(e.target.value) || 0,
                  })
                }
              />
            </label>
            <div className={styles.budgetPanel}>
              <h3 className={styles.budgetPanelTitle}>Synthèse (aperçu)</h3>
              <div className={styles.budgetRows}>
                {totaux.lignes.map((l) => (
                  <div
                    key={l.cle}
                    className={
                      l.actif
                        ? styles.budgetRow
                        : `${styles.budgetRow} ${styles.budgetRowMuted}`
                    }
                  >
                    <span>{l.libelle}</span>
                    <span>
                      {l.actif ? formatEuro(l.montant) : "— (exclu)"}
                    </span>
                  </div>
                ))}
                <div className={styles.budgetRow}>
                  <span>Sous-total HT</span>
                  <span>{formatEuro(totaux.sousTotalHt)}</span>
                </div>
                <div className={styles.budgetRow}>
                  <span>Frais de gestion</span>
                  <span>{formatEuro(totaux.fraisGestion)}</span>
                </div>
                <div className={styles.budgetTotal}>
                  <span>Total HT</span>
                  <span>{formatEuro(totaux.totalHt)}</span>
                </div>
              </div>
            </div>
          </section>
          ) : null}
        </form>
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
