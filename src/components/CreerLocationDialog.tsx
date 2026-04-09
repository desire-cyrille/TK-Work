import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ContratLocation } from "../types/domain";
import { useBiens } from "../context/BiensContext";
import { useFinance } from "../context/FinanceContext";
import { useThemeSettings } from "../context/ThemeSettingsContext";
import {
  buildBailPdf,
  libelleTypeBailPourPdf,
  telechargerBailPdf,
  type BailPdfOptions,
} from "../lib/pdfLocatif";
import {
  PdfPreviewDialog,
  type PdfApercu,
} from "./PdfPreviewDialog";
import formStyles from "../pages/NouveauLogement.module.css";
import { BienLoueTabFields, type BienLoueContext } from "./BienLoueTabFields";
import { nomCompletLocataire } from "../lib/locataireUi";
import {
  categorieLocataireSurLogement,
  lignesAdresseBailleur,
  ligneRepresentantLegalBailleur,
  locataireEstRattacheAuLogement,
} from "../types/domain";
import { FR_TEXTAREA_PROPS } from "../lib/frTextFieldProps";
import styles from "./CreerLocationDialog.module.css";

/** Plafond pour stocker le bail signé en local (localStorage). */
const MAX_BAIL_SIGNE_OCTETS = Math.floor(3.5 * 1024 * 1024);
const BAIL_SIGNE_EXT = /\.(pdf|doc|docx)$/i;

async function fichierVersBailSigne(
  fichier: File
): Promise<{ nom: string; dataUrl: string } | { erreur: string }> {
  if (!BAIL_SIGNE_EXT.test(fichier.name)) {
    return {
      erreur: "Formats acceptés : PDF ou Word (.doc, .docx).",
    };
  }
  if (fichier.size > MAX_BAIL_SIGNE_OCTETS) {
    return {
      erreur: `Fichier trop volumineux (maximum ${Math.round((MAX_BAIL_SIGNE_OCTETS / (1024 * 1024)) * 10) / 10} Mo pour l’enregistrement dans le navigateur).`,
    };
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result as string);
    lecteur.onerror = () => reject(new Error("lecture"));
    lecteur.readAsDataURL(fichier);
  });
  return { nom: fichier.name, dataUrl };
}

