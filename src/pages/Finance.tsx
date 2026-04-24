import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PageFrame } from "../components/PageFrame";
import {
  PdfPreviewDialog,
  type PdfApercu,
} from "../components/PdfPreviewDialog";
import { useBiens } from "../context/BiensContext";
import { useFinance } from "../context/FinanceContext";
import { useThemeSettings } from "../context/ThemeSettingsContext";
import type { ContratLocation } from "../types/domain";
import { nomCompletLocataire } from "../lib/locataireUi";
import { formatEuro, parseEuro } from "../lib/money";
import { contratUtiliseSaisieTva } from "../lib/loyerTvaContrat";
import {
  calculerSuiteMois,
  listeMoisPourContrat,
  moisCleCourant,
  type MoisComputed,
  type StatutMoisUi,
} from "../lib/moisFinance";
import {
  buildDocumentMoisPdf,
  type TypeDocumentMois,
} from "../lib/pdfLocatif";
import styles from "./Finance.module.css";

function totalPaiementsContrat(
  c: ContratLocation,
  lister: (x: ContratLocation) => import("../context/financeStorage").MoisFinanceContrat[]
): number {
  return lister(c).reduce(
    (acc, m) =>
      acc +
      m.paiements.reduce((s, p) => s + parseEuro(p.montant), 0),
    0
  );
}

/** Montant au format saisi dans l’app (virgule décimale), compatible avec parseEuro. */
function montantPourSaisiePaiement(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toFixed(2).replace(".", ",");
}

function derniereDatePaiementMois(
  data: import("../context/financeStorage").MoisFinanceContrat
): string | undefined {
  if (!data.paiements.length) return undefined;
  const dates = data.paiements
    .map((p) => p.date)
    .filter((d) => d && d.length >= 10);
  if (!dates.length) return undefined;
  return [...dates].sort((a, b) => b.localeCompare(a))[0];
}

function titreApercuDocumentMois(type: TypeDocumentMois): string {
  switch (type) {
    case "quittance":
      return "Aperçu — Quittance";
    case "avis_echeance":
      return "Aperçu — Avis d'échéance";
    default:
      return "Aperçu — Avis de solde";
  }
}

function libelleStatut(s: StatutMoisUi): string {
  switch (s) {
    case "paye":
      return "Payé";
    case "en_retard":
      return "En retard";
    case "annule":
      return "Annulé";
    default:
      return "En cours";
  }
}

function celluleTvaSurPaye(
  contrat: ContratLocation,
  row: MoisComputed
): string {
  if (!contratUtiliseSaisieTva(contrat)) return "—";
  if (row.statut === "annule") return "—";
  if (row.totalPaye <= 0.005) return "—";
  return formatEuro(row.tvaSurPaye);
}

function classStatut(s: StatutMoisUi): string {
  switch (s) {
    case "paye":
      return `${styles.statut} ${styles.statutPaye}`;
    case "en_retard":
      return `${styles.statut} ${styles.statutRetard}`;
    case "annule":
      return `${styles.statut} ${styles.statutAnnule}`;
    default:
      return `${styles.statut} ${styles.statutAPayer}`;
  }
}

/** Repère une modification du bail pour fermer un aperçu PDF obsolète. */
function signatureContratPourFinancePdf(c: ContratLocation): string {
  return JSON.stringify({
    id: c.id,
    dateDebut: c.dateDebut,
    dateFin: c.dateFin,
    loyerHc: c.loyerHc,
    charges: c.charges,
    loyerChargesComprises: c.loyerChargesComprises,
    depotGarantie: c.depotGarantie,
    loyerHcTva: c.loyerHcTva,
    chargesTva: c.chargesTva,
    premierLoyerProrata: c.premierLoyerProrata,
    premierLoyerHcCalcule: c.premierLoyerHcCalcule,
    premierLoyerChargesCalcule: c.premierLoyerChargesCalcule,
    locataireId: c.locataireId,
    logementId: c.logementId,
    locataireSousBailleurId: c.locataireSousBailleurId,
    typeChargesLoyer: c.typeChargesLoyer,
  });
}

