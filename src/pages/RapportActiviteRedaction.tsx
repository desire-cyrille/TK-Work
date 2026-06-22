import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import {
  genererRapportActivitePdfBlob,
  telechargerRapportActivitePdf,
} from "../lib/exportRapportActivitePdf";
import { importerImageEnDataUrl } from "../lib/rapportImageImport";
import {
  putImageDataUrl,
  requestPersistentStorage,
  isImageRef,
} from "../lib/rapportActiviteImageDb";
import { ensureImageRefDataUrl } from "../lib/rapportActiviteImageDbCloud";
import {
  appliquerPrefillType,
  enregistrerRapportValide,
  getProjetRapportActivite,
  listerRapportsPourProjet,
  miseAJourRapportFiche,
  sauvegarderBrouillonProjet,
  sauvegarderProjetRapportActivite,
  supprimerRapportFiche,
} from "../lib/rapportActiviteStorage";
const FLUSH_BEFORE_CLOUD_PUSH_EVENT = "tk-gestion-flush-before-cloud-push";
import {
  appliquerTexteDomaineVersTableau,
  COL_ETAT_ID,
  contenuSiteVide,
  enrichirBrouillonDomaines,
  ligneTableauSuiviVisible,
  type RapportActiviteFiche,
  type RapportActiviteProjet,
  type RapportActiviteSite,
  type RapportBrouillonState,
  type RapportColonneTableau,
  type RapportDomaineDef,
  nouvelleLigneTableau,
  synchroniserTableauAvecTousLesDomaines,
} from "../lib/rapportActiviteTypes";
import styles from "./RapportActiviteRedaction.module.css";

type TabMain = "redaction" | "rapports" | "reglages";
type SubRedac = "meta" | "visuels" | "domaines" | "tableau" | "synthese";

const MAX_PHOTOS = 4;
/** Photos d’aperçu par site (onglet Visuels) — augmenté pour limiter moins les imports. */
const MAX_PHOTOS_VISUELS_PAR_SITE = 12;

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function brouillonDepuisProjet(p: RapportActiviteProjet): RapportBrouillonState {
  return alignerParSite(clone(p.brouillon), p);
}

function alignerParSite(
  draft: RapportBrouillonState,
  projet: RapportActiviteProjet,
): RapportBrouillonState {
  const parSite = { ...draft.parSite };
  for (const s of projet.sites) {
    if (!parSite[s.id]) {
      parSite[s.id] = contenuSiteVide(projet.domaines);
    }
  }
  const photosParSite = { ...draft.visuels.photosParSite };
  for (const s of projet.sites) {
    if (!photosParSite[s.id]) photosParSite[s.id] = [];
  }
  let siteActifId = draft.siteActifId;
  if (!projet.sites.some((s) => s.id === siteActifId)) {
    siteActifId = projet.sites[0]?.id ?? siteActifId;
  }
  return {
    ...draft,
    siteActifId,
    parSite,
    visuels: { ...draft.visuels, photosParSite },
  };
}

function isInlineImageDataUrl(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:image/");
}

function hasInlineImages(b: RapportBrouillonState): boolean {
  const v = b.visuels;
  if (isInlineImageDataUrl(v.logoPrincipal)) return true;
  if (isInlineImageDataUrl(v.logoClient)) return true;
  if (isInlineImageDataUrl(v.couverture)) return true;
  for (const arr of Object.values(v.photosParSite ?? {})) {
    if (arr?.some(isInlineImageDataUrl)) return true;
  }
  for (const site of Object.values(b.parSite ?? {})) {
    for (const bloc of Object.values(site.domainesTexte ?? {})) {
      if ((bloc?.photos ?? []).some(isInlineImageDataUrl)) return true;
    }
  }
  return false;
}

async function migrateBrouillonImagesToIdb(
  b: RapportBrouillonState,
): Promise<RapportBrouillonState> {
  const next: RapportBrouillonState = JSON.parse(JSON.stringify(b)) as RapportBrouillonState;

  async function migrateStr(s: string | undefined): Promise<string | undefined> {
    if (!s) return s;
    if (isImageRef(s)) return s;
    if (!isInlineImageDataUrl(s)) return s;
    // Les dataURLs trop petites ne posent pas problème, mais on homogénéise.
    return await putImageDataUrl(s);
  }

  next.visuels.logoPrincipal = await migrateStr(next.visuels.logoPrincipal);
  next.visuels.logoClient = await migrateStr(next.visuels.logoClient);
  next.visuels.couverture = await migrateStr(next.visuels.couverture);

  for (const [sid, arr] of Object.entries(next.visuels.photosParSite ?? {})) {
    const out: string[] = [];
    for (const s of arr ?? []) out.push((await migrateStr(s)) ?? "");
    next.visuels.photosParSite[sid] = out.filter(Boolean);
  }

  for (const site of Object.values(next.parSite ?? {})) {
    for (const domId of Object.keys(site.domainesTexte ?? {})) {
      const bloc = site.domainesTexte[domId];
      if (!bloc) continue;
      const out: string[] = [];
      for (const s of bloc.photos ?? []) out.push((await migrateStr(s)) ?? "");
      bloc.photos = out.filter(Boolean);
    }
  }
  return next;
}