const TABS = [
  { id: "bien", label: "Bien loué" },
  { id: "bail", label: "Bail" },
  { id: "complement", label: "Informations complémentaires" },
  { id: "quittances", label: "Quittances" },
  { id: "garants", label: "Garants" },
  { id: "assurances", label: "Assurances" },
  { id: "documents", label: "Documents" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function emptyContrat(): Omit<ContratLocation, "id"> {
  return {
    logementId: "",
    locataireId: "",
    locataireSousBailleurId: "",
    libelleExploitation: "",
    colocataireIds: [],
    typeBail: "",
    usageLogement: "",
    identifiantBail: "",
    dateDebut: "",
    dateFin: "",
    dureeMois: "",
    renouvellementTacite: "",
    periodicite: "",
    paiementEchoirOuEchu: "",
    moyenPaiement: "",
    jourPaiement: "",
    jourQuittancement: "",
    generationLoyerRelatif: "",
    loyerHc: "",
    loyerHcTva: "",
    charges: "",
    chargesTva: "",
    typeChargesLoyer: "",
    loyerChargesComprises: "",
    autresPaiements: [],
    premierLoyerProrata: "",
    dateFinPeriodePremiereQuittance: "",
    premierLoyerHcCalcule: "",
    premierLoyerChargesCalcule: "",
    depotGarantie: "",
    depotGarantieType: "",
    depotGarantieDocumentNote: "",
    depotGarantieDateVersement: "",
    modeRevisionLoyer: "",
    indiceRevisionLibelle: "",
    trimestreIndiceRevision: "",
    valeurIndiceRevision: "",
    revisionAutomatique: "",
    revisionSur: "",
    periodeRevision: "",
    dateRevisionMode: "",
    dateRevisionFixe: "",
    encadrementRefMajore: "",
    encadrementZoneIrl: "",
    loyerReferenceM2: "",
    loyerMajoreM2: "",
    complementLoyerMontant: "",
    complementLoyerDescription: "",
    bailPrecedent18Mois: "",
    dernierLoyerApplique: "",
    dernierLoyerDateVersement: "",
    derniereRevisionDate: "",
    loyerReevaluation: "",
    numeroContratInterne: "",
    indexation: "",
    clauseParticuliere: "",
    infosComplementaires: "",
    frequenceQuittance: "",
    modeEnvoiQuittance: "",
    montantCaution: "",
    nomsGarants: "",
    organismeGarantie: "",
    refGarantie: "",
    assuranceLoyerImpaye: "",
    multirisqueHabitation: "",
    assureur: "",
    numeroPolice: "",
    dateEcheanceAssurance: "",
    notesAssurance: "",
    urlBail: "",
    bailSigneImportNom: "",
    bailSigneDataUrl: "",
    urlEtatDesLieux: "",
    autresDocuments: "",
    etatDesLieuxRempli: "",
    etatDesLieuxImportNom: "",
  };
}

function contratToDraft(c: ContratLocation): Omit<ContratLocation, "id"> {
  const { id: _id, ...rest } = c;
  return { ...emptyContrat(), ...rest };
}

function trimContrat(d: Omit<ContratLocation, "id">): Omit<ContratLocation, "id"> {
  const t = (s: string) => s.trim();
  return {
    ...d,
    logementId: t(d.logementId),
    locataireId: t(d.locataireId),
    locataireSousBailleurId: t(d.locataireSousBailleurId),
    libelleExploitation: t(d.libelleExploitation),
    colocataireIds: d.colocataireIds.map((x) => t(x)).filter(Boolean),
    identifiantBail: t(d.identifiantBail),
    dateDebut: t(d.dateDebut),
    dateFin: t(d.dateFin),
    dureeMois: t(d.dureeMois),
    moyenPaiement: t(d.moyenPaiement),
    jourPaiement: t(d.jourPaiement),
    jourQuittancement: t(d.jourQuittancement),
    generationLoyerRelatif: t(d.generationLoyerRelatif),
    loyerHc: t(d.loyerHc),
    loyerHcTva: t(d.loyerHcTva),
    charges: t(d.charges),
    chargesTva: t(d.chargesTva),
    loyerChargesComprises: t(d.loyerChargesComprises),
    autresPaiements: d.autresPaiements.map((row) => ({
      ...row,
      montant: t(row.montant),
      tva: t(row.tva),
      categorie: t(row.categorie),
      description: t(row.description),
    })),
    dateFinPeriodePremiereQuittance: t(d.dateFinPeriodePremiereQuittance),
    premierLoyerHcCalcule: t(d.premierLoyerHcCalcule),
    premierLoyerChargesCalcule: t(d.premierLoyerChargesCalcule),
    depotGarantie: t(d.depotGarantie),
    depotGarantieType: t(d.depotGarantieType),
    depotGarantieDocumentNote: t(d.depotGarantieDocumentNote),
    depotGarantieDateVersement: t(d.depotGarantieDateVersement),
    indiceRevisionLibelle: t(d.indiceRevisionLibelle),
    trimestreIndiceRevision: t(d.trimestreIndiceRevision),
    valeurIndiceRevision: t(d.valeurIndiceRevision),
    periodeRevision: t(d.periodeRevision),
    dateRevisionFixe: t(d.dateRevisionFixe),
    loyerReferenceM2: t(d.loyerReferenceM2),
    loyerMajoreM2: t(d.loyerMajoreM2),
    complementLoyerMontant: t(d.complementLoyerMontant),
    complementLoyerDescription: t(d.complementLoyerDescription),
    dernierLoyerApplique: t(d.dernierLoyerApplique),
    dernierLoyerDateVersement: t(d.dernierLoyerDateVersement),
    derniereRevisionDate: t(d.derniereRevisionDate),
    numeroContratInterne: t(d.numeroContratInterne),
    indexation: t(d.indexation),
    clauseParticuliere: t(d.clauseParticuliere),
    infosComplementaires: t(d.infosComplementaires),
    montantCaution: t(d.montantCaution),
    nomsGarants: t(d.nomsGarants),
    organismeGarantie: t(d.organismeGarantie),
    refGarantie: t(d.refGarantie),
    assureur: t(d.assureur),
    numeroPolice: t(d.numeroPolice),
    dateEcheanceAssurance: t(d.dateEcheanceAssurance),
    notesAssurance: t(d.notesAssurance),
    urlBail: t(d.urlBail),
    bailSigneImportNom: t(d.bailSigneImportNom),
    bailSigneDataUrl: d.bailSigneDataUrl,
    urlEtatDesLieux: t(d.urlEtatDesLieux),
    autresDocuments: t(d.autresDocuments),
    etatDesLieuxRempli: t(d.etatDesLieuxRempli),
    etatDesLieuxImportNom: t(d.etatDesLieuxImportNom),
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** S’il est défini, le formulaire charge ce contrat pour modification */
  contratIdAEditer?: string | null;
  /**
   * Assistant : même logement, bail principal puis sous-location avec libellé commercial.
   */
  chainWizard?: boolean;
};

export function CreerLocationDialog({
  open,
  onClose,
  contratIdAEditer = null,
  chainWizard = false,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const {
    logements,
    locataires,
    contratsLocation,
    addContratLocation,
    updateContratLocation,
    addChaineLocation,
    getBailleur,
    getLogement,
  } = useBiens();
  const finance = useFinance();
  const { settings } = useThemeSettings();
  const contratsRef = useRef(contratsLocation);
  contratsRef.current = contratsLocation;
  const chainePrincipalContratIdRef = useRef<string | null>(null);

  const [tab, setTab] = useState<TabId>("bien");
  const [draft, setDraft] = useState<Omit<ContratLocation, "id">>(emptyContrat);
  const [error, setError] = useState<string | null>(null);
  const [apercuBailPdf, setApercuBailPdf] = useState<PdfApercu | null>(null);
  const apercuBailRef = useRef<PdfApercu | null>(null);
  apercuBailRef.current = apercuBailPdf;
  const [chainAck, setChainAck] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardLogementId, setWizardLogementId] = useState("");
  const [chainePrincipalNom, setChainePrincipalNom] = useState("");
  const bailSigneFileInputRef = useRef<HTMLInputElement>(null);
  const [bailSigneZoneActive, setBailSigneZoneActive] = useState(false);
  const [bailUrlCopieMessage, setBailUrlCopieMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      el.showModal();
      setTab("bien");
      setError(null);
      setBailUrlCopieMessage(null);
      setBailSigneZoneActive(false);
      setChainAck(false);
      if (contratIdAEditer) {
        const c = contratsRef.current.find((x) => x.id === contratIdAEditer);
        setDraft(c ? contratToDraft(c) : emptyContrat());
      } else if (chainWizard) {
        setWizardStep(1);
        setWizardLogementId("");
        setChainePrincipalNom("");
        chainePrincipalContratIdRef.current = null;
        setDraft(emptyContrat());
      } else {
        setDraft(emptyContrat());
      }
    } else if (el.open) {
      el.close();
    }
  }, [open, contratIdAEditer, chainWizard]);

  useEffect(() => {
    if (!open) {
      setApercuBailPdf((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return null;
      });
    }
  }, [open]);

  useEffect(() => {
    return () => {
      const p = apercuBailRef.current;
      if (p?.blobUrl) URL.revokeObjectURL(p.blobUrl);
    };
  }, []);

  const logementContexte = useMemo(
    () => logements.find((l) => l.id === wizardLogementId),
    [logements, wizardLogementId]
  );
  const bailleurContexte = logementContexte
    ? getBailleur(logementContexte.bailleurId)
    : undefined;

  const logementsSorted = useMemo(
    () =>
      [...logements].sort((a, b) =>
        a.titre.localeCompare(b.titre, "fr", { sensitivity: "base" })
      ),
    [logements]
  );

  const locatairesPourBien = useMemo(() => {
    if (!draft.logementId) return [];
    let list = locataires.filter((l) =>
      locataireEstRattacheAuLogement(l, draft.logementId)
    );
    if (chainWizard && !contratIdAEditer && wizardStep === 2) {
      list = list.filter(
        (l) =>
          categorieLocataireSurLogement(l, draft.logementId) === "locataire"
      );
    }
    if (chainWizard && !contratIdAEditer && wizardStep === 3) {
      list = list.filter(
        (l) =>
          categorieLocataireSurLogement(l, draft.logementId) ===
          "sous-locataire"
      );
    }
    return list;
  }, [locataires, draft.logementId, chainWizard, contratIdAEditer, wizardStep]);

  const bienLoueContext: BienLoueContext = contratIdAEditer
    ? "standard"
    : chainWizard && wizardStep === 2
      ? "chaine_bail_principal"
      : chainWizard && wizardStep === 3
        ? "chaine_sous_location"
        : "standard";

  function avancerVersBailPrincipal() {
    setError(null);
    if (!wizardLogementId.trim()) {
      setError("Choisissez le logement concerné par la chaîne de locations.");
      return;
    }
    setDraft({ ...emptyContrat(), logementId: wizardLogementId });
    setWizardStep(2);
    setTab("bien");
  }

  function set<K extends keyof Omit<ContratLocation, "id">>(
    key: K,
    value: Omit<ContratLocation, "id">[K]
  ) {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "logementId") {
        const newLid = value as string;
        next.colocataireIds = [];
        const stillOk = locataires.some(
          (l) =>
            l.id === d.locataireId &&
            locataireEstRattacheAuLogement(l, newLid)
        );
        if (!stillOk) next.locataireId = "";
      }
      if (key === "locataireId") {
        const newLoc = value as string;
        next.colocataireIds = next.colocataireIds.filter((id) => id !== newLoc);
      }
      return next;
    });
  }

  function closeDialog() {
    ref.current?.close();
    onClose();
  }

  function handleDialogClose() {
    onClose();
  }

  function construireOptionsProjetBailPdf(): BailPdfOptions | null {
    setError(null);
    const data = trimContrat(draft);
    const contratPourPdf: ContratLocation = {
      ...data,
      id: contratIdAEditer ?? `brouillon-${Date.now().toString(36)}`,
    };
    const logement = getLogement(contratPourPdf.logementId);
    const bailleur = logement
      ? getBailleur(logement.bailleurId)
      : undefined;
    const loc = locataires.find((l) => l.id === contratPourPdf.locataireId);
    if (!contratPourPdf.logementId.trim()) {
      setError("Choisissez d’abord le logement (onglet « Bien loué »).");
      setTab("bien");
      return null;
    }
    if (!logement || !bailleur) {
      setError(
        "Le logement ou le bailleur est introuvable. Vérifiez la fiche logement."
      );
      setTab("bien");
      return null;
    }
    if (!contratPourPdf.locataireId.trim() || !loc) {
      setError(
        "Sélectionnez le locataire ou sous-locataire (onglet « Bien loué »)."
      );
      setTab("bien");
      return null;
    }
    const estSousLoc = contratPourPdf.locataireSousBailleurId.trim().length > 0;
    const sousBailleur = estSousLoc
      ? locataires.find(
          (l) => l.id === contratPourPdf.locataireSousBailleurId
        )
      : undefined;
    if (estSousLoc && !sousBailleur) {
      setError(
        "Pour une sous-location, la fiche du sous-bailleur (locataire principal) est requise."
      );
      setTab("bien");
      return null;
    }
    return {
      titre: estSousLoc
        ? `Projet de bail — sous-location — ${logement.titre}`
        : `Projet de bail — ${logement.titre}`,
      contrat: contratPourPdf,
      logement,
      bailleur,
      locataire: loc,
      sousBailleur,
      roleContrat: estSousLoc ? "sous_location" : "principal",
      emetteurDocuments: settings.emetteurDocumentsPdf,
      logoDocumentsPdf: settings.logoDocumentsPdf,
    };
  }

  function ouvrirApercuProjetBail() {
    const opts = construireOptionsProjetBailPdf();
    if (!opts) return;
    const { doc, fileName } = buildBailPdf(opts);
    const blobUrl = URL.createObjectURL(doc.output("blob"));
    setApercuBailPdf((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return {
        blobUrl,
        fileName,
        title: "Aperçu — Projet de bail",
      };
    });
  }

  function fermerApercuBail() {
    setApercuBailPdf((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  }

  function telechargerProjetBailDepuisFiche() {
    const opts = construireOptionsProjetBailPdf();
    if (!opts) return;
    telechargerBailPdf(opts);
  }

  async function appliquerFichierBailSigne(fichier: File | undefined) {
    if (!fichier?.size) return;
    setError(null);
    const resultat = await fichierVersBailSigne(fichier);
    if ("erreur" in resultat) {
      setError(resultat.erreur);
      return;
    }
    setDraft((d) => ({
      ...d,
      bailSigneImportNom: resultat.nom,
      bailSigneDataUrl: resultat.dataUrl,
    }));
  }

  function retirerBailSigne() {
    setDraft((d) => ({
      ...d,
      bailSigneImportNom: "",
      bailSigneDataUrl: "",
    }));
    setError(null);
  }

  async function copierLienBailVersPressePapiers() {
    const url = draft.urlBail.trim();
    if (!url) {
      setError(
        "Saisissez d’abord un lien dans le champ « Lien du bail signé »."
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setError(null);
      setBailUrlCopieMessage("Lien copié dans le presse-papiers.");
      window.setTimeout(() => setBailUrlCopieMessage(null), 2600);
    } catch {
      setError(
        "Copie impossible — autorisez le presse-papiers ou copiez le lien à la main."
      );
    }
  }

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const canPrev = tabIndex > 0;
  const canNext = tabIndex < TABS.length - 1;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const data = trimContrat(draft);
    const partieLabel =
      chainWizard && !contratIdAEditer && wizardStep === 3
        ? "sous-locataire"
        : "locataire principal";
    if (
      !data.logementId ||
      !data.locataireId ||
      !data.dateDebut ||
      !data.loyerHc.trim() ||
      !data.loyerChargesComprises.trim() ||
      !data.typeBail ||
      !data.periodicite
    ) {
      setError(
        `Renseignez au minimum : bien, ${partieLabel}, type de bail, périodicité du paiement, dates de début, loyer HC et loyer charges comprises (onglet « Bien loué »).`
      );
      setTab("bien");
      return;
    }
    if (data.depotGarantie.trim() === "") {
      setError(
        "Indiquez le dépôt de garantie (saisissez 0 si aucun) dans « Bien loué »."
      );
      setTab("bien");
      return;
    }
    const loc = locataires.find((l) => l.id === data.locataireId);
    if (!loc || !locataireEstRattacheAuLogement(loc, data.logementId)) {
      setError(
        "La partie choisie doit être cochée sur ce bien dans sa fiche locataire (« Biens concernés »)."
      );
      setTab("bien");
      return;
    }

    if (chainWizard && !contratIdAEditer) {
      if (wizardStep === 2) {
        if (categorieLocataireSurLogement(loc, data.logementId) !== "locataire") {
          setError(
            "Pour le bail principal, la fiche doit être « Locataire » sur ce bien (onglet locataire → rôle par bien)."
          );
          setTab("bien");
          return;
        }
        setError(null);
        const principal = addContratLocation(data);
        finance.resynchroniserMoisContrat(principal);
        chainePrincipalContratIdRef.current = principal.id;
        setChainePrincipalNom(nomCompletLocataire(loc));
        setDraft({
          ...emptyContrat(),
          logementId: data.logementId,
          locataireSousBailleurId: data.locataireId,
          locataireId: "",
        });
        setWizardStep(3);
        setTab("bien");
        setChainAck(true);
        return;
      }
      if (wizardStep === 3) {
        if (
          categorieLocataireSurLogement(loc, data.logementId) !== "sous-locataire"
        ) {
          setError(
            "Pour la sous-location, la fiche doit être « Sous-locataire » sur ce bien."
          );
          setTab("bien");
          return;
        }
        if (!data.locataireSousBailleurId.trim()) {
          setError(
            "Référence au locataire principal manquante. Fermez et relancez l’assistant."
          );
          return;
        }
        const principalId = chainePrincipalContratIdRef.current;
        if (!principalId) {
          setError(
            "Identifiant du bail principal perdu. Fermez et relancez l’assistant chaîne."
          );
          return;
        }
        setError(null);
        const sous = addContratLocation(data);
        finance.resynchroniserMoisContrat(sous);
        addChaineLocation({
          logementId: data.logementId,
          contratPrincipalId: principalId,
          contratSousLocataireId: sous.id,
        });
        chainePrincipalContratIdRef.current = null;
        closeDialog();
        return;
      }
    }

    setError(null);
    if (contratIdAEditer) {
      updateContratLocation(contratIdAEditer, data);
      finance.resynchroniserMoisContrat({
        ...data,
        id: contratIdAEditer,
      } as ContratLocation);
      closeDialog();
    } else {
      const nouveau = addContratLocation(data);
      finance.resynchroniserMoisContrat(nouveau);
      closeDialog();
    }
  }

  const isChainWizardActif = chainWizard && !contratIdAEditer;

  const fs = formStyles;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={handleDialogClose}
    >
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>
            {contratIdAEditer
              ? "Modifier la location"
              : isChainWizardActif && wizardStep === 1
                ? "Chaîne de locations — cadre du bien"
                : isChainWizardActif && wizardStep === 2
                  ? "Bail principal (bailleur → locataire)"
                  : isChainWizardActif && wizardStep === 3
                    ? "Sous-location (locataire → sous-locataire)"
                    : "Créer une location"}
          </h2>
          <p className={styles.subtitle}>
            {contratIdAEditer
              ? "Mettez à jour les intercalaires du bail : les mêmes sections qu’à la création."
              : isChainWizardActif && wizardStep === 1
                ? "Le même logement servira au bail avec le propriétaire puis au bail de sous-location. Vérifiez les fiches bailleur et locataires avant de poursuivre."
                : isChainWizardActif && wizardStep === 2
                  ? "Premier acte : entre le bailleur (figure sur la fiche logement) et le locataire principal. Créez les fiches dans les menus Bailleurs / Locataires si besoin."
                  : isChainWizardActif && wizardStep === 3
                    ? "Second acte : le locataire principal devient sous-bailleur. Indiquez le libellé commercial du local si besoin, puis le sous-locataire."
                    : "Renseignez les intercalaires : bien, compléments, quittances, garants, assurances et documents. Vous pouvez laisser des sections vides si elles ne s&apos;appliquent pas."}
          </p>
        </div>
        <button
          type="button"
          className={styles.btnClose}
          aria-label="Fermer"
          onClick={closeDialog}
        >
          ×
        </button>
      </div>

      {isChainWizardActif ? (
        <div className={styles.stepper} aria-label="Étapes de l’assistant">
          <span
            className={`${styles.stepperStep} ${wizardStep === 1 ? styles.stepperStepActive : ""}`}
          >
            <span className={styles.stepperNum} aria-hidden>
              1
            </span>
            Bien & bailleur
          </span>
          <span aria-hidden>→</span>
          <span
            className={`${styles.stepperStep} ${wizardStep === 2 ? styles.stepperStepActive : ""}`}
          >
            <span className={styles.stepperNum} aria-hidden>
              2
            </span>
            Bail principal
          </span>
          <span aria-hidden>→</span>
          <span
            className={`${styles.stepperStep} ${wizardStep === 3 ? styles.stepperStepActive : ""}`}
          >
            <span className={styles.stepperNum} aria-hidden>
              3
            </span>
            Sous-location
          </span>
        </div>
      ) : null}

      {isChainWizardActif && wizardStep === 1 ? (
        <div className={styles.wizardContext}>
          {error ? <p className={styles.errorBanner}>{error}</p> : null}
          <p className={styles.hint}>
            Sélectionnez le logement : le bailleur affiché est celui rattaché à la
            fiche bien (menu Logements). Les deux contrats porteront sur ce même
            bien ; seul le second peut avoir un nom d’exploitation / commercial
            distinct dans la liste des locations.
          </p>
          <label className={fs.field}>
            <span className={fs.label}>
              Logement <span className={fs.req}>*</span>
            </span>
            <select
              className={fs.select}
              value={wizardLogementId}
              onChange={(e) => setWizardLogementId(e.target.value)}
            >
              <option value="">Choisir un bien…</option>
              {logementsSorted.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.titre} — {l.ville} ({l.codePostal})
                </option>
              ))}
            </select>
          </label>

          <div className={styles.contextGrid}>
            <div className={styles.contextCard}>
              <h3>Bailleur</h3>
              {bailleurContexte ? (
                <>
                  <p>{bailleurContexte.nom}</p>
                  {bailleurContexte.typeOccupant === "personne_morale" ? (
                    <>
                      {bailleurContexte.formeJuridique.trim() ? (
                        <p className={styles.meta}>
                          {bailleurContexte.formeJuridique}
                        </p>
                      ) : null}
                      {bailleurContexte.siret.trim() ? (
                        <p className={styles.meta}>
                          SIRET {bailleurContexte.siret}
                        </p>
                      ) : null}
                      {ligneRepresentantLegalBailleur(bailleurContexte) ? (
                        <p className={styles.meta}>
                          Représentant :{" "}
                          {ligneRepresentantLegalBailleur(bailleurContexte)}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  {lignesAdresseBailleur(bailleurContexte).map((ln, i) => (
                    <p key={`${ln}-${i}`} className={styles.meta}>
                      {ln}
                    </p>
                  ))}
                  <p className={styles.meta}>
                    {[bailleurContexte.email, bailleurContexte.telephone]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </>
              ) : (
                <p className={styles.meta}>
                  {wizardLogementId
                    ? "Bailleur introuvable pour ce logement."
                    : "Choisissez un logement pour afficher le bailleur."}
                </p>
              )}
            </div>
            <div className={styles.contextCard}>
              <h3>Logement (référence interne)</h3>
              {logementContexte ? (
                <>
                  <p>{logementContexte.titre}</p>
                  <p className={styles.meta}>
                    {[logementContexte.adresse, logementContexte.codePostal]
                      .filter(Boolean)
                      .join(", ")}{" "}
                    {logementContexte.ville}
                  </p>
                  <p className={styles.meta}>
                    {logementContexte.typeBien}
                    {logementContexte.surfaceM2.trim()
                      ? ` · ${logementContexte.surfaceM2.trim()} m²`
                      : null}
                  </p>
                </>
              ) : (
                <p className={styles.meta}>—</p>
              )}
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={closeDialog}
            >
              Annuler
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={avancerVersBailPrincipal}
            >
              Continuer vers le bail principal
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.tabRow} role="tablist" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit}>
        <div className={styles.body}>
          {error ? <p className={styles.errorBanner}>{error}</p> : null}
          {chainAck && isChainWizardActif && wizardStep === 3 ? (
            <p className={styles.chainHint} role="status">
              Bail principal enregistré. Complétez la sous-location (même
              logement) ; le libellé d&apos;exploitation est facultatif mais
              recommandé pour un local commercial.
            </p>
          ) : null}

          {tab === "bien" ? (
            <BienLoueTabFields
              draft={draft}
              set={set}
              setDraft={setDraft}
              fs={fs}
              logementsSorted={logementsSorted}
              locatairesPourBien={locatairesPourBien}
              bienLoueContext={bienLoueContext}
              chaineSousBailleurNom={chainePrincipalNom}
            />
          ) : null}

          {tab === "bail" ? (
            <div className={styles.bailTab}>
              <aside className={styles.bailOfficialNotice} role="note">
                <strong>Ce n’est pas un bail réglementaire ni un modèle
                officiel.</strong> L’application ne peut pas reproduire à la
                place de l’administration les contrats types et mentions imposés
                par la loi (ils évoluent, et leur usage relève de votre
                responsabilité). Le PDF ci-dessous reste une{" "}
                <strong>synthèse</strong> à partir de vos données. Pour un acte
                conforme, téléchargez un modèle publié par les autorités ou
                l’ANIL, ou faites-vous accompagner (notaire, avocat,
                administrateur de biens…).
                <div className={styles.bailOfficialLinks}>
                  <a
                    href="https://www.anil.org/documentation-modeles-outils/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Documentation, modèles et outils (ANIL)
                  </a>
                  <a
                    href="https://www.service-public.gouv.fr/particuliers/vosdroits/F31228"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Location — informations &amp; obligations (service-public.fr)
                  </a>
                </div>
              </aside>
              <p className={styles.hint}>
                Ouvrez d’abord l’aperçu pour contrôler la mise en page (toutes
                les pages, typographie, zones de signature). Le téléchargement
                est proposé depuis la fenêtre d’aperçu. Joignez les diagnostics
                et annexes requis par la loi.
              </p>
              <div className={styles.bailSummary}>
                <div>
                  <span className={styles.bailSummaryLabel}>Type de bail</span>
                  <p className={styles.bailSummaryValue}>
                    {libelleTypeBailPourPdf(draft.typeBail)}
                    {!draft.typeBail.trim() ? (
                      <span className={styles.bailSummaryMissing}>
                        {" "}
                        — précisez-le dans « Bien loué »
                      </span>
                    ) : null}
                  </p>
                </div>
                {draft.locataireSousBailleurId.trim() ? (
                  <div>
                    <span className={styles.bailSummaryLabel}>Nature</span>
                    <p className={styles.bailSummaryValue}>
                      Projet de bail de sous-location
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className={styles.bailSummaryLabel}>Nature</span>
                    <p className={styles.bailSummaryValue}>
                      Projet de bail principal (bailleur → locataire)
                    </p>
                  </div>
                )}
              </div>
              <section
                className={styles.bailSignedSection}
                aria-label="Bail signé archivé"
              >
                <h4 className={styles.bailSignedHeading}>
                  Bail signé (document réel)
                </h4>
                <p className={styles.hintTiny}>
                  Conservez ici le contrat déjà signé :{" "}
                  <strong>lien</strong> vers le cloud, ou{" "}
                  <strong>fichier</strong> PDF / Word par glisser-déposer,
                  bouton « parcourir », ou copier le fichier puis{" "}
                  <strong>coller</strong> lorsque la zone ci-dessous est
                  sélectionnée (clic dedans puis Ctrl+V ou Cmd+V). Données
                  enregistrées dans le navigateur, taille max. environ 3,5 Mo
                  par fichier ; au-delà, utilisez seulement le lien.
                </p>
                <label className={fs.field}>
                  <span className={fs.label}>
                    Lien du bail signé (Drive, Dropbox…)
                  </span>
                  <input
                    className={fs.input}
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    value={draft.urlBail}
                    onChange={(e) => set("urlBail", e.target.value)}
                  />
                </label>
                <div className={styles.bailSignedRow}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => void copierLienBailVersPressePapiers()}
                  >
                    Copier le lien
                  </button>
                  {bailUrlCopieMessage ? (
                    <span className={styles.bailSignedOk}>
                      {bailUrlCopieMessage}
                    </span>
                  ) : null}
                </div>
                <input
                  ref={bailSigneFileInputRef}
                  type="file"
                  className={styles.srOnly}
                  tabIndex={-1}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    void appliquerFichierBailSigne(f);
                    e.target.value = "";
                  }}
                />
                <div
                  className={`${styles.bailSignedDropzone} ${
                    bailSigneZoneActive ? styles.bailSignedDropzoneActive : ""
                  }`}
                  tabIndex={0}
                  role="region"
                  aria-label="Déposer ou coller le fichier du bail signé"
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setBailSigneZoneActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setBailSigneZoneActive(true);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget === e.target) {
                      setBailSigneZoneActive(false);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setBailSigneZoneActive(false);
                    const f = e.dataTransfer.files?.[0];
                    void appliquerFichierBailSigne(f);
                  }}
                  onPaste={(e) => {
                    const f = e.clipboardData?.files?.[0];
                    if (f) {
                      e.preventDefault();
                      void appliquerFichierBailSigne(f);
                    }
                  }}
                >
                  <p className={styles.bailSignedDropzoneText}>
                    Déposez un fichier ici, ou{" "}
                    <button
                      type="button"
                      className={styles.bailSignedLinkBtn}
                      onClick={() => bailSigneFileInputRef.current?.click()}
                    >
                      parcourir
                    </button>
                    . Cliquez dans cette zone puis collez un fichier (Ctrl+V /
                    Cmd+V) si votre navigateur le permet.
                  </p>
                  {draft.bailSigneImportNom.trim() ? (
                    <div className={styles.bailSignedFileRow}>
                      <span className={styles.bailSignedFileName}>
                        {draft.bailSigneImportNom}
                      </span>
                      {draft.bailSigneDataUrl ? (
                        <a
                          className={styles.bailSignedLink}
                          href={draft.bailSigneDataUrl}
                          download={draft.bailSigneImportNom}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Télécharger / ouvrir
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={retirerBailSigne}
                      >
                        Retirer le fichier
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
              <div className={styles.bailActions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={ouvrirApercuProjetBail}
                >
                  Aperçu du projet de bail
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={telechargerProjetBailDepuisFiche}
                >
                  Télécharger sans aperçu
                </button>
              </div>
            </div>
          ) : null}

          {tab === "complement" ? (
            <>
              <p className={styles.hint}>
                Référence interne, indexation, clauses et remarques diverses.
              </p>
              <label className={fs.field}>
                <span className={fs.label}>N° contrat / référence interne</span>
                <input
                  className={fs.input}
                  value={draft.numeroContratInterne}
                  onChange={(e) =>
                    set("numeroContratInterne", e.target.value)
                  }
                />
              </label>
              <label className={fs.field}>
                <span className={fs.label}>Indexation (ILAT, ICC, aucune…)</span>
                <input
                  className={fs.input}
                  value={draft.indexation}
                  onChange={(e) => set("indexation", e.target.value)}
                  placeholder="ex. ICC annuel, pas d’indexation…"
                />
              </label>
              <label className={fs.field}>
                <span className={fs.label}>Clauses particulières</span>
                <textarea
                  className={fs.textarea}
                  {...FR_TEXTAREA_PROPS}
                  rows={3}
                  value={draft.clauseParticuliere}
                  onChange={(e) =>
                    set("clauseParticuliere", e.target.value)
                  }
                  placeholder="Travaux, préavis, mise à disposition…"
                />
              </label>
              <label className={fs.field}>
                <span className={fs.label}>Informations complémentaires</span>
                <textarea
                  className={fs.textarea}
                  {...FR_TEXTAREA_PROPS}
                  rows={4}
                  value={draft.infosComplementaires}
                  onChange={(e) =>
                    set("infosComplementaires", e.target.value)
                  }
                  placeholder="État d’usage, inventaire, charges récupérables, etc."
                />
              </label>
            </>
          ) : null}

          {tab === "quittances" ? (
            <>
              <p className={styles.hint}>
                Fréquence et modalité d’envoi des quittances de loyer ou
                loyers reçus.
              </p>
              <div className={fs.grid2}>
                <label className={fs.field}>
                  <span className={fs.label}>Fréquence des quittances</span>
                  <select
                    className={fs.select}
                    value={draft.frequenceQuittance}
                    onChange={(e) =>
                      set(
                        "frequenceQuittance",
                        e.target.value as ContratLocation["frequenceQuittance"]
                      )
                    }
                  >
                    <option value="">—</option>
                    <option value="mensuelle">Mensuelle</option>
                    <option value="trimestrielle">Trimestrielle</option>
                  </select>
                </label>
                <label className={fs.field}>
                  <span className={fs.label}>Envoi des quittances</span>
                  <select
                    className={fs.select}
                    value={draft.modeEnvoiQuittance}
                    onChange={(e) =>
                      set(
                        "modeEnvoiQuittance",
                        e.target.value as ContratLocation["modeEnvoiQuittance"]
                      )
                    }
                  >
                    <option value="">—</option>
                    <option value="email">E-mail</option>
                    <option value="courrier">Courrier</option>
                    <option value="les_deux">Les deux</option>
                  </select>
                </label>
              </div>
            </>
          ) : null}

          {tab === "garants" ? (
            <>
              <p className={styles.hint}>
                Cautionnement, garants personnels ou organismes (Visale, GLI,
                GarantMe…). Le dépôt de garantie peut déjà être renseigné dans
                l’onglet « Bien loué » ; utilisez le champ ci-dessous pour un
                rappel ou une précision.
              </p>
              <label className={fs.field}>
                <span className={fs.label}>
                  Montant de la caution / dépôt (rappel ou complément)
                </span>
                <input
                  className={fs.input}
                  inputMode="decimal"
                  value={draft.montantCaution}
                  onChange={(e) => set("montantCaution", e.target.value)}
                  placeholder="€ (facultatif si déjà indiqué sur le bien loué)"
                />
              </label>
              <label className={fs.field}>
                <span className={fs.label}>Garants (noms et qualités)</span>
                <textarea
                  className={fs.textarea}
                  {...FR_TEXTAREA_PROPS}
                  rows={3}
                  value={draft.nomsGarants}
                  onChange={(e) => set("nomsGarants", e.target.value)}
                  placeholder="M. X… solidaire, Mme Y…"
                />
              </label>
              <div className={fs.grid2}>
                <label className={fs.field}>
                  <span className={fs.label}>
                    Organisme de garantie (Visale, GarantMe…)
                  </span>
                  <input
                    className={fs.input}
                    value={draft.organismeGarantie}
                    onChange={(e) =>
                      set("organismeGarantie", e.target.value)
                    }
                  />
                </label>
                <label className={fs.field}>
                  <span className={fs.label}>Référence garantie</span>
                  <input
                    className={fs.input}
                    value={draft.refGarantie}
                    onChange={(e) => set("refGarantie", e.target.value)}
                  />
                </label>
              </div>
            </>
          ) : null}

          {tab === "assurances" ? (
            <>
              <p className={styles.hint}>
                Assurance loyer impayé, multirisque habitation ou
                professionnelle selon le bail.
              </p>
              <div className={fs.grid2}>
                <label className={fs.field}>
                  <span className={fs.label}>Assurance loyer impayé</span>
                  <select
                    className={fs.select}
                    value={draft.assuranceLoyerImpaye}
                    onChange={(e) =>
                      set(
                        "assuranceLoyerImpaye",
                        e.target.value as ContratLocation["assuranceLoyerImpaye"]
                      )
                    }
                  >
                    <option value="">—</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </label>
                <label className={fs.field}>
                  <span className={fs.label}>Multirisque habitation (locataire)</span>
                  <select
                    className={fs.select}
                    value={draft.multirisqueHabitation}
                    onChange={(e) =>
                      set(
                        "multirisqueHabitation",
                        e.target.value as ContratLocation["multirisqueHabitation"]
                      )
                    }
                  >
                    <option value="">—</option>
                    <option value="oui">Souscrite</option>
                    <option value="non">Non / N/A</option>
                  </select>
                </label>
              </div>
              <label className={fs.field}>
                <span className={fs.label}>Assureur</span>
                <input
                  className={fs.input}
                  value={draft.assureur}
                  onChange={(e) => set("assureur", e.target.value)}
                />
              </label>
              <div className={fs.grid2}>
                <label className={fs.field}>
                  <span className={fs.label}>N° police / contrat</span>
                  <input
                    className={fs.input}
                    value={draft.numeroPolice}
                    onChange={(e) => set("numeroPolice", e.target.value)}
                  />
                </label>
                <label className={fs.field}>
                  <span className={fs.label}>Date d’échéance</span>
                  <input
                    className={fs.input}
                    type="date"
                    value={draft.dateEcheanceAssurance}
                    onChange={(e) =>
                      set("dateEcheanceAssurance", e.target.value)
                    }
                  />
                </label>
              </div>
              <label className={fs.field}>
                <span className={fs.label}>Notes assurances</span>
                <textarea
                  className={fs.textarea}
                  {...FR_TEXTAREA_PROPS}
                  rows={3}
                  value={draft.notesAssurance}
                  onChange={(e) => set("notesAssurance", e.target.value)}
                />
              </label>
            </>
          ) : null}

          {tab === "documents" ? (
            <>
              <p className={styles.hint}>
                Liens vers le bail signé, état des lieux, avenants ou tout
                fichier hébergé (URL).
              </p>
              <label className={fs.field}>
                <span className={fs.label}>Bail / contrat de location (URL)</span>
                <input
                  className={fs.input}
                  type="url"
                  value={draft.urlBail}
                  onChange={(e) => set("urlBail", e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label className={fs.field}>
                <span className={fs.label}>État des lieux (URL)</span>
                <input
                  className={fs.input}
                  type="url"
                  value={draft.urlEtatDesLieux}
                  onChange={(e) => set("urlEtatDesLieux", e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label className={fs.field}>
                <span className={fs.label}>
                  État des lieux — texte à compléter dans l’app
                </span>
                <textarea
                  className={fs.textarea}
                  {...FR_TEXTAREA_PROPS}
                  rows={5}
                  value={draft.etatDesLieuxRempli}
                  onChange={(e) =>
                    set("etatDesLieuxRempli", e.target.value)
                  }
                  placeholder="Pièces, compteurs, réserves… (reproduit dans le PDF « projet EDL » lors de la création de la chaîne.)"
                />
              </label>
              <label className={fs.field}>
                <span className={fs.label}>
                  Importer un fichier (nom conservé, sans stocker le fichier)
                </span>
                <input
                  className={fs.input}
                  type="file"
                  accept=".pdf,.txt,.png,.jpg,.jpeg,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    set(
                      "etatDesLieuxImportNom",
                      f ? f.name : ""
                    );
                  }}
                />
                {draft.etatDesLieuxImportNom.trim() ? (
                  <span className={styles.hint}>
                    Référence fichier :{" "}
                    <strong>{draft.etatDesLieuxImportNom}</strong> — conserve l’original
                    sur ton disque ; l’app enregistre seulement le nom.
                  </span>
                ) : null}
              </label>
              <label className={fs.field}>
                <span className={fs.label}>
                  Autres documents (une URL par ligne ou texte libre)
                </span>
                <textarea
                  className={fs.textarea}
                  {...FR_TEXTAREA_PROPS}
                  rows={4}
                  value={draft.autresDocuments}
                  onChange={(e) =>
                    set("autresDocuments", e.target.value)
                  }
                  placeholder="Avenant 1 — https://…"
                />
              </label>
            </>
          ) : null}
        </div>

        <div className={styles.footer}>
          <div className={styles.navBtns}>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={!canPrev}
              onClick={() => setTab(TABS[tabIndex - 1].id)}
            >
              Précédent
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={!canNext}
              onClick={() => setTab(TABS[tabIndex + 1].id)}
            >
              Suivant
            </button>
          </div>
          <div className={styles.navBtns}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={closeDialog}
            >
              Annuler
            </button>
            <button type="submit" className={styles.btnPrimary}>
              {contratIdAEditer
                ? "Enregistrer les modifications"
                : isChainWizardActif && wizardStep === 2
                  ? "Enregistrer le bail principal et passer à la sous-location"
                  : isChainWizardActif && wizardStep === 3
                    ? "Enregistrer la sous-location et terminer"
                    : "Enregistrer la location"}
            </button>
          </div>
        </div>
      </form>
        </>
      )}
      <PdfPreviewDialog
        open={apercuBailPdf !== null}
        apercu={apercuBailPdf}
        onClose={fermerApercuBail}
      />
    </dialog>
  );
}