export function Finance() {
  const {
    contratsLocation,
    locataires,
    getLogement,
    getBailleur,
    chainesLocation,
  } = useBiens();
  const finance = useFinance();
  const { settings } = useThemeSettings();

  const [selectionContratId, setSelectionContratId] = useState<string | null>(
    null
  );
  const [moisOuvertId, setMoisOuvertId] = useState<string | null>(null);
  /** Clé `${contratId}\t${moisCle}` — date utilisée par « Payer » sans ouvrir le détail. */
  const [datePaiementRapide, setDatePaiementRapide] = useState<
    Record<string, string>
  >({});
  const [apercuPdf, setApercuPdf] = useState<PdfApercu | null>(null);
  const apercuPdfRef = useRef<PdfApercu | null>(null);
  apercuPdfRef.current = apercuPdf;

  useEffect(() => {
    return () => {
      const p = apercuPdfRef.current;
      if (p?.blobUrl) URL.revokeObjectURL(p.blobUrl);
    };
  }, []);

  const contratsIdsEnChaine = useMemo(() => {
    const s = new Set<string>();
    for (const ch of chainesLocation) {
      s.add(ch.contratPrincipalId);
      s.add(ch.contratSousLocataireId);
    }
    return s;
  }, [chainesLocation]);

  const contratsOrphelins = useMemo(
    () => contratsLocation.filter((c) => !contratsIdsEnChaine.has(c.id)),
    [contratsLocation, contratsIdsEnChaine]
  );

  const chainePourBenefice = useMemo(() => {
    const locId = finance.locataireReferenceBeneficeId;
    if (!locId) return null;

    const sousContrat = contratsLocation.find(
      (c) =>
        c.locataireId === locId && c.locataireSousBailleurId.trim().length > 0
    );
    if (sousContrat) {
      const ch = chainesLocation.find(
        (x) => x.contratSousLocataireId === sousContrat.id
      );
      if (!ch) return null;
      const principal = contratsLocation.find(
        (c) => c.id === ch.contratPrincipalId
      );
      return { ch, principal, sous: sousContrat };
    }

    const principalContrat = contratsLocation.find(
      (c) =>
        c.locataireId === locId && c.locataireSousBailleurId.trim().length === 0
    );
    if (principalContrat) {
      const ch = chainesLocation.find(
        (x) => x.contratPrincipalId === principalContrat.id
      );
      if (!ch) return null;
      const sous = contratsLocation.find(
        (c) => c.id === ch.contratSousLocataireId
      );
      if (!sous) return null;
      return { ch, principal: principalContrat, sous };
    }

    return null;
  }, [
    finance.locataireReferenceBeneficeId,
    contratsLocation,
    chainesLocation,
  ]);

  const totalRecu = chainePourBenefice
    ? totalPaiementsContrat(chainePourBenefice.sous, finance.listerMoisContrat)
    : 0;
  const totalSorties = chainePourBenefice?.principal
    ? totalPaiementsContrat(chainePourBenefice.principal, finance.listerMoisContrat)
    : 0;
  const beneficeNet = totalRecu - totalSorties;

  const contratActif =
    selectionContratId &&
    contratsLocation.find((c) => c.id === selectionContratId);

  const moisCourantCle = moisCleCourant();
  const moisRows = contratActif ? finance.listerMoisContrat(contratActif) : [];
  const verseDepotCumul = contratActif
    ? parseEuro(finance.depotParContrat[contratActif.id]?.montantVerse ?? "0")
    : 0;
  const moisCles = useMemo(() => {
    if (!contratActif) return [];
    return listeMoisPourContrat(contratActif).filter(
      (m) => m <= moisCourantCle
    );
  }, [contratActif, moisCourantCle]);
  const moisCalc: MoisComputed[] =
    contratActif && moisCles.length
      ? calculerSuiteMois(contratActif, moisCles, moisRows, verseDepotCumul)
      : [];
  const depotAttenduActif = contratActif
    ? parseEuro(contratActif.depotGarantie)
    : 0;
  const afficherLigneDepot =
    Boolean(contratActif) && depotAttenduActif > 0.005;
  const depotRestantActif = Math.max(0, depotAttenduActif - verseDepotCumul);
  const dateDernierVersementDepot =
    contratActif && finance.depotParContrat[contratActif.id]?.dateDerniere
      ? finance.depotParContrat[contratActif.id]!.dateDerniere
      : "";
  /** Affichage : mois les plus récents en haut (le calcul des reports reste chronologique). */
  const moisCalcAffiche = useMemo(
    () => [...moisCalc].reverse(),
    [moisCalc],
  );

  useEffect(() => {
    if (
      moisOuvertId &&
      !moisCalc.some((r) => r.moisCle === moisOuvertId)
    ) {
      setMoisOuvertId(null);
    }
  }, [moisOuvertId, moisCalc]);

  const locataireContrat = contratActif
    ? locataires.find((l) => l.id === contratActif.locataireId)
    : undefined;

  function getMoisData(moisCle: string) {
    const found = moisRows.find((m) => m.moisCle === moisCle);
    if (!found) {
      throw new Error(`Mois ${moisCle} introuvable pour le contrat.`);
    }
    return found;
  }

  const aujourdhuiIso = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  function cleDateRapide(contratId: string, moisCle: string) {
    return `${contratId}\t${moisCle}`;
  }

  function datePaiementPourAction(contratId: string, moisCle: string) {
    const k = cleDateRapide(contratId, moisCle);
    const v = datePaiementRapide[k]?.trim();
    if (v && v.length >= 10) return v.slice(0, 10);
    return aujourdhuiIso;
  }

  function saisirVersementDepotPartiel() {
    if (!contratActif) return;
    const raw = window.prompt("Montant du versement sur le dépôt (€)", "");
    if (raw === null) return;
    const n = parseEuro(String(raw).trim());
    if (!Number.isFinite(n) || n <= 0) return;
    finance.ajouterVersementDepot(
      contratActif.id,
      n,
      aujourdhuiIso
    );
  }

  function annulerPaiementsMois(moisCle: string) {
    if (!contratActif) return;
    const data = getMoisData(moisCle);
    const n = data.paiements.length;
    if (n === 0) return;
    if (
      !window.confirm(
        `Retirer ${n} paiement${n > 1 ? "s" : ""} enregistré${n > 1 ? "s" : ""} pour ${moisCle} ? Le solde du mois sera recalculé.`,
      )
    ) {
      return;
    }
    for (const p of [...data.paiements]) {
      finance.removePaiementMois(contratActif.id, moisCle, p.id);
    }
  }

  function openMois(moisCle: string | null) {
    setMoisOuvertId(moisCle);
  }

  function fermerApercuPdf() {
    setApercuPdf((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  }

  const contratFinanceSigRef = useRef<string>("");
  const finSigContrat = contratActif
    ? signatureContratPourFinancePdf(contratActif)
    : "";
  useEffect(() => {
    if (!contratActif) {
      contratFinanceSigRef.current = "";
      return;
    }
    if (
      contratFinanceSigRef.current &&
      contratFinanceSigRef.current !== finSigContrat
    ) {
      setApercuPdf((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return null;
      });
    }
    contratFinanceSigRef.current = finSigContrat;
  }, [contratActif, finSigContrat]);

  function ouvrirApercuPdfMois(
    type: TypeDocumentMois,
    row: MoisComputed,
    data: import("../context/financeStorage").MoisFinanceContrat
  ) {
    if (!contratActif || !locataireContrat) return;
    const logementPdf = getLogement(contratActif.logementId);
    const bailleurPdf = logementPdf
      ? getBailleur(logementPdf.bailleurId)
      : undefined;
    const sousBailleurPdf = contratActif.locataireSousBailleurId.trim()
      ? locataires.find(
          (l) => l.id === contratActif.locataireSousBailleurId
        )
      : undefined;
    const opts = {
      type,
      contrat: contratActif,
      logement: logementPdf,
      locataire: locataireContrat,
      bailleur: bailleurPdf,
      sousBailleur: sousBailleurPdf,
      moisCle: row.moisCle,
      montantDu: row.totalDu,
      montantPaye: row.totalPaye,
      solde: row.solde,
      observations: data.observationsDocuments,
      dateVersement: derniereDatePaiementMois(data),
      reportEntrant: row.reportEntrant,
      totalFraisMois: row.totalFrais,
      tvaSurMontantPaye: row.tvaSurPaye,
      emetteurDocuments: settings.emetteurDocumentsPdf,
      logoDocumentsPdf: settings.logoDocumentsPdf,
    };
    const { doc, fileName } = buildDocumentMoisPdf(opts);
    const blobUrl = URL.createObjectURL(doc.output("blob"));
    setApercuPdf((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return {
        blobUrl,
        fileName,
        title: titreApercuDocumentMois(type),
      };
    });
  }

  return (
    <>
    <PageFrame title="Finance" actions={null}>
      <div className={styles.pageInner}>
        <p className={styles.intro}>
          Vue synthèse des chaînes propriétaire → ta société → sous-locataire :
          encaissements, reports de loyer, frais et exports PDF (quittance, avis
          d’échéance, avis de solde) avec aperçu avant téléchargement. Les données
          sont stockées localement dans ce navigateur.
        </p>

        <section className={styles.beneficeCard} aria-label="Bénéfice société">
          <h2 className={styles.beneficeTitle}>
            Bénéfice (sous-location vs bail principal)
          </h2>
          <p className={styles.intro} style={{ marginBottom: 0 }}>
            Choisis un locataire de référence (locataire au bail principal ou
            sous-locataire) : on retrouve automatiquement la chaîne pour comparer
            les montants encaissés en sous-location et les montants versés au
            propriétaire (paiements saisis sur chaque ligne).
          </p>
          <div className={styles.beneficeRow}>
            <label htmlFor="ref-loc">Locataire de référence</label>
            <select
              id="ref-loc"
              value={finance.locataireReferenceBeneficeId}
              onChange={(e) =>
                finance.setLocataireReferenceBeneficeId(e.target.value)
              }
            >
              <option value="">— Choisir —</option>
              {locataires.map((l) => (
                <option key={l.id} value={l.id}>
                  {nomCompletLocataire(l)}
                </option>
              ))}
            </select>
          </div>
          {chainePourBenefice && chainePourBenefice.principal ? (
            <div className={styles.beneficeGrid}>
              <div className={styles.beneficeKpi}>
                <span>Encaissements (sous-location)</span>
                <strong>{formatEuro(totalRecu)}</strong>
              </div>
              <div className={styles.beneficeKpi}>
                <span>Paiements enregistrés (bail principal)</span>
                <strong>{formatEuro(totalSorties)}</strong>
              </div>
              <div className={styles.beneficeKpi}>
                <span>Écart (indicatif)</span>
                <strong>{formatEuro(beneficeNet)}</strong>
              </div>
            </div>
          ) : finance.locataireReferenceBeneficeId ? (
            <p className={styles.empty}>
              Aucune chaîne (bail principal + sous-location) trouvée pour ce
              locataire : il doit être le locataire de l’un des deux baux d’une
              chaîne créée via « Créer une chaîne de location ».
            </p>
          ) : null}
        </section>

        <div className={styles.layout}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Locations &amp; sous-locations</h2>
            <div className={styles.tree}>
              {chainesLocation.length === 0 && contratsOrphelins.length === 0 ? (
                <p className={styles.empty}>
                  Aucun bail enregistré. Crée une location depuis le menu
                  « Location ».
                </p>
              ) : null}

              {chainesLocation.map((ch) => {
                const logement = getLogement(ch.logementId);
                const cp = contratsLocation.find(
                  (c) => c.id === ch.contratPrincipalId
                );
                const cs = contratsLocation.find(
                  (c) => c.id === ch.contratSousLocataireId
                );
                const lp = cp
                  ? locataires.find((l) => l.id === cp.locataireId)
                  : undefined;
                const ls = cs
                  ? locataires.find((l) => l.id === cs.locataireId)
                  : undefined;
                return (
                  <div key={ch.id} className={styles.chaineBlock}>
                    <div className={styles.chaineHead}>
                      Chaîne — {logement?.titre ?? "Bien"}
                    </div>
                    {cp ? (
                      <button
                        type="button"
                        className={`${styles.rowBtn} ${
                          selectionContratId === cp.id ? styles.rowBtnActive : ""
                        }`}
                        onClick={() => {
                          setSelectionContratId(cp.id);
                          openMois(null);
                        }}
                      >
                        Location principale
                        <span className={`${styles.badge} ${styles.badgePrincipal}`}>
                          bailleur → toi
                        </span>
                        <div className={styles.rowSub}>
                          {lp ? nomCompletLocataire(lp) : "—"} (locataire côté
                          propriétaire)
                        </div>
                      </button>
                    ) : (
                      <p className={styles.chaineHint}>Bail principal manquant.</p>
                    )}
                    {cs ? (
                      <button
                        type="button"
                        className={`${styles.rowBtn} ${
                          selectionContratId === cs.id ? styles.rowBtnActive : ""
                        }`}
                        onClick={() => {
                          setSelectionContratId(cs.id);
                          openMois(null);
                        }}
                      >
                        Sous-location
                        <span className={`${styles.badge} ${styles.badgeSous}`}>
                          toi → sous-loc
                        </span>
                        <div className={styles.rowSub}>
                          {ls ? nomCompletLocataire(ls) : "—"}
                        </div>
                      </button>
                    ) : (
                      <p className={styles.chaineHint}>Sous-location manquante.</p>
                    )}
                  </div>
                );
              })}

              {contratsOrphelins.map((c) => {
                const logement = getLogement(c.logementId);
                const loc = locataires.find((l) => l.id === c.locataireId);
                return (
                  <div key={c.id} className={styles.chaineBlock}>
                    <button
                      type="button"
                      className={`${styles.rowBtn} ${
                        selectionContratId === c.id ? styles.rowBtnActive : ""
                      }`}
                      onClick={() => {
                        setSelectionContratId(c.id);
                        openMois(null);
                      }}
                    >
                      {logement?.titre ?? "Bail isolé"}
                      <div className={styles.rowSub}>
                        {loc ? nomCompletLocataire(loc) : "—"} ·{" "}
                        {c.locataireSousBailleurId.trim()
                          ? "sous-location (hors chaîne enregistrée)"
                          : "bail simple"}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.panel}>
            {!contratActif ? (
              <p className={styles.empty}>
                Sélectionne une ligne à gauche pour afficher le détail mensuel,
                les paiements, les frais et les exports PDF.
              </p>
            ) : (
              <>
                <div className={styles.detailHead}>
                  <h3>
                    {getLogement(contratActif.logementId)?.titre ?? "Bien"}
                  </h3>
                  <p>
                    Occupant au bail :{" "}
                    {locataireContrat
                      ? nomCompletLocataire(locataireContrat)
                      : "—"}
                    {" · "}
                    Loyer CC de référence :{" "}
                    {formatEuro(parseEuro(contratActif.loyerChargesComprises))}
                    {depotAttenduActif > 0.005 ? (
                      <>
                        {" · "}
                        Dépôt de garantie (bail) :{" "}
                        {formatEuro(depotAttenduActif)}
                        {depotRestantActif > 0.005
                          ? ` — reste ${formatEuro(depotRestantActif)}`
                          : " — soldé"}
                      </>
                    ) : null}
                  </p>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Mois</th>
                        <th>Stat</th>
                        <th>Dû</th>
                        <th>Payé</th>
                        <th title="TVA loyer estimée sur le montant payé (taux du bail)">
                          TVA payée
                        </th>
                        <th>Solde</th>
                        <th>Date paiement</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {afficherLigneDepot ? (
                        <tr key="__depot_garantie__">
                          <td>
                            <strong>Dépôt de garantie</strong>
                          </td>
                          <td
                            className={classStatut(
                              depotRestantActif <= 0.005 ? "paye" : "a_payer"
                            )}
                          >
                            {depotRestantActif <= 0.005 ? "Payé" : "En attente"}
                          </td>
                          <td>{formatEuro(depotAttenduActif)}</td>
                          <td>{formatEuro(verseDepotCumul)}</td>
                          <td className={styles.cellTvaPaye}>—</td>
                          <td>{formatEuro(depotRestantActif)}</td>
                          <td className={styles.datePaiementCell}>
                            {dateDernierVersementDepot.length >= 10 ? (
                              <span className={styles.datePaiementLu}>
                                {`${dateDernierVersementDepot.slice(8, 10)}/${dateDernierVersementDepot.slice(5, 7)}/${dateDernierVersementDepot.slice(0, 4)}`}
                              </span>
                            ) : (
                              <span className={styles.datePaiementDash}>—</span>
                            )}
                          </td>
                          <td>
                            <div className={styles.monthActions}>
                              {depotRestantActif > 0.005 ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      finance.marquerDepotVerseComplet(
                                        contratActif.id
                                      )
                                    }
                                  >
                                    Marquer payé (total)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saisirVersementDepotPartiel}
                                  >
                                    + Versement
                                  </button>
                                </>
                              ) : null}
                              {verseDepotCumul > 0.005 ? (
                                <button
                                  type="button"
                                  className={styles.btnAnnulerPaiement}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Réinitialiser le suivi des versements sur le dépôt ?"
                                      )
                                    ) {
                                      finance.reinitialiserSuiviDepot(
                                        contratActif.id
                                      );
                                    }
                                  }}
                                >
                                  Réinit. dépôt
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {moisCalcAffiche.map((row) => {
                        const data = getMoisData(row.moisCle);
                        const ouvert = moisOuvertId === row.moisCle;
                        const kDate = cleDateRapide(contratActif.id, row.moisCle);
                        const derniere = derniereDatePaiementMois(data);
                        return (
                          <Fragment key={row.moisCle}>
                            <tr>
                              <td>{row.moisCle}</td>
                              <td className={classStatut(row.statut)}>
                                {libelleStatut(row.statut)}
                              </td>
                              <td>{formatEuro(row.totalDu)}</td>
                              <td>{formatEuro(row.totalPaye)}</td>
                              <td className={styles.cellTvaPaye}>
                                {celluleTvaSurPaye(contratActif, row)}
                              </td>
                              <td>{formatEuro(row.solde)}</td>
                              <td className={styles.datePaiementCell}>
                                {row.statut === "annule" ? (
                                  <span className={styles.datePaiementDash}>
                                    —
                                  </span>
                                ) : row.solde > 0.005 ? (
                                  <input
                                    type="date"
                                    className={styles.datePaiementInput}
                                    value={
                                      datePaiementRapide[kDate] ?? aujourdhuiIso
                                    }
                                    onChange={(e) =>
                                      setDatePaiementRapide((prev) => ({
                                        ...prev,
                                        [kDate]: e.target.value,
                                      }))
                                    }
                                    aria-label={`Date de paiement pour ${row.moisCle}`}
                                  />
                                ) : derniere ? (
                                  <span
                                    className={styles.datePaiementLu}
                                    title="Dernière date enregistrée sur un paiement de ce mois"
                                  >
                                    {derniere.length >= 10
                                      ? `${derniere.slice(8, 10)}/${derniere.slice(5, 7)}/${derniere.slice(0, 4)}`
                                      : derniere}
                                  </span>
                                ) : (
                                  <span className={styles.datePaiementDash}>
                                    —
                                  </span>
                                )}
                              </td>
                              <td>
                                <div className={styles.monthActions}>
                                  <button
                                    type="button"
                                    disabled={
                                      row.statut === "annule" ||
                                      row.solde <= 0.005
                                    }
                                    onClick={() => {
                                      if (row.solde <= 0.005) return;
                                      finance.addPaiementMois(
                                        contratActif.id,
                                        row.moisCle,
                                        {
                                          date: datePaiementPourAction(
                                            contratActif.id,
                                            row.moisCle,
                                          ),
                                          montant: montantPourSaisiePaiement(
                                            row.solde
                                          ),
                                          note: "Solde",
                                        }
                                      );
                                    }}
                                  >
                                    Payer
                                  </button>
                                  {row.statut !== "annule" &&
                                  row.totalPaye > 0.005 ? (
                                    <button
                                      type="button"
                                      className={styles.btnAnnulerPaiement}
                                      onClick={() =>
                                        annulerPaiementsMois(row.moisCle)
                                      }
                                    >
                                      Annuler paiement
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openMois(ouvert ? null : row.moisCle)
                                    }
                                  >
                                    {ouvert ? "Fermer" : "Détail"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      ouvrirApercuPdfMois("quittance", row, data)
                                    }
                                    disabled={!locataireContrat}
                                  >
                                    Quittance
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      ouvrirApercuPdfMois("avis_echeance", row, data)
                                    }
                                    disabled={!locataireContrat}
                                  >
                                    Avis échéance
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      ouvrirApercuPdfMois("avis_paiement", row, data)
                                    }
                                    disabled={!locataireContrat}
                                  >
                                    Avis solde
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {ouvert ? (
                              <tr key={`${row.moisCle}-detail`}>
                                <td colSpan={8}>
                                  <MoisDetailPanel
                                    key={row.moisCle}
                                    data={data}
                                    computed={row}
                                    typesFrais={finance.typesFrais}
                                    onToggleAnnulerReport={(v) =>
                                      finance.upsertMoisRow(contratActif.id, {
                                        ...data,
                                        annulerReportVersSuivant: v,
                                      })
                                    }
                                    onToggleAnnule={(v) =>
                                      finance.upsertMoisRow(contratActif.id, {
                                        ...data,
                                        statutOverride: v ? "annule" : "",
                                      })
                                    }
                                    onSaveObservations={(text) =>
                                      finance.upsertMoisRow(contratActif.id, {
                                        ...data,
                                        observationsDocuments: text,
                                      })
                                    }
                                    onAddPaiement={(ligne) =>
                                      finance.addPaiementMois(
                                        contratActif.id,
                                        row.moisCle,
                                        ligne
                                      )
                                    }
                                    onAddFrais={(ligne) =>
                                      finance.addFraisMois(
                                        contratActif.id,
                                        row.moisCle,
                                        ligne
                                      )
                                    }
                                    onRemovePaiement={(id) =>
                                      finance.removePaiementMois(
                                        contratActif.id,
                                        row.moisCle,
                                        id
                                      )
                                    }
                                    onRemoveFrais={(id) =>
                                      finance.removeFraisMois(
                                        contratActif.id,
                                        row.moisCle,
                                        id
                                      )
                                    }
                                  />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageFrame>
    <PdfPreviewDialog
      open={apercuPdf !== null}
      apercu={apercuPdf}
      onClose={fermerApercuPdf}
    />
    </>
  );
}

function MoisDetailPanel(props: {
  data: import("../context/financeStorage").MoisFinanceContrat;
  computed: MoisComputed;
  typesFrais: string[];
  onToggleAnnulerReport: (v: boolean) => void;
  onToggleAnnule: (v: boolean) => void;
  onSaveObservations: (t: string) => void;
  onAddPaiement: (l: Omit<import("../context/financeStorage").LignePaiementMois, "id">) => void;
  onAddFrais: (l: Omit<import("../context/financeStorage").LigneFraisMois, "id">) => void;
  onRemovePaiement: (id: string) => void;
  onRemoveFrais: (id: string) => void;
}) {
  const {
    data,
    computed,
    typesFrais,
    onToggleAnnulerReport,
    onToggleAnnule,
    onSaveObservations,
    onAddPaiement,
    onAddFrais,
    onRemovePaiement,
    onRemoveFrais,
  } = props;

  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMontant, setPayMontant] = useState("");
  const [payNote, setPayNote] = useState("");
  const [fraisType, setFraisType] = useState(typesFrais[0] ?? "");
  const [fraisLib, setFraisLib] = useState("");
  const [fraisMontant, setFraisMontant] = useState("");
  const [fraisDate, setFraisDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [obsDraft, setObsDraft] = useState(data.observationsDocuments);

  useEffect(() => {
    setObsDraft(data.observationsDocuments);
  }, [data.moisCle, data.observationsDocuments]);

  return (
    <div className={styles.expand}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
        Report entrant : {formatEuro(computed.reportEntrant)} · Frais du mois :{" "}
        {formatEuro(computed.totalFrais)} · Reliquat reporté :{" "}
        {data.annulerReportVersSuivant ? "0 (bloqué)" : formatEuro(computed.reportSortant)}
        {computed.depotInclusDansDu > 0.005 ? (
          <>
            {" · "}
            <strong>Dépôt (non soldé) inclus dans le dû du mois :</strong>{" "}
            {formatEuro(computed.depotInclusDansDu)}
          </>
        ) : null}
      </p>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={data.annulerReportVersSuivant}
          onChange={(e) => onToggleAnnulerReport(e.target.checked)}
        />
        Ne pas reporter le solde de ce mois sur le suivant
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={data.statutOverride === "annule"}
          onChange={(e) => onToggleAnnule(e.target.checked)}
        />
        Marquer l’échéance comme annulée (hors comptabilité)
      </label>

      <div style={{ marginTop: "0.65rem" }}>
        <strong style={{ fontSize: "0.82rem" }}>Observations (PDF)</strong>
        <textarea
          className={styles.obsArea}
          value={obsDraft}
          onChange={(e) => setObsDraft(e.target.value)}
          onBlur={() => {
            if (obsDraft !== data.observationsDocuments) {
              onSaveObservations(obsDraft);
            }
          }}
          placeholder="Texte repris sur quittances et avis…"
        />
      </div>

      <div style={{ marginTop: "0.65rem" }}>
        <strong style={{ fontSize: "0.82rem" }}>Paiements</strong>
        <ul className={styles.listMini}>
          {data.paiements.map((p) => (
            <li key={p.id}>
              <span>
                {p.date || "—"} — {formatEuro(parseEuro(p.montant))}{" "}
                {p.note ? `(${p.note})` : ""}
              </span>
              <button
                type="button"
                className={styles.btnGhostSm}
                onClick={() => onRemovePaiement(p.id)}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.formGrid}>
          <label>
            Date
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </label>
          <label>
            Montant (€)
            <input
              inputMode="decimal"
              value={payMontant}
              onChange={(e) => setPayMontant(e.target.value)}
              placeholder="0"
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Note
            <input
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="virement, espèces…"
            />
          </label>
        </div>
        <button
          type="button"
          className={styles.btnSm}
          onClick={() => {
            if (!payMontant.trim()) return;
            onAddPaiement({
              date: payDate,
              montant: payMontant,
              note: payNote,
            });
            setPayMontant("");
            setPayNote("");
          }}
        >
          Ajouter le paiement
        </button>
      </div>

      <div style={{ marginTop: "0.85rem" }}>
        <strong style={{ fontSize: "0.82rem" }}>Frais divers</strong>
        <ul className={styles.listMini}>
          {data.frais.map((f) => (
            <li key={f.id}>
              <span>
                {f.date} — {f.typeFrais} {f.libelle ? `— ${f.libelle}` : ""} —{" "}
                {formatEuro(parseEuro(f.montant))}
              </span>
              <button
                type="button"
                className={styles.btnGhostSm}
                onClick={() => onRemoveFrais(f.id)}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.formGrid}>
          <label>
            Type
            <select
              value={fraisType}
              onChange={(e) => setFraisType(e.target.value)}
            >
              {typesFrais.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Libellé
            <input
              value={fraisLib}
              onChange={(e) => setFraisLib(e.target.value)}
            />
          </label>
          <label>
            Montant
            <input
              inputMode="decimal"
              value={fraisMontant}
              onChange={(e) => setFraisMontant(e.target.value)}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={fraisDate}
              onChange={(e) => setFraisDate(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className={styles.btnSm}
          onClick={() => {
            if (!fraisMontant.trim()) return;
            onAddFrais({
              typeFrais: fraisType,
              libelle: fraisLib,
              montant: fraisMontant,
              date: fraisDate,
            });
            setFraisMontant("");
            setFraisLib("");
          }}
        >
          Ajouter un frais
        </button>
      </div>
    </div>
  );
}