function RapportVisuelPreview({ refOrDataUrl }: { refOrDataUrl?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const raw = refOrDataUrl?.trim();
    if (!raw) {
      setSrc(null);
      return;
    }
    void (async () => {
      const resolved = await ensureImageRefDataUrl(raw);
      if (!cancelled) setSrc(resolved?.startsWith("data:image/") ? resolved : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [refOrDataUrl]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className={styles.visuelPreview}
    />
  );
}

export function RapportActiviteRedaction() {
  const { id } = useParams<{ id: string }>();
  const projetId = (id ?? "").trim();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const projet = useMemo(
    () => (projetId ? getProjetRapportActivite(projetId) : undefined),
    [projetId, tick],
  );

  const [tabMain, setTabMain] = useState<TabMain>("redaction");
  const [subRedac, setSubRedac] = useState<SubRedac>("meta");
  const [draft, setDraft] = useState<RapportBrouillonState | null>(() => {
    if (!projetId) return null;
    const p = getProjetRapportActivite(projetId);
    return p ? brouillonDepuisProjet(p) : null;
  });
  const [clientNom, setClientNom] = useState("");
  const [piedPage, setPiedPage] = useState("");
  const [msgFin, setMsgFin] = useState("");
  const [domEd, setDomEd] = useState<RapportDomaineDef[]>([]);
  const [colEd, setColEd] = useState<RapportColonneTableau[]>([]);
  const [sitesEd, setSitesEd] = useState<RapportActiviteSite[]>([]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  /** Si défini, « Valider le rapport » met à jour cette fiche au lieu d’en créer une nouvelle. */
  const [editingFicheId, setEditingFicheId] = useState<string | null>(null);

  const draftRef = useRef<RapportBrouillonState | null>(null);
  draftRef.current = draft;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfApercuUrlRef = useRef<string | null>(null);
  pdfApercuUrlRef.current = pdfPreviewUrl;
  useEffect(() => {
    return () => {
      if (pdfApercuUrlRef.current) URL.revokeObjectURL(pdfApercuUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!projetId) {
      setDraft(null);
      return;
    }
    const p = getProjetRapportActivite(projetId);
    if (!p) {
      setDraft(null);
      return;
    }
    setDraft(brouillonDepuisProjet(p));
    setClientNom(p.clientNom);
    setPiedPage(p.piedPagePdf);
    setMsgFin(p.dernierePageMessage);
    setDomEd(p.domaines.map((d) => ({ ...d })));
    setColEd(p.colonnesTableau.map((c) => ({ ...c })));
    setSitesEd(p.sites.map((s) => ({ ...s })));
    setEditingFicheId(null);
    // Ne pas dépendre de projet.updatedAt : chaque sauvegarde du brouillon incrémente
    // updatedAt ; au prochain tick / refresh, l’effet relisait le stockage et écrasait
    // le brouillon React non encore flushé (perte de saisie au changement de site / onglet).
  }, [projetId]);

  useEffect(() => {
    if (!projet || !draft) return;
    const pid = projet.id;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveTimer.current = setTimeout(() => {
      const b = draftRef.current;
      if (b) sauvegarderBrouillonProjet(pid, b);
      saveTimer.current = null;
    }, 450);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const b = draftRef.current;
      if (b) sauvegarderBrouillonProjet(pid, b);
    };
  }, [projet, draft]);

  useEffect(() => {
    const flush = () => {
      const b = draftRef.current;
      const pid = projetId.trim();
      if (!b || !pid) return;
      try {
        sauvegarderBrouillonProjet(pid, clone(b));
      } catch {
        /* quota ou navigateur */
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [projetId]);

  useEffect(() => {
    const flush = () => {
      const b = draftRef.current;
      const pid = projetId.trim();
      if (!b || !pid) return;
      try {
        sauvegarderBrouillonProjet(pid, clone(b));
      } catch {
        /* quota ou navigateur */
      }
    };
    window.addEventListener(FLUSH_BEFORE_CLOUD_PUSH_EVENT, flush);
    return () => window.removeEventListener(FLUSH_BEFORE_CLOUD_PUSH_EVENT, flush);
  }, [projetId]);

  useEffect(() => {
    // Demande au navigateur de ne pas évincer trop vite le stockage (si supporté).
    void requestPersistentStorage();
  }, []);

  useEffect(() => {
    // Migration “one-shot” des anciens brouillons stockant des dataURLs dans localStorage.
    // On déporte les images dans IndexedDB et on ne garde que des références.
    if (!projet || !draft) return;
    if (!hasInlineImages(draft)) return;
    let cancelled = false;
    (async () => {
      try {
        const migrated = await migrateBrouillonImagesToIdb(draft);
        if (cancelled) return;
        setDraft(migrated);
        try {
          sauvegarderBrouillonProjet(projet.id, migrated);
        } catch {
          /* ignore: si quota déjà saturé, le prochain flush sera léger */
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projet, draft]);

  const fermerApercuPdf = useCallback(() => {
    setPdfPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pdfPreviewUrl) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermerApercuPdf();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pdfPreviewUrl, fermerApercuPdf]);

  if (!projetId) return <Navigate to="/rapport-activite/accueil" replace />;
  if (!projet) {
    return <Navigate to="/rapport-activite/accueil" replace />;
  }
  if (!draft) {
    return (
      <PageFrame title="Chargement…">
        <p className={styles.hint}>Préparation de l’éditeur…</p>
      </PageFrame>
    );
  }

  const projetCourant = projet;

  const siteBloc =
    draft.parSite[draft.siteActifId] ??
    contenuSiteVide(projetCourant.domaines);
  const allLignesTab = siteBloc.tableauLignes;
  const lignesVisiblesTab = allLignesTab.filter((l) =>
    ligneTableauSuiviVisible(siteBloc, l),
  );
  const lignesTableauAffichees =
    lignesVisiblesTab.length > 0
      ? lignesVisiblesTab
      : allLignesTab[0]
        ? [allLignesTab[0]]
        : allLignesTab;
  const rapportsListe = listerRapportsPourProjet(projetCourant.id);

  function majDraft(fn: (d: RapportBrouillonState) => RapportBrouillonState) {
    setDraft((cur) =>
      cur ? fn(alignerParSite(clone(cur), projetCourant)) : cur,
    );
  }

  async function importerVisuelRapport(
    file: File,
    maxEdge: number,
    patchVisuels: (
      v: RapportBrouillonState["visuels"],
      ref: string,
    ) => RapportBrouillonState["visuels"],
  ) {
    if (!projet) return;
    const r = await importerImageEnDataUrl(file, { maxEdge, jpegQuality: 0.82 });
    if (!r.ok) {
      window.alert(r.message);
      return;
    }
    try {
      const ref = await putImageDataUrl(r.dataUrl);
      const cur = draftRef.current;
      if (!cur) return;
      const next = alignerParSite(
        {
          ...cur,
          visuels: patchVisuels({ ...cur.visuels }, ref),
        },
        projet,
      );
      setDraft(next);
      sauvegarderBrouillonProjet(projet.id, next);
    } catch {
      window.alert(
        "Image enregistrée localement impossible. Réduisez la taille du fichier ou libérez de l’espace, puis réessayez.",
      );
    }
  }

  function onFusion() {
    if (!projet || !draft) return;
    if (
      !window.confirm(
        "Recalculer le contenu à partir des rapports enregistrés (selon le type et les dates) ? Le brouillon actuel sera remplacé.",
      )
    ) {
      return;
    }
    const next = appliquerPrefillType(projet.id, {
      typeRapport: draft.typeRapport,
      dateRapport: draft.dateRapport,
      moisCle: draft.moisCle ?? draft.dateRapport.slice(0, 7),
      titreDocument: draft.titreDocument,
    });
    if (next) {
      setDraft(alignerParSite(next, projet));
      setEditingFicheId(null);
      refresh();
    }
  }

  function enregistrerBrouillonMaintenant(message?: string) {
    const b = draftRef.current;
    if (!projet || !b) return;
    sauvegarderBrouillonProjet(projet.id, clone(b));
    refresh();
    window.alert(message ?? "Contenu enregistré sur cet appareil.");
  }

  function ouvrirRapportPourEdition(fiche: RapportActiviteFiche) {
    if (!projet) return;
    if (
      editingFicheId &&
      editingFicheId !== fiche.id &&
      !window.confirm(
        "Un autre rapport est en cours d’édition. Charger celui-ci et abandonner l’édition en cours ?",
      )
    ) {
      return;
    }
    const next = alignerParSite(clone(fiche.payload), projet);
    setDraft(next);
    setEditingFicheId(fiche.id);
    sauvegarderBrouillonProjet(projet.id, next);
    setTabMain("redaction");
    setSubRedac("domaines");
    refresh();
  }

  async function onValiderPdf() {
    if (!projet || !draft) return;
    const p = getProjetRapportActivite(projet.id);
    if (!p) return;
    if (editingFicheId) {
      if (!miseAJourRapportFiche(editingFicheId, draft)) {
        window.alert("Impossible de mettre à jour ce rapport enregistré.");
        return;
      }
      let pdfOk = true;
      try {
        await telechargerRapportActivitePdf(p, draft, draft.titreDocument);
      } catch (e) {
        pdfOk = false;
        console.error(e);
      }
      setEditingFicheId(null);
      refresh();
      setTabMain("rapports");
      window.alert(
        pdfOk
          ? "Rapport mis à jour et PDF régénéré."
          : "Rapport mis à jour. Le téléchargement du PDF a échoué : utilisez le bouton « PDF » dans l’onglet Rapports pour réessayer.",
      );
      return;
    }
    try {
      enregistrerRapportValide(projet.id, draft);
    } catch (e) {
      console.error(e);
      const quota =
        typeof DOMException !== "undefined" &&
        e instanceof DOMException &&
        e.name === "QuotaExceededError";
      window.alert(
        quota
          ? "Espace de stockage du navigateur insuffisant (souvent à cause d’images trop lourdes). Réduisez ou supprimez des photos dans le rapport, puis réessayez."
          : `Impossible d’enregistrer le rapport : ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }
    try {
      await telechargerRapportActivitePdf(p, draft, draft.titreDocument);
    } catch (e) {
      console.error(e);
      window.alert(
        "Le rapport est enregistré dans l’onglet Rapports, mais le téléchargement du PDF a échoué. Ouvrez l’onglet Rapports et cliquez sur « PDF » pour le générer à nouveau.",
      );
    }
    refresh();
    setTabMain("rapports");
  }

  async function ouvrirApercuPdfBrouillon() {
    if (!projet || !draft) return;
    const p = getProjetRapportActivite(projet.id);
    if (!p) return;
    try {
      const blob = await genererRapportActivitePdfBlob(p, draft);
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      window.alert(
        "Impossible de générer l’aperçu PDF. Réduisez la taille des images ou le contenu, puis réessayez.",
      );
    }
  }

  function saveReglages(e: FormEvent) {
    e.preventDefault();
    if (!projet || !draft) return;
    const domaines = domEd
      .map((d) => ({
        id: d.id.trim() || crypto.randomUUID(),
        label: d.label.trim() || "Domaine",
      }))
      .filter((d) => d.id);
    const colonnes = colEd
      .map((c) => ({
        id: c.id.trim() || `col_${crypto.randomUUID().slice(0, 8)}`,
        label: c.label.trim() || "Colonne",
      }))
      .filter((c) => c.id);
    const sites = sitesEd.map((s, i) => ({
      id: s.id,
      nom: s.nom.trim() || `Site ${i + 1}`,
    }));
    const nextDraft = enrichirBrouillonDomaines(draft, domaines);
    const projetMisAJour: RapportActiviteProjet = {
      ...projet,
      sites,
      domaines,
      colonnesTableau: colonnes,
      clientNom: clientNom.trim(),
      piedPagePdf: piedPage.trim(),
      dernierePageMessage: msgFin.trim(),
      brouillon: alignerParSite(nextDraft, { ...projet, sites }),
    };
    sauvegarderProjetRapportActivite(projetMisAJour);
    setDraft(alignerParSite(nextDraft, projetMisAJour));
    refresh();
    window.alert("Réglages enregistrés.");
  }

  return (
    <>
    <PageFrame
      title={projet.titre}
      actions={
        <>
          <Link
            to="/rapport-activite/accueil"
            className={frameStyles.headerCtaSecondary}
            style={{ textDecoration: "none" }}
          >
            Accueil
          </Link>
          <button
            type="button"
            className={frameStyles.headerCtaSecondary}
            onClick={() => ouvrirApercuPdfBrouillon()}
          >
            Aperçu PDF
          </button>
          <button
            type="button"
            className={frameStyles.headerCtaSecondary}
            onClick={() => onValiderPdf()}
          >
            {editingFicheId
              ? "Enregistrer les modifications (PDF)"
              : "Valider le rapport (PDF)"}
          </button>
        </>
      }
    >
      <div className={styles.page}>
        {editingFicheId ? (
          <p className={styles.hint} style={{ marginBottom: "0.75rem" }}>
            Édition d’un rapport déjà validé : les changements remplacent la fiche
            enregistrée lorsque vous cliquez sur « Enregistrer les modifications (PDF) ».
          </p>
        ) : null}
        <div className={styles.tabsMain} role="tablist">
          <button
            type="button"
            className={tabMain === "redaction" ? styles.tabMainActive : styles.tabMain}
            onClick={() => setTabMain("redaction")}
          >
            Rédaction
          </button>
          <button
            type="button"
            className={tabMain === "rapports" ? styles.tabMainActive : styles.tabMain}
            onClick={() => setTabMain("rapports")}
          >
            Rapports
          </button>
          <button
            type="button"
            className={tabMain === "reglages" ? styles.tabMainActive : styles.tabMain}
            onClick={() => setTabMain("reglages")}
          >
            Réglages du projet
          </button>
        </div>

        {tabMain === "redaction" ? (
          <>
            <div className={styles.panel}>
              <div className={styles.subTabs}>
                {(
                  [
                    ["meta", "Type & en-tête"],
                    ["visuels", "Visuels"],
                    ["domaines", "Domaines"],
                    ["tableau", "Tableau de suivi"],
                    ["synthese", "Synthèse"],
                  ] as const
                ).map(([k, lab]) => (
                  <button
                    key={k}
                    type="button"
                    className={subRedac === k ? styles.subTabActive : styles.subTab}
                    onClick={() => setSubRedac(k)}
                  >
                    {lab}
                  </button>
                ))}
              </div>

              {subRedac === "meta" ? (
                <>
                  <div className={styles.fieldRow}>
                    <label className={styles.label}>
                      Type de rapport
                      <select
                        className={styles.select}
                        value={draft.typeRapport}
                        onChange={(e) => {
                          const typeRapport = e.target.value as RapportBrouillonState["typeRapport"];
                          majDraft((d) => ({ ...d, typeRapport }));
                        }}
                      >
                        <option value="simple">Rapport simple</option>
                        <option value="quotidien">Rapport quotidien</option>
                        <option value="mensuel">Rapport mensuel</option>
                        <option value="fin_mission">Rapport de fin de mission</option>
                      </select>
                    </label>
                    <label className={styles.label}>
                      Titre du document
                      <input
                        className={styles.input}
                        value={draft.titreDocument}
                        onChange={(e) =>
                          majDraft((d) => ({ ...d, titreDocument: e.target.value }))
                        }
                      />
                    </label>
                    <label className={styles.label}>
                      Date du rapport
                      <input
                        type="date"
                        className={styles.input}
                        value={draft.dateRapport.slice(0, 10)}
                        onChange={(e) =>
                          majDraft((d) => ({
                            ...d,
                            dateRapport: e.target.value,
                            moisCle: e.target.value.slice(0, 7),
                          }))
                        }
                      />
                    </label>
                    {draft.typeRapport === "mensuel" ? (
                      <label className={styles.label}>
                        Mois (mensuel)
                        <input
                          type="month"
                          className={styles.input}
                          value={(draft.moisCle ?? draft.dateRapport.slice(0, 7)).slice(0, 7)}
                          onChange={(e) =>
                            majDraft((d) => ({
                              ...d,
                              moisCle: e.target.value,
                              dateRapport: `${e.target.value}-01`,
                            }))
                          }
                        />
                      </label>
                    ) : null}
                  </div>
                  <p className={styles.hint}>
                    Quotidien : préremplissage depuis le dernier rapport quotidien
                    enregistré avant la date choisie. Mensuel : fusion des quotidiens du
                    mois. Fin de mission : mensuels si présents, sinon tous les
                    quotidiens.
                  </p>
                  <div className={styles.btnRow}>
                    <button type="button" className={styles.btn} onClick={() => onFusion()}>
                      Appliquer la fusion (préremplissage)
                    </button>
                  </div>
                </>
              ) : null}

              {subRedac !== "meta" ? (
                <div className={styles.subBar}>
                  <span className={styles.hint} style={{ margin: 0 }}>
                    Site actif :
                  </span>
                  <div className={styles.sitePills}>
                    {projet.sites.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={
                          draft.siteActifId === s.id
                            ? styles.sitePillActive
                            : styles.sitePill
                        }
                        onClick={() => majDraft((d) => ({ ...d, siteActifId: s.id }))}
                      >
                        {s.nom}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {subRedac === "visuels" ? (
                <div className={styles.panel} style={{ marginBottom: 0 }}>
                  <p className={styles.hint}>
                    Logos et couverture apparaissent sur le PDF (page de garde et dernière
                    page). Les images sont redimensionnées automatiquement (max. 2400 px de côté)
                    pour éviter les échecs d’enregistrement et de génération PDF.
                  </p>
                  <div className={styles.btnRow} style={{ marginBottom: "0.75rem" }}>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => ouvrirApercuPdfBrouillon()}
                    >
                      Aperçu du PDF (brouillon)
                    </button>
                  </div>
                  <div className={styles.fieldRow}>
                    <label className={styles.label}>
                      Logo principal (haut gauche)
                      <input
                        type="file"
                        accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                        className={styles.input}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          void importerVisuelRapport(f, 600, (v, ref) => ({
                            ...v,
                            logoPrincipal: ref,
                          }));
                        }}
                      />
                      <RapportVisuelPreview refOrDataUrl={draft.visuels.logoPrincipal} />
                    </label>
                    <label className={styles.label}>
                      Logo client (haut droite)
                      <input
                        type="file"
                        accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                        className={styles.input}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          void importerVisuelRapport(f, 600, (v, ref) => ({
                            ...v,
                            logoClient: ref,
                          }));
                        }}
                      />
                      <RapportVisuelPreview refOrDataUrl={draft.visuels.logoClient} />
                    </label>
                    <label className={styles.label}>
                      Photo de couverture
                      <input
                        type="file"
                        accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                        className={styles.input}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          void importerVisuelRapport(f, 2400, (v, ref) => ({
                            ...v,
                            couverture: ref,
                          }));
                        }}
                      />
                      <RapportVisuelPreview refOrDataUrl={draft.visuels.couverture} />
                    </label>
                  </div>
                  <p className={styles.hint}>
                    Photos du site « {projet.sites.find((s) => s.id === draft.siteActifId)?.nom} »
                    (jusqu’à {MAX_PHOTOS_VISUELS_PAR_SITE} images)
                  </p>
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                    multiple
                    className={styles.input}
                    onChange={async (e) => {
                      const files = [...(e.target.files ?? [])];
                      e.target.value = "";
                      const sid = draft.siteActifId;
                      const cur = [...(draft.visuels.photosParSite[sid] ?? [])];
                      for (const f of files) {
                        if (cur.length >= MAX_PHOTOS_VISUELS_PAR_SITE) break;
                        const r = await importerImageEnDataUrl(f);
                        if (r.ok) cur.push(await putImageDataUrl(r.dataUrl));
                        else window.alert(r.message);
                      }
                      majDraft((d) => ({
                        ...d,
                        visuels: {
                          ...d.visuels,
                          photosParSite: { ...d.visuels.photosParSite, [sid]: cur },
                        },
                      }));
                    }}
                  />
                </div>
              ) : null}

              {subRedac === "domaines" ? (
                <div className={styles.panel} style={{ marginBottom: 0 }}>
                  <p className={styles.hint}>
                    Utilisez « Enregistrer » sous chaque domaine (ou sous le tableau) pour
                    forcer l’écriture immédiate sur cet appareil.
                  </p>
                  {projet.domaines.map((dom) => {
                    const bloc = siteBloc.domainesTexte[dom.id] ?? {
                      infos: [],
                      texte: "",
                      photos: [],
                    };
                    const infos =
                      Array.isArray(bloc.infos) && bloc.infos.length
                        ? bloc.infos
                        : bloc.texte?.trim()
                          ? [bloc.texte]
                          : [""];
                    return (
                      <div key={dom.id} style={{ marginBottom: "1.25rem" }}>
                        <strong>{dom.label}</strong>
                        {infos.map((val, infoIdx) => (
                          <textarea
                            key={`${dom.id}_${infoIdx}`}
                            className={styles.textarea}
                            style={{ width: "100%", marginTop: infoIdx === 0 ? "0.35rem" : "0.55rem" }}
                            value={val}
                            placeholder={
                              infoIdx === 0
                                ? "Information…"
                                : `Information ${infoIdx + 1}…`
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              majDraft((d) => {
                                const ps = { ...d.parSite };
                                const sid = d.siteActifId;
                                const sc = ps[sid];
                                if (!sc) return d;
                                const sc2 = { ...sc };
                                const prev = sc2.domainesTexte[dom.id] ?? {
                                  infos: [],
                                  texte: "",
                                  photos: [],
                                };
                                const nextInfos = Array.isArray(prev.infos)
                                  ? [...prev.infos]
                                  : infos.slice();
                                nextInfos[infoIdx] = v;
                                sc2.domainesTexte = {
                                  ...sc2.domainesTexte,
                                  [dom.id]: {
                                    ...prev,
                                    infos: nextInfos,
                                    texte: nextInfos.filter((x) => String(x ?? "").trim()).join("\n\n"),
                                  },
                                };
                                ps[sid] = appliquerTexteDomaineVersTableau(
                                  sc2,
                                  projetCourant.domaines,
                                  dom.id,
                                  sc2.domainesTexte[dom.id]?.texte ?? "",
                                );
                                return { ...d, parSite: ps };
                              });
                            }}
                          />
                        ))}
                        <div className={styles.btnRow} style={{ marginTop: "0.5rem" }}>
                          <button
                            type="button"
                            className={styles.btn}
                            onClick={() =>
                              majDraft((d) => {
                                const ps = { ...d.parSite };
                                const sid = d.siteActifId;
                                const sc = ps[sid];
                                if (!sc) return d;
                                const sc2 = { ...sc };
                                const prev = sc2.domainesTexte[dom.id] ?? {
                                  infos: [],
                                  texte: "",
                                  photos: [],
                                };
                                const nextInfos = Array.isArray(prev.infos) ? [...prev.infos] : infos.slice();
                                nextInfos.push("");
                                sc2.domainesTexte = {
                                  ...sc2.domainesTexte,
                                  [dom.id]: {
                                    ...prev,
                                    infos: nextInfos,
                                    texte: nextInfos.filter((x) => String(x ?? "").trim()).join("\n\n"),
                                  },
                                };
                                ps[sid] = appliquerTexteDomaineVersTableau(
                                  sc2,
                                  projetCourant.domaines,
                                  dom.id,
                                  sc2.domainesTexte[dom.id]?.texte ?? "",
                                );
                                return { ...d, parSite: ps };
                              })
                            }
                          >
                            Nouvelle information
                          </button>
                        </div>
                        <div className={styles.btnRow}>
                          <input
                            type="file"
                            accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                            multiple
                            className={styles.input}
                            onChange={async (e) => {
                              const files = [...(e.target.files ?? [])];
                              e.target.value = "";
                              const sid = draft.siteActifId;
                              const domId = dom.id;
                              let photos = [
                                ...(siteBloc.domainesTexte[domId]?.photos ?? []),
                              ];
                              for (const f of files) {
                                if (photos.length >= MAX_PHOTOS) break;
                                const r = await importerImageEnDataUrl(f);
                                if (r.ok) photos.push(await putImageDataUrl(r.dataUrl));
                                else window.alert(r.message);
                              }
                              photos = photos.slice(0, MAX_PHOTOS);
                              majDraft((d) => {
                                const ps = { ...d.parSite };
                                const sc = { ...ps[sid]! };
                                sc.domainesTexte = {
                                  ...sc.domainesTexte,
                                  [domId]: {
                                    infos: sc.domainesTexte[domId]?.infos ?? [],
                                    texte: sc.domainesTexte[domId]?.texte ?? "",
                                    photos,
                                  },
                                };
                                ps[sid] = sc;
                                return { ...d, parSite: ps };
                              });
                            }}
                          />
                        </div>
                        <div className={styles.btnRow}>
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={() =>
                              enregistrerBrouillonMaintenant(
                                `« ${dom.label} » et le reste du brouillon sont enregistrés.`,
                              )
                            }
                          >
                            Enregistrer (ce domaine et le brouillon)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {subRedac === "tableau" ? (
                <div className={styles.panel} style={{ marginBottom: 0 }}>
                  <p className={styles.hint}>
                    Les textes saisis dans l’onglet Domaines alimentent la colonne « Observation »
                    (1re ligne par domaine pour le site actif). Vous pouvez aussi forcer une mise à jour
                    complète ci-dessous. Les lignes sans domaine renseigné ni autre saisie utile sont
                    masquées ici et dans le PDF (comme les domaines vides sur le PDF).
                  </p>
                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() =>
                        majDraft((d) => {
                          const sid = d.siteActifId;
                          const sc = d.parSite[sid];
                          if (!sc) return d;
                          return {
                            ...d,
                            parSite: {
                              ...d.parSite,
                              [sid]: synchroniserTableauAvecTousLesDomaines(
                                sc,
                                projetCourant.domaines,
                              ),
                            },
                          };
                        })
                      }
                    >
                      Reprendre tous les domaines dans le tableau
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() =>
                        majDraft((d) => {
                          const ps = { ...d.parSite };
                          const sc = { ...ps[d.siteActifId]! };
                          sc.tableauLignes = [
                            ...sc.tableauLignes,
                            nouvelleLigneTableau(projet.domaines),
                          ];
                          ps[d.siteActifId] = sc;
                          return { ...d, parSite: ps };
                        })
                      }
                    >
                      Ajouter une ligne
                    </button>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          {projet.colonnesTableau.map((c) => (
                            <th key={c.id}>{c.label}</th>
                          ))}
                          <th> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lignesTableauAffichees.map((ligne) => {
                          const idx = siteBloc.tableauLignes.indexOf(ligne);
                          return (
                          <tr key={ligne.id}>
                            {projet.colonnesTableau.map((c) => (
                              <td key={c.id}>
                                {c.id === "domaine" ? (
                                  <select
                                    className={styles.select}
                                    style={{ width: "100%" }}
                                    value={ligne.domaineId}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      majDraft((d) => {
                                        const ps = { ...d.parSite };
                                        const sc = { ...ps[d.siteActifId]! };
                                        const lines = [...sc.tableauLignes];
                                        if (idx < 0) return d;
                                        lines[idx] = { ...lines[idx]!, domaineId: v };
                                        sc.tableauLignes = lines;
                                        ps[d.siteActifId] = sc;
                                        return { ...d, parSite: ps };
                                      });
                                    }}
                                  >
                                    {projet.domaines.map((dom) => (
                                      <option key={dom.id} value={dom.id}>
                                        {dom.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : c.id === COL_ETAT_ID ? (
                                  <div className={styles.etatRow}>
                                    {(["vert", "bleu", "orange", "noir"] as const).map(
                                      (ev) => (
                                        <button
                                          key={ev}
                                          type="button"
                                          className={styles.etatSq}
                                          title={ev}
                                          aria-pressed={ligne.etat === ev}
                                          data-selected={ligne.etat === ev}
                                          style={{
                                            background:
                                              ev === "vert"
                                                ? "#2e7d32"
                                                : ev === "bleu"
                                                  ? "#1565c0"
                                                  : ev === "orange"
                                                    ? "#ef6c00"
                                                    : "#212121",
                                          }}
                                          onClick={() =>
                                            majDraft((d) => {
                                              if (idx < 0) return d;
                                              const ps = { ...d.parSite };
                                              const sc = { ...ps[d.siteActifId]! };
                                              const lines = [...sc.tableauLignes];
                                              lines[idx] = {
                                                ...lines[idx]!,
                                                etat: ligne.etat === ev ? "" : ev,
                                              };
                                              sc.tableauLignes = lines;
                                              ps[d.siteActifId] = sc;
                                              return { ...d, parSite: ps };
                                            })
                                          }
                                        />
                                      ),
                                    )}
                                  </div>
                                ) : (
                                  // Toutes les cellules éditables (sauf select domaine + état) sont redimensionnables.
                                  c.id === "observation" ||
                                  c.id === "relances" ||
                                  c.id === "sujet" ||
                                  c.id === "responsable" ? (
                                    <textarea
                                      className={styles.tableTextarea}
                                      value={
                                        c.id === "observation"
                                          ? ligne.observation
                                          : c.id === "relances"
                                            ? ligne.relances
                                            : c.id === "sujet"
                                              ? ligne.sujet
                                              : ligne.responsable
                                      }
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        majDraft((d) => {
                                          const ps = { ...d.parSite };
                                          const sc = { ...ps[d.siteActifId]! };
                                          const lines = [...sc.tableauLignes];
                                          if (idx < 0) return d;
                                          const L = { ...lines[idx]! };
                                          if (c.id === "observation") L.observation = v;
                                          else if (c.id === "relances") L.relances = v;
                                          else if (c.id === "sujet") L.sujet = v;
                                          else L.responsable = v;
                                          lines[idx] = L;
                                          sc.tableauLignes = lines;
                                          ps[d.siteActifId] = sc;
                                          return { ...d, parSite: ps };
                                        });
                                      }}
                                    />
                                  ) : (
                                    <textarea
                                      className={styles.tableTextarea}
                                      value={ligne.extra[c.id] ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        majDraft((d) => {
                                          const ps = { ...d.parSite };
                                          const sc = { ...ps[d.siteActifId]! };
                                          const lines = [...sc.tableauLignes];
                                          if (idx < 0) return d;
                                          const L = { ...lines[idx]! };
                                          L.extra = { ...L.extra, [c.id]: v };
                                          lines[idx] = L;
                                          sc.tableauLignes = lines;
                                          ps[d.siteActifId] = sc;
                                          return { ...d, parSite: ps };
                                        });
                                      }}
                                    />
                                  )
                                )}
                              </td>
                            ))}
                            <td>
                              <button
                                type="button"
                                className={styles.btnDanger}
                                disabled={idx < 0}
                                onClick={() =>
                                  majDraft((d) => {
                                    const ps = { ...d.parSite };
                                    const sc = { ...ps[d.siteActifId]! };
                                    if (idx < 0) return d;
                                    sc.tableauLignes = sc.tableauLignes.filter(
                                      (_, i) => i !== idx,
                                    );
                                    if (sc.tableauLignes.length === 0) {
                                      sc.tableauLignes = [
                                        nouvelleLigneTableau(projet.domaines),
                                      ];
                                    }
                                    ps[d.siteActifId] = sc;
                                    return { ...d, parSite: ps };
                                  })
                                }
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.btnRow} style={{ marginTop: "1rem" }}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() =>
                        enregistrerBrouillonMaintenant(
                          "Tableau de suivi et brouillon complets enregistrés.",
                        )
                      }
                    >
                      Enregistrer le tableau et le brouillon
                    </button>
                  </div>
                </div>
              ) : null}

              {subRedac === "synthese" ? (
                <div className={styles.panel} style={{ marginBottom: 0 }}>
                  <textarea
                    className={styles.textarea}
                    style={{ width: "100%" }}
                    value={draft.syntheseGlobale}
                    onChange={(e) =>
                      majDraft((d) => ({ ...d, syntheseGlobale: e.target.value }))
                    }
                    placeholder="Synthèse globale du rapport…"
                  />
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {tabMain === "rapports" ? (
          <div className={styles.panel}>
            <p className={styles.hint}>
              Rapports validés (enregistrés). Modifier charge le rapport dans l’onglet Rédaction ;
              Valider le PDF met à jour la fiche existante. Vous pouvez aussi supprimer une fiche ou
              régénérer le PDF.
            </p>
            <ul className={styles.listRapports}>
              {rapportsListe.length === 0 ? (
                <li>Aucun rapport validé pour ce projet.</li>
              ) : (
                rapportsListe.map((r) => (
                  <li key={r.id}>
                    <span>
                      {r.titreDocument} — {r.dateRapport} ({r.typeRapport})
                    </span>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => {
                        const p = getProjetRapportActivite(projet.id);
                        if (p) void telechargerRapportActivitePdf(p, r.payload, r.titreDocument);
                      }}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => ouvrirRapportPourEdition(r)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={() => {
                        if (window.confirm("Supprimer ce rapport enregistré ?")) {
                          supprimerRapportFiche(r.id);
                          refresh();
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}

        {tabMain === "reglages" ? (
          <form className={styles.panel} onSubmit={saveReglages}>
            <label className={styles.label}>
              Nom du client (en-tête PDF)
              <input
                className={styles.input}
                value={clientNom}
                onChange={(e) => setClientNom(e.target.value)}
              />
            </label>
            <strong style={{ display: "block", marginTop: "0.75rem" }}>Noms des sites</strong>
            <p className={styles.hint} style={{ marginTop: "0.25rem" }}>
              Les identifiants internes ne changent pas : seul le libellé affiché (PDF, onglets) est modifié.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 1rem" }}>
              {sitesEd.map((s, i) => (
                <li key={s.id} className={styles.fieldRow} style={{ alignItems: "flex-end" }}>
                  <label className={styles.label}>
                    Site {i + 1}
                    <input
                      className={styles.input}
                      value={s.nom}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSitesEd((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, nom: v } : x)),
                        );
                      }}
                    />
                  </label>
                </li>
              ))}
            </ul>
            <label className={styles.label}>
              Pied de page (PDF)
              <textarea
                className={styles.textarea}
                value={piedPage}
                onChange={(e) => setPiedPage(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Message dernière page
              <textarea
                className={styles.textarea}
                value={msgFin}
                onChange={(e) => setMsgFin(e.target.value)}
              />
            </label>
            <p className={styles.hint}>
              Domaines d’activité (rédaction par domaine) et colonnes du tableau de suivi.
              La colonne « État » utilise les quatre couleurs dans la rédaction.
            </p>
            <strong>Domaines</strong>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 1rem" }}>
              {domEd.map((d, i) => (
                <li key={d.id} className={styles.fieldRow} style={{ alignItems: "flex-end" }}>
                  <label className={styles.label}>
                    Id
                    <input
                      className={styles.input}
                      value={d.id}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDomEd((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, id: v } : x)),
                        );
                      }}
                    />
                  </label>
                  <label className={styles.label}>
                    Libellé
                    <input
                      className={styles.input}
                      value={d.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDomEd((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, label: v } : x)),
                        );
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    disabled={domEd.length <= 1}
                    onClick={() =>
                      setDomEd((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.btn}
              onClick={() =>
                setDomEd((prev) => [
                  ...prev,
                  { id: `dom_${crypto.randomUUID().slice(0, 8)}`, label: "Nouveau domaine" },
                ])
              }
            >
              Ajouter un domaine
            </button>

            <strong style={{ display: "block", marginTop: "1.25rem" }}>Colonnes du tableau</strong>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 1rem" }}>
              {colEd.map((c, i) => (
                <li key={c.id} className={styles.fieldRow} style={{ alignItems: "flex-end" }}>
                  <label className={styles.label}>
                    Id
                    <input
                      className={styles.input}
                      value={c.id}
                      disabled={c.id === COL_ETAT_ID}
                      onChange={(e) => {
                        const v = e.target.value;
                        setColEd((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, id: v } : x)),
                        );
                      }}
                    />
                  </label>
                  <label className={styles.label}>
                    Libellé
                    <input
                      className={styles.input}
                      value={c.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setColEd((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, label: v } : x)),
                        );
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    disabled={c.id === COL_ETAT_ID || colEd.length <= 2}
                    onClick={() =>
                      setColEd((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.btn}
              onClick={() =>
                setColEd((prev) => [
                  ...prev,
                  {
                    id: `col_${crypto.randomUUID().slice(0, 8)}`,
                    label: "Nouvelle colonne",
                  },
                ])
              }
            >
              Ajouter une colonne
            </button>

            <div className={styles.btnRow} style={{ marginTop: "1.25rem" }}>
              <button type="submit" className={styles.btnPrimary}>
                Enregistrer les réglages du projet
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </PageFrame>
    {pdfPreviewUrl ? (
      <div
        className={styles.pdfPreviewOverlay}
        onClick={() => fermerApercuPdf()}
        role="presentation"
      >
        <div
          className={styles.pdfPreviewBox}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu du PDF"
        >
          <div className={styles.pdfPreviewBar}>
            <span className={styles.pdfPreviewTitle}>Aperçu PDF (brouillon)</span>
            <button type="button" className={styles.btn} onClick={() => fermerApercuPdf()}>
              Fermer
            </button>
          </div>
          <iframe
            title="Aperçu PDF"
            src={`${pdfPreviewUrl}#toolbar=1`}
            className={styles.pdfPreviewFrame}
          />
        </div>
      </div>
    ) : null}
    </>
  );
}
