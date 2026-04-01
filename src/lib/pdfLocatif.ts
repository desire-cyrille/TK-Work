import { jsPDF } from "jspdf";
import { DEFAULT_EMETTEUR_DOCUMENTS_PDF } from "../context/themeSettingsStorage";
import {
  categorieLocataireSurLogement,
  lignesAdresseBailleur,
  ligneRepresentantLegalBailleur,
  type Bailleur,
  type ContratLocation,
  type Locataire,
  type Logement,
} from "../types/domain";
import { nomCompletLocataire, ligneRepresentantLocataire } from "./locataireUi";
import { formatEuro, parseEuro } from "./money";

const BAIL_LIB: Record<string, string> = {
  bail_habitation_vide: "Bail d'habitation vide",
  bail_habitation_meuble: "Bail d'habitation meublé",
  bail_mobilite: "Bail mobilité",
  bail_commercial: "Bail commercial",
  bail_professionnel: "Bail professionnel",
  bail_saisonnier: "Bail saisonnier",
  bail_mixte: "Bail mixte",
  autre: "Autre / personnalisé",
};

/** Libellé affiché pour le type de bail (formulaires, PDF, fiche location). */
export function libelleTypeBailPourPdf(type: string | undefined): string {
  const k = (type ?? "").trim();
  if (!k) return "—";
  return BAIL_LIB[k] ?? "Location";
}

function libelleTermePaiement(
  v: ContratLocation["paiementEchoirOuEchu"]
): string {
  if (v === "a_echoir") return "À terme à échoir";
  if (v === "terme_echu") return "À terme échu";
  return "";
}

function lignesCadreJuridiqueBail(
  contrat: ContratLocation,
  roleContrat: "principal" | "sous_location"
): string[] {
  const lines: string[] = [
    "Rappels de droit applicable (information, non exhaustifs — valider le projet devant un professionnel avant signature).",
  ];
  if (roleContrat === "sous_location") {
    lines.push(
      "Sous-location : le sous-locataire est lié au sous-bailleur. Le consentement du bailleur du bail initial est en principe requis (sauf cas légaux). Vérifier le bail principal et les clauses de sous-location.",
    );
  }
  switch (contrat.typeBail) {
    case "bail_habitation_vide":
      lines.push(
        "Bail vide (habitation principale ou non) : loi n° 89-462 du 6 juillet 1989 ; durée minimale 3 ans (bailleur personne physique) ou 6 ans (personne morale). Dépôt de garantie : plafond d’un mois de loyer hors charges (hors charges « réelles » listées au décret), sauf dispositions particulières.",
        "Honoraires de mise en location : plafonds fixés par le décret du 5 mars 2014 ; répartition selon la nature des prestations. Le bail doit contenir les mentions obligatoires prévues par la loi (parties, description, loyer, charges, etc.).",
      );
      break;
    case "bail_habitation_meuble":
      lines.push(
        "Bail meublé : loi n° 89-462 du 6 juillet 1989, titre I bis — durée minimale un an, liste minimale de meubles (décret n° 2015-981). Dépôt de garantie plafonné à deux mois de loyer hors charges.",
      );
      break;
    case "bail_mobilite":
      lines.push(
        "Bail mobilité : loi n° 89-462 du 6 juillet 1989, titre I ter — durée 1 à 10 mois, non renouvelable sauf accord ; modalités et motif à respecter. Dépôt de garantie : jusqu’à deux mois de loyer hors charges.",
      );
      break;
    case "bail_commercial":
      lines.push(
        "Bail commercial : articles L. 145-1 et suivants du code de commerce (durées 9 / 3 / 3 ans ou stipulations supérieures, triennalités, indemnité d’éviction sous conditions, etc.). Le loyer peut être soumis à TVA selon les cas.",
      );
      break;
    case "bail_professionnel":
      lines.push(
        "Bail professionnel (hors « commerce de détail » au sens du code de commerce) : loi n° 86-1290 du 23 décembre 1986 — régime distinct du bail commercial ; vérifier la nature de l’activité et les clauses de résiliation.",
      );
      break;
    case "bail_saisonnier":
      lines.push(
        "Location saisonnière : usage de résidence temporaire, régime prévu par la loi du 6 juillet 1989 — caractère et durée à préciser ; vérifier le plafond du dépôt de garantie selon la qualification retenue.",
      );
      break;
    case "bail_mixte":
      lines.push(
        "Bail mixte : combinaison habitation et activité professionnelle ou commerciale. Préciser la répartition des usages, des loyers et charges, et les régimes juridiques applicables à chaque composante ; attention aux assurances et obligations (urbanisme, sécurité).",
      );
      break;
    default:
      lines.push(
        "Type « autre » ou non détaillé : préciser le régime juridique voulu (durée, résiliation, dépôt de garantie, TVA) et les textes applicables avec votre conseil.",
      );
  }
  lines.push(
    "Diagnostics et annexes : selon les obligations en vigueur au jour de la mise en location, joindre notamment les mentions et documents relatifs au DPE, à l’état des risques, plomb, amiante, gaz, électricité si concerné, et le cas échéant les mesurages réglementaires du lot — liste évolutive (ex. exigences « climat et résilience » pour le DPE).",
  );
  if (
    contrat.encadrementRefMajore === "oui" ||
    contrat.encadrementZoneIrl === "oui"
  ) {
    lines.push(
      "Encadrement des loyers : en zone soumise à la réglementation, respecter le loyer de référence, le loyer majoré et, le cas échéant, le complément de loyer selon les barèmes et arrêtés en vigueur pour la commune.",
    );
  }
  lines.push(
    "Indexation : si clause d’évolution du loyer (IRL, ICC, etc.), respecter les conditions de forme et de délai prévues par le texte applicable.",
  );
  return lines;
}

function adresseLogement(l?: Logement): string {
  if (!l) return "";
  return [
    [l.adresse, l.complementAdresse].filter(Boolean).join(", "),
    [l.codePostal, l.ville].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" — ");
}

function libelleEmetteurDocumentsPdf(raw?: string): string {
  const t = (raw ?? "").trim();
  return t || DEFAULT_EMETTEUR_DOCUMENTS_PDF;
}

function parseImageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,/i.exec(dataUrl.trim());
  if (!m) return null;
  const t = m[1].toLowerCase();
  if (t === "jpeg" || t === "jpg") return "JPEG";
  return "PNG";
}

/** Dessine un logo (data URL PNG/JPEG) ; retourne la largeur utilisée en mm (0 si absent ou erreur). */
function drawPdfLogoDataUrl(
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  maxH: number,
  maxW: number
): number {
  const raw = (dataUrl ?? "").trim();
  if (!raw) return 0;
  const fmt = parseImageFormatFromDataUrl(raw);
  if (!fmt) return 0;
  try {
    const dim = doc.getImageProperties(raw);
    if (!dim?.width || !dim?.height) return 0;
    let wMm = (maxH * dim.width) / dim.height;
    let hMm = maxH;
    if (wMm > maxW) {
      wMm = maxW;
      hMm = (maxW * dim.height) / dim.width;
    }
    doc.addImage(raw, fmt, x, y, wMm, hMm);
    return wMm;
  } catch {
    return 0;
  }
}

function appendLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  maxW: number,
  lineHeight: number
): number {
  let cy = y;
  for (const line of lines) {
    const parts = doc.splitTextToSize(line, maxW);
    for (const p of parts) {
      doc.text(p, x, cy);
      cy += lineHeight;
    }
  }
  return cy;
}

/** Variante avec saut de page automatique (évite le texte coupé en bas de feuille). */
function appendLinesPaged(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  maxW: number,
  lineHeight: number,
  marginTop: number,
  pageBottom: number
): number {
  let cy = y;
  for (const line of lines) {
    const parts = doc.splitTextToSize(line, maxW);
    for (const p of parts) {
      if (cy > pageBottom) {
        doc.addPage();
        cy = marginTop;
      }
      doc.text(p, x, cy);
      cy += lineHeight;
    }
  }
  return cy;
}

export type RoleBailPdf = "principal" | "sous_location";

export type BailPdfOptions = {
  titre: string;
  contrat: ContratLocation;
  logement?: Logement;
  bailleur?: Bailleur;
  locataire: Locataire;
  sousBailleur?: Locataire;
  roleContrat: RoleBailPdf;
  /** Réglage « Émetteur des documents PDF » (Réglages → Profil société). */
  emetteurDocuments?: string;
  /** Logo société (data URL), même réglage que sur le profil. */
  logoDocumentsPdf?: string;
};

export function buildBailPdf(opts: BailPdfOptions): {
  doc: jsPDF;
  fileName: string;
} {
  const {
    titre,
    contrat,
    logement,
    bailleur,
    locataire,
    sousBailleur,
    roleContrat,
    emetteurDocuments,
    logoDocumentsPdf,
  } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const PAGE_BOTTOM = pageH - 12;
  const M_TOP = 16;
  const BODY_LH = 5.1;
  const SMALL_LH = 4;
  const m = 14;
  const textW = W - 2 * m;

  doc.setFont("helvetica", "normal");

  const logoY = 6;
  const logoMaxH = 14;
  const logoW = drawPdfLogoDataUrl(
    doc,
    logoDocumentsPdf,
    m,
    logoY,
    logoMaxH,
    44
  );
  let y: number;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  if (logoW > 0) {
    doc.text(titre, m + logoW + 4, logoY + logoMaxH * 0.55);
    y = logoY + logoMaxH + 9;
  } else {
    doc.text(titre, m, 18);
    y = 26;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(72, 72, 72);
  const disclaimer =
    "Ce document n’est pas un bail réglementaire ni un modèle officiel : simple synthèse des données saisies dans l’outil. Ne pas confondre avec les contrats types et annexes imposés par la loi — utiliser les modèles publiés par l’ANIL ou service-public.fr ou un acte rédigé par un professionnel. Vérifier conformité, résiliation et mentions obligatoires avant toute signature.";
  y =
    appendLinesPaged(
      doc,
      [disclaimer],
      m,
      y,
      textW,
      SMALL_LH,
      M_TOP,
      PAGE_BOTTOM
    ) + 5;
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const typeB =
    contrat.typeBail && BAIL_LIB[contrat.typeBail]
      ? BAIL_LIB[contrat.typeBail]
      : "Location";
  doc.text("Type de document", m, y);
  doc.setFont("helvetica", "normal");
  const typeLabelW = doc.getTextWidth("Type de document");
  doc.text(` : ${typeB}`, m + typeLabelW, y);
  y += BODY_LH + 1;

  const blocParties: string[] = [];
  if (roleContrat === "principal") {
    blocParties.push(
      `Bailleur : ${bailleur?.nom?.trim() || "—"}`,
      `Locataire : ${nomCompletLocataire(locataire)}`
    );
    if (bailleur) {
      pushCoordonneesBailleurPdf(blocParties, bailleur);
    }
  } else {
    blocParties.push(
      `Sous-bailleur (locataire principal) : ${
        sousBailleur ? nomCompletLocataire(sousBailleur) : "—"
      }`,
      `Sous-locataire : ${nomCompletLocataire(locataire)}`
    );
    if (bailleur?.nom.trim()) {
      blocParties.push(`Propriétaire (référence bien) : ${bailleur.nom}`);
      pushCoordonneesBailleurPdf(blocParties, bailleur);
    }
  }
  const rep = ligneRepresentantLocataire(locataire);
  if (rep) blocParties.push(`Représentant sous-locataire : ${rep}`);

  y =
    appendLinesPaged(
      doc,
      blocParties,
      m,
      y,
      textW,
      BODY_LH,
      M_TOP,
      PAGE_BOTTOM
    ) + 4;

  if (logement) {
    y = appendLinesPaged(
      doc,
      [
        "Objet — logement",
        logement.titre,
        adresseLogement(logement),
        logement.surfaceM2.trim()
          ? `Surface indicative : ${logement.surfaceM2} m²`
          : "",
      ].filter(Boolean),
      m,
      y,
      textW,
      BODY_LH,
      M_TOP,
      PAGE_BOTTOM
    );
    y += 4;
  }

  const finContrat = contrat.dateFin.trim()
    ? contrat.dateFin
    : "Durée ouverte / à compléter";
  const loyerCc = parseEuro(contrat.loyerChargesComprises);
  const loyerHcN = parseEuro(contrat.loyerHc);
  const chargesN = parseEuro(contrat.charges);
  const typeChargesLib =
    contrat.typeChargesLoyer === "provision"
      ? "Provisions pour charges"
      : contrat.typeChargesLoyer === "forfait"
        ? "Forfait de charges"
        : "";
  const renouvLib =
    contrat.renouvellementTacite === "oui"
      ? "Renouvellement tacite : oui"
      : contrat.renouvellementTacite === "non"
        ? "Renouvellement tacite : non"
        : "";
  const details = [
    contrat.identifiantBail.trim()
      ? `Identifiant / réf. bail : ${contrat.identifiantBail}`
      : "",
    contrat.numeroContratInterne.trim()
      ? `Réf. interne : ${contrat.numeroContratInterne}`
      : "",
    contrat.libelleExploitation.trim() && roleContrat === "sous_location"
      ? `Libellé d’exploitation : ${contrat.libelleExploitation}`
      : "",
    `Date de début : ${contrat.dateDebut || "—"}`,
    `Date de fin : ${finContrat}`,
    contrat.dureeMois.trim() ? `Durée stipulée : ${contrat.dureeMois} mois` : "",
    renouvLib,
    `Loyer hors charges : ${formatEuro(loyerHcN)}`,
    chargesN > 0 || contrat.charges.trim()
      ? `Charges (${typeChargesLib || "modalité à préciser"}) : ${formatEuro(chargesN)}`
      : "",
    `Loyer charges comprises (indicatif) : ${formatEuro(loyerCc)}`,
    parseEuro(contrat.loyerHcTva) > 0
      ? `TVA sur loyer HC : ${contrat.loyerHcTva.trim()} %`
      : "",
    parseEuro(contrat.chargesTva) > 0
      ? `TVA sur charges : ${contrat.chargesTva.trim()} %`
      : "",
    contrat.depotGarantie.trim()
      ? `Dépôt de garantie : ${formatEuro(parseEuro(contrat.depotGarantie))}`
      : "",
    contrat.periodicite
      ? `Périodicité : ${contrat.periodicite === "mensuel" ? "mensuelle" : "trimestrielle"}`
      : "",
    libelleTermePaiement(contrat.paiementEchoirOuEchu)
      ? `Échéance : ${libelleTermePaiement(contrat.paiementEchoirOuEchu)}`
      : "",
    contrat.jourPaiement.trim()
      ? `Jour de paiement prévu : ${contrat.jourPaiement}`
      : "",
    contrat.jourQuittancement.trim()
      ? `Jour de quittancement : ${contrat.jourQuittancement}`
      : "",
    contrat.moyenPaiement.trim()
      ? `Mode de paiement : ${contrat.moyenPaiement}`
      : "",
    contrat.modeRevisionLoyer === "irl" && contrat.valeurIndiceRevision.trim()
      ? `Révision (IRL ou indice) — ${contrat.indiceRevisionLibelle || "indice"} ${contrat.trimestreIndiceRevision ? contrat.trimestreIndiceRevision + " " : ""}: ${contrat.valeurIndiceRevision}`
      : contrat.modeRevisionLoyer === "pourcentage"
        ? "Révision : pourcentage (détail dans clauses ou annexes)"
        : contrat.modeRevisionLoyer === "aucune"
          ? "Pas de révision automatique stipulée dans l’outil"
          : "",
    contrat.indexation.trim()
      ? `Indexation (mention libre) : ${contrat.indexation}`
      : "",
    contrat.clauseParticuliere.trim()
      ? `Clauses particulières (extrait) : ${contrat.clauseParticuliere.slice(0, 600)}${contrat.clauseParticuliere.length > 600 ? "…" : ""}`
      : "",
    contrat.infosComplementaires.trim()
      ? `Informations complémentaires (extrait) : ${contrat.infosComplementaires.slice(0, 400)}${contrat.infosComplementaires.length > 400 ? "…" : ""}`
      : "",
  ].filter(Boolean);

  if (y > PAGE_BOTTOM - 28) {
    doc.addPage();
    y = M_TOP;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Stipulations et modalités (synthèse)", m, y);
  y += BODY_LH + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = appendLinesPaged(
    doc,
    details,
    m,
    y,
    textW,
    BODY_LH,
    M_TOP,
    PAGE_BOTTOM
  );
  y += 5;

  if (y > PAGE_BOTTOM - 28) {
    doc.addPage();
    y = M_TOP;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(48, 48, 48);
  doc.text("Rappels de cadre juridique (non exhaustifs)", m, y);
  y += BODY_LH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(52, 52, 52);
  y = appendLinesPaged(
    doc,
    lignesCadreJuridiqueBail(contrat, roleContrat),
    m,
    y,
    textW,
    SMALL_LH,
    M_TOP,
    PAGE_BOTTOM
  );
  doc.setTextColor(0, 0, 0);

  const SIG_BLOCK_H = 44;
  if (y + SIG_BLOCK_H > PAGE_BOTTOM) {
    doc.addPage();
    y = M_TOP;
  } else {
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Signatures (après relecture)", m, y);
  y += 7;
  const gap = 5;
  const colW = (textW - gap) / 2;
  const boxH = 30;
  const yBox = y;
  doc.setDrawColor(88, 88, 88);
  doc.setLineWidth(0.2);
  doc.rect(m, yBox, colW, boxH);
  doc.rect(m + colW + gap, yBox, colW, boxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Bailleur / sous-bailleur", m + 2.5, yBox + 5.5);
  doc.text("Locataire / sous-locataire", m + colW + gap + 2.5, yBox + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(88);
  doc.text("Lu et approuvé, bon pour accord", m + 2.5, yBox + 11);
  doc.text("Lu et approuvé, bon pour accord", m + colW + gap + 2.5, yBox + 11);
  doc.text("Fait à _________________, le _______________", m + 2.5, yBox + 17);
  doc.text(
    "Fait à _________________, le _______________",
    m + colW + gap + 2.5,
    yBox + 17
  );
  doc.setDrawColor(130);
  doc.line(m + 2.5, yBox + boxH - 5, m + colW - 2.5, yBox + boxH - 5);
  doc.line(
    m + colW + gap + 2.5,
    yBox + boxH - 5,
    m + gap + 2 * colW - 2.5,
    yBox + boxH - 5
  );
  doc.setFontSize(6.5);
  doc.text("Signature (cachet si personne morale)", m + 2.5, yBox + boxH - 1.5);
  doc.text(
    "Signature (cachet si personne morale)",
    m + colW + gap + 2.5,
    yBox + boxH - 1.5
  );
  doc.setTextColor(0, 0, 0);

  y = yBox + boxH + 6;

  let yFoot = y;
  if (yFoot > PAGE_BOTTOM - 6) {
    doc.addPage();
    yFoot = M_TOP;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110);
  appendLines(
    doc,
    [
      `Document généré par ${libelleEmetteurDocumentsPdf(emetteurDocuments)} — relire avant toute signature.`,
    ],
    m,
    yFoot,
    textW,
    SMALL_LH
  );

  const fileName =
    roleContrat === "principal"
      ? `projet-bail-principal-${contrat.id.slice(0, 8)}.pdf`
      : `projet-sous-location-${contrat.id.slice(0, 8)}.pdf`;
  return { doc, fileName };
}

export function telechargerBailPdf(opts: BailPdfOptions): void {
  const { doc, fileName } = buildBailPdf(opts);
  doc.save(fileName);
}

export type ProjetEtatDesLieuxPdfOptions = {
  titre: string;
  contrat: ContratLocation;
  logement?: Logement;
  locataire: Locataire;
  bailleur?: Bailleur;
  sousBailleur?: Locataire;
  notesRemplies?: string;
  emetteurDocuments?: string;
  logoDocumentsPdf?: string;
};

export function buildProjetEtatDesLieuxPdf(
  opts: ProjetEtatDesLieuxPdfOptions
): { doc: jsPDF; fileName: string } {
  const {
    titre,
    logement,
    locataire,
    bailleur,
    sousBailleur,
    notesRemplies,
    emetteurDocuments,
    logoDocumentsPdf,
  } = opts;
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const m = 14;
  const logoY = 6;
  const logoMaxH = 14;
  const logoW = drawPdfLogoDataUrl(
    doc,
    logoDocumentsPdf,
    m,
    logoY,
    logoMaxH,
    44
  );
  let y: number;
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  if (logoW > 0) {
    doc.text(titre, m + logoW + 4, logoY + logoMaxH * 0.55);
    y = logoY + logoMaxH + 9;
  } else {
    doc.text(titre, m, 18);
    y = 28;
  }
  doc.setFontSize(9);
  doc.setTextColor(90);
  y =
    appendLines(
      doc,
      [
        "Modèle d’état des lieux : complétez pièce par pièce (murs, sols, équipements, relevé compteurs).",
        "Joindre photos datées en annexe si besoin.",
      ],
      m,
      y,
      W - 2 * m,
      4.2
    ) + 8;
  doc.setTextColor(0);
  doc.setFontSize(11);
  const ent: string[] = [
    logement ? `Logement : ${logement.titre}` : "",
    logement ? adresseLogement(logement) : "",
    `Entrant : ${nomCompletLocataire(locataire)}`,
  ];
  if (sousBailleur) {
    ent.push(`Sortant / représentant : ${nomCompletLocataire(sousBailleur)}`);
  } else if (bailleur) {
    ent.push(`Bailleur (réf.) : ${bailleur.nom}`);
    pushCoordonneesBailleurPdf(ent, bailleur);
  }
  ent.push(`Date : ${new Date().toLocaleDateString("fr-FR")}`);
  y = appendLines(doc, ent.filter(Boolean), m, y, W - 2 * m, 5.5) + 6;

  const modelePieces = [
    "Pièce : …",
    "— Murs / plafond :",
    "— Sol :",
    "— Ouvertures (fenêtres, portes) :",
    "— Équipements :",
    "— Observations :",
    "",
  ];
  y = appendLines(doc, modelePieces, m, y, W - 2 * m, 5.5);

  if (notesRemplies?.trim()) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Notes saisies dans l’application :", m, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    y = appendLines(doc, [notesRemplies.trim()], m, y, W - 2 * m, 5.5);
  }

  doc.text("Signatures des parties (entrant / sortant) :", m, y + 12);
  let yFoot = y + 26;
  if (yFoot > 260) {
    doc.addPage();
    yFoot = 18;
  }
  doc.setFontSize(8);
  doc.setTextColor(110);
  appendLines(
    doc,
    [
      `Document généré par ${libelleEmetteurDocumentsPdf(emetteurDocuments)} — compléter sur place avant signature.`,
    ],
    m,
    yFoot,
    W - 2 * m,
    3.8
  );
  const fileName = `projet-etat-des-lieux-${opts.contrat.id.slice(0, 8)}.pdf`;
  return { doc, fileName };
}

export function telechargerProjetEtatDesLieuxPdf(
  opts: ProjetEtatDesLieuxPdfOptions
): void {
  const { doc, fileName } = buildProjetEtatDesLieuxPdf(opts);
  doc.save(fileName);
}

export type TypeDocumentMois =
  | "quittance"
  | "avis_echeance"
  | "avis_paiement";

/** Palette TK Pro Gestion — contrastes renforcés pour PDF (impression / écran). */
const PDF_THEME = {
  brandOrange: { r: 255, g: 75, b: 43 },
  brandPink: { r: 255, g: 65, b: 108 },
  navy: { r: 17, g: 16, b: 77 },
  muted: { r: 90, g: 90, b: 102 },
  fillParties: { r: 255, g: 240, b: 235 },
  fillSection: { r: 252, g: 251, b: 255 },
  fillStripe: { r: 255, g: 245, b: 248 },
  fillHighlight: { r: 255, g: 228, b: 218 },
  borderStrong: { r: 255, g: 75, b: 43 },
  borderAccent: { r: 236, g: 72, b: 153 },
  borderSoft: { r: 200, g: 198, b: 210 },
  white: { r: 255, g: 255, b: 255 },
} as const;

/** Police unique, tailles harmonisées (pt). */
const PDF_TYPO = {
  title: 15,
  subtitle: 9,
  body: 9,
  small: 8,
  foot: 7.5,
  lineBody: 4.6,
  lineSmall: 4.1,
} as const;

/**
 * Montants lisibles par jsPDF (polices standard ~ Latin-1) : pas de symbole €
 * ni d’espaces insécables issus d’Intl (sinon glyphes faux / lettres espacées).
 */
function formatMontantPdf(n: number): string {
  const v = Math.round(n * 100) / 100;
  const neg = v < 0;
  const abs = Math.abs(v);
  const [intRaw, frac] = abs.toFixed(2).split(".");
  const intPart = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const s = `${intPart},${frac} EUR`;
  return neg ? `- ${s}` : s;
}

function setFontBody(doc: jsPDF, style: "normal" | "bold" = "normal"): void {
  doc.setFont("helvetica", style);
  doc.setFontSize(PDF_TYPO.body);
  doc.setTextColor(0, 0, 0);
}

function fillRGB(
  doc: jsPDF,
  c: { r: number; g: number; b: number }
): void {
  doc.setFillColor(c.r, c.g, c.b);
}

function drawRGB(
  doc: jsPDF,
  c: { r: number; g: number; b: number }
): void {
  doc.setDrawColor(c.r, c.g, c.b);
}

function textRGB(
  doc: jsPDF,
  c: { r: number; g: number; b: number }
): void {
  doc.setTextColor(c.r, c.g, c.b);
}

function formatDateFr(iso: string | undefined): string {
  if (!iso || iso.length < 10) return "—";
  const [yy, mm, dd] = iso.slice(0, 10).split("-");
  return `${dd}/${mm}/${yy}`;
}

function titreMoisAnneeAffiche(moisCle: string): string {
  const parts = moisCle.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  if (!y || !mo) return moisCle;
  const d = new Date(y, mo - 1, 1);
  const moisNom = d.toLocaleDateString("fr-FR", { month: "long" });
  return `${moisNom.charAt(0).toUpperCase()}${moisNom.slice(1)} ${y}`;
}

function titreMoisAnneeQuittance(moisCle: string): string {
  const parts = moisCle.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  if (!y || !mo) return moisCle.toUpperCase();
  const d = new Date(y, mo - 1, 1);
  const moisNom = d.toLocaleDateString("fr-FR", { month: "long" });
  return `${moisNom.toUpperCase()} ${y}`;
}

function periodePourMoisCle(moisCle: string): {
  debutLabel: string;
  finLabel: string;
  labelPlage: string;
} {
  const parts = moisCle.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  const debut = new Date(y, mo - 1, 1);
  const fin = new Date(y, mo, 0);
  return {
    debutLabel: debut.toLocaleDateString("fr-FR", opts),
    finLabel: fin.toLocaleDateString("fr-FR", opts),
    labelPlage: `${debut.toLocaleDateString("fr-FR", opts)} au ${fin.toLocaleDateString("fr-FR", opts)}`,
  };
}

function slugFichierPdf(s: string): string {
  const t = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return t.slice(0, 42) || "bien";
}

function appendLinesSized(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  maxW: number,
  lineHeight: number,
  fontSize: number
): number {
  doc.setFontSize(fontSize);
  let cy = y;
  for (const line of lines) {
    if (!line) continue;
    const parts = doc.splitTextToSize(line, maxW);
    for (const p of parts) {
      doc.text(p, x, cy);
      cy += lineHeight;
    }
  }
  return cy;
}

function pushCoordonneesBailleurPdf(target: string[], b: Bailleur): void {
  if (b.typeOccupant === "personne_morale") {
    if (b.formeJuridique.trim()) target.push(b.formeJuridique.trim());
    if (b.siret.trim()) target.push(`SIRET ${b.siret.trim()}`);
    const rep = ligneRepresentantLegalBailleur(b);
    if (rep) target.push(`Représentant légal : ${rep}`);
  }
  target.push(...lignesAdresseBailleur(b));
}

function lignesLocatairePdf(l: Locataire): string[] {
  const out: string[] = [nomCompletLocataire(l)];
  if (l.formeJuridique.trim()) out.push(l.formeJuridique.trim());
  if (l.siret.trim()) out.push(`SIRET ${l.siret.trim()}`);
  if (l.telephone.trim()) out.push(`Tél. ${l.telephone.trim()}`);
  if (l.email.trim()) out.push(l.email.trim());
  const rep = ligneRepresentantLocataire(l);
  if (rep) out.push(`Représentant : ${rep}`);
  return out;
}

function lignesEmetteurPdf(
  estSousLocation: boolean,
  bailleur: Bailleur | undefined,
  sousBailleur: Locataire | undefined
): string[] {
  if (estSousLocation && sousBailleur) {
    return lignesLocatairePdf(sousBailleur);
  }
  if (bailleur?.nom.trim()) {
    const b = bailleur;
    const lines: string[] = [b.nom.trim()];
    pushCoordonneesBailleurPdf(lines, b);
    if (b.telephone.trim()) lines.push(`Tél. ${b.telephone.trim()}`);
    if (b.email.trim()) lines.push(b.email.trim());
    return lines;
  }
  return ["—"];
}

/** En-tête pleine largeur : fond marine + filet orange (lisible à l’écran comme à l’impression). */
function drawHeaderNavy(
  doc: jsPDF,
  W: number,
  m: number,
  titrePrincipal: string,
  sousTitre: string,
  logoDataUrl?: string
): number {
  const h = 22;
  fillRGB(doc, PDF_THEME.navy);
  doc.rect(0, 0, W, h, "F");
  fillRGB(doc, PDF_THEME.brandOrange);
  doc.rect(0, h, W, 1.2, "F");
  fillRGB(doc, PDF_THEME.brandPink);
  doc.rect(0, h + 1.2, W, 0.7, "F");

  const logoW = drawPdfLogoDataUrl(doc, logoDataUrl, m, 4, 14, 48);
  const textX = logoW > 0 ? m + logoW + 3 : m;
  const textMaxW = Math.max(28, W - textX - m);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.title);
  doc.setTextColor(255, 255, 255);
  const titreLines = doc.splitTextToSize(titrePrincipal, textMaxW);
  if (titreLines.length === 1) {
    doc.text(titrePrincipal, textX, 11);
  } else {
    let ty = 6.8;
    for (const line of titreLines) {
      doc.text(line, textX, ty);
      ty += 5.3;
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_TYPO.subtitle);
  doc.setTextColor(230, 230, 240);
  const sousLines = doc.splitTextToSize(sousTitre, textMaxW);
  const subY =
    titreLines.length === 1 ? 18 : 6.8 + titreLines.length * 5.3 + 1.2;
  let sy = subY;
  for (const line of sousLines) {
    doc.text(line, textX, sy);
    sy += PDF_TYPO.lineSmall;
  }

  doc.setTextColor(0, 0, 0);
  return h + 2.5;
}

/** Encadré arrondi avec bordure colorée. */
function encadreArrondi(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: { r: number; g: number; b: number },
  stroke: { r: number; g: number; b: number },
  lineW: number
): void {
  fillRGB(doc, fill);
  drawRGB(doc, stroke);
  doc.setLineWidth(lineW);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
}

function bandeauTitreSection(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  titre: string
): number {
  const hh = 8.5;
  fillRGB(doc, PDF_THEME.fillStripe);
  doc.rect(x, y, w, hh, "F");
  drawRGB(doc, PDF_THEME.brandOrange);
  doc.setLineWidth(0.45);
  doc.line(x, y + hh, x + w, y + hh);
  drawRGB(doc, PDF_THEME.borderAccent);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + w, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.body);
  textRGB(doc, PDF_THEME.navy);
  doc.text(titre.toUpperCase(), x + 3.5, y + 5.7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  return y + hh;
}

/** Une ligne libellé (normal) + montant (gras), 9 pt Helvetica partout. */
function ligneLibelleMontant(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  montant: number
): number {
  const sep = " : ";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_TYPO.body);
  const val = formatMontantPdf(montant);
  doc.setFont("helvetica", "bold");
  const valW = doc.getTextWidth(val);
  doc.setFont("helvetica", "normal");
  const prefix = label + sep;
  const prefixW = doc.getTextWidth(prefix);
  if (prefixW + valW > w - 2) {
    doc.text(label + sep, x, y);
    doc.setFont("helvetica", "bold");
    doc.text(val, x, y + PDF_TYPO.lineBody);
    doc.setFont("helvetica", "normal");
    return y + PDF_TYPO.lineBody * 2;
  }
  doc.text(prefix, x, y);
  doc.setFont("helvetica", "bold");
  doc.text(val, x + prefixW, y);
  doc.setFont("helvetica", "normal");
  return y + PDF_TYPO.lineBody;
}

/** Hauteur verticale d’une ligne libellé + montant (1 ou 2 lignes si retour). */
function hauteurLigneLibelleMontant(
  doc: jsPDF,
  w: number,
  label: string,
  montant: number
): number {
  const sep = " : ";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_TYPO.body);
  const val = formatMontantPdf(montant);
  doc.setFont("helvetica", "bold");
  const valW = doc.getTextWidth(val);
  doc.setFont("helvetica", "normal");
  const prefixW = doc.getTextWidth(label + sep);
  return prefixW + valW > w - 2
    ? PDF_TYPO.lineBody * 2
    : PDF_TYPO.lineBody;
}

function hauteurBlocTexteLignes(
  doc: jsPDF,
  lines: string[],
  maxW: number,
  lineHeight: number,
  fontSize: number
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  let h = 0;
  for (const line of lines) {
    if (!line) continue;
    const parts = doc.splitTextToSize(line, maxW);
    h += parts.length * lineHeight;
  }
  return h;
}

function nomFichierDocumentMois(
  type: TypeDocumentMois,
  moisCle: string,
  titreLogement: string | undefined
): string {
  const slug = slugFichierPdf(titreLogement ?? "logement");
  const affiche = titreMoisAnneeAffiche(moisCle).replace(/\s+/g, "_");
  switch (type) {
    case "quittance":
      return `Quittance_${slug}_${affiche}.pdf`;
    case "avis_echeance":
      return `Avis_echeance_${slug}_${affiche}.pdf`;
    default:
      return `Avis_solde_${slug}_${affiche}.pdf`;
  }
}

export type DocumentMoisPdfOptions = {
  type: TypeDocumentMois;
  contrat: ContratLocation;
  logement?: Logement;
  locataire: Locataire;
  bailleur?: Bailleur;
  /** Locataire principal / sous-bailleur lorsque le bail est une sous-location. */
  sousBailleur?: Locataire;
  moisCle: string;
  montantDu: number;
  montantPaye: number;
  solde: number;
  observations: string;
  /** Dernière date de paiement enregistrée pour le mois (AAAA-MM-JJ). */
  dateVersement?: string;
  reportEntrant?: number;
  totalFraisMois?: number;
  emetteurDocuments?: string;
  logoDocumentsPdf?: string;
};

export function buildDocumentMoisPdf(opts: DocumentMoisPdfOptions): {
  doc: jsPDF;
  fileName: string;
} {
  const {
    type,
    contrat,
    logement,
    locataire,
    bailleur,
    sousBailleur,
    moisCle,
    montantDu,
    montantPaye,
    solde,
    observations,
    dateVersement,
    reportEntrant,
    totalFraisMois,
    emetteurDocuments,
    logoDocumentsPdf,
  } = opts;

  const emetteurLib = libelleEmetteurDocumentsPdf(emetteurDocuments);
  const obsTrim = observations.trim();
  const fraisNegligeable = (totalFraisMois ?? 0) <= 0.005;
  /** Quittance « simple » : pas d’observations saisies, pas de frais hors loyer/charges bail. */
  const quittanceClassique =
    type === "quittance" && !obsTrim && fraisNegligeable;
  const gY = quittanceClassique
    ? {
        afterHeader: 3,
        afterBloc: 4,
        afterDetail: 4,
        afterPaiement: 4,
        afterBien: 4,
        beforeSign: 3,
      }
    : {
        afterHeader: 5,
        afterBloc: 6,
        afterDetail: 5,
        afterPaiement: 6,
        afterBien: 5,
        beforeSign: 5,
      };

  const estSousLocation = contrat.locataireSousBailleurId.trim().length > 0;
  const periode = periodePourMoisCle(moisCle);
  const adresseBien = logement ? adresseLogement(logement) : "";
  const ligneBien = logement
    ? `${[logement.adresse, logement.complementAdresse].filter(Boolean).join(", ")}, ${[logement.codePostal, logement.ville].filter(Boolean).join(" ")}`
    : "";

  const roleGauche = estSousLocation
    ? "Sous-bailleur (émetteur)"
    : "Bailleur";
  const catOccupant = categorieLocataireSurLogement(
    locataire,
    contrat.logementId
  );
  const roleDroit =
    catOccupant === "sous-locataire" ? "Sous-locataire" : "Locataire";

  const titresType: Record<TypeDocumentMois, string> = {
    quittance: `QUITTANCE ${titreMoisAnneeQuittance(moisCle)}`,
    avis_echeance: `AVIS D'ECHEANCE ${titreMoisAnneeAffiche(moisCle)}`,
    avis_paiement: `AVIS DE SOLDE ${titreMoisAnneeAffiche(moisCle)}`,
  };

  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const m = 14;
  const gap = 6;
  const wBox = W - 2 * m;
  const padBox = 5;
  const wInner = wBox - 2 * padBox;
  const colWInner = (wInner - gap) / 2;
  const wLbl = wBox - 2 * padBox - 4;

  const pageHeight = doc.internal.pageSize.getHeight();
  const marginBottom = 20;
  const yNewPage = 16;

  let y = drawHeaderNavy(
    doc,
    W,
    m,
    titresType[type],
    `Période ${periode.labelPlage} · Échéance mensuelle`,
    logoDocumentsPdf
  );
  y += gY.afterHeader;

  function ensureSpace(needed: number): void {
    if (y + needed > pageHeight - marginBottom) {
      doc.addPage();
      y = yNewPage;
    }
  }

  const lignesGauche = lignesEmetteurPdf(estSousLocation, bailleur, sousBailleur);
  const lignesDroite = lignesLocatairePdf(locataire);
  const headerRows = PDF_TYPO.lineSmall * 2 + 1;
  const bodyHCols = Math.max(
    hauteurBlocTexteLignes(
      doc,
      lignesGauche,
      colWInner,
      PDF_TYPO.lineBody,
      PDF_TYPO.body
    ),
    hauteurBlocTexteLignes(
      doc,
      lignesDroite,
      colWInner,
      PDF_TYPO.lineBody,
      PDF_TYPO.body
    )
  );
  const hProprio =
    estSousLocation && bailleur?.nom.trim() ? PDF_TYPO.lineBody + 3 : 0;
  const boxPartiesH = padBox * 2 + headerRows + bodyHCols + hProprio + 2;

  ensureSpace(boxPartiesH + 10);
  encadreArrondi(
    doc,
    m,
    y,
    wBox,
    boxPartiesH,
    PDF_THEME.fillParties,
    PDF_THEME.borderStrong,
    0.55
  );
  drawRGB(doc, PDF_THEME.borderAccent);
  doc.setLineWidth(0.35);
  const midX = m + padBox + colWInner + gap / 2;
  doc.line(midX, y + padBox, midX, y + boxPartiesH - padBox);

  let yi = y + padBox + PDF_TYPO.lineSmall;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.small);
  textRGB(doc, PDF_THEME.brandOrange);
  doc.text("DE", m + padBox, yi);
  doc.text("A", m + padBox + colWInner + gap, yi);
  doc.setTextColor(0, 0, 0);
  yi += PDF_TYPO.lineSmall + 0.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_TYPO.small);
  textRGB(doc, PDF_THEME.muted);
  doc.text(roleGauche, m + padBox, yi);
  doc.text(roleDroit, m + padBox + colWInner + gap, yi);
  doc.setTextColor(0, 0, 0);
  yi += PDF_TYPO.lineSmall + 1;
  const yCol = yi;
  const yEndG = appendLinesSized(
    doc,
    lignesGauche,
    m + padBox,
    yCol,
    colWInner,
    PDF_TYPO.lineBody,
    PDF_TYPO.body
  );
  const yEndD = appendLinesSized(
    doc,
    lignesDroite,
    m + padBox + colWInner + gap,
    yCol,
    colWInner,
    PDF_TYPO.lineBody,
    PDF_TYPO.body
  );
  yi = Math.max(yEndG, yEndD);
  if (estSousLocation && bailleur?.nom.trim()) {
    yi += 2;
    doc.setFontSize(PDF_TYPO.small);
    textRGB(doc, PDF_THEME.muted);
    doc.text(
      `Propriétaire du bien (référence) : ${bailleur.nom.trim()}`,
      m + padBox,
      yi
    );
    doc.setTextColor(0, 0, 0);
  }
  y += boxPartiesH + gY.afterBloc;

  const infoTitre =
    catOccupant === "sous-locataire"
      ? "Information sous-locataire"
      : "Information locataire";
  const infoContentH = PDF_TYPO.lineBody * 2 + padBox;
  const infoH = 8.5 + infoContentH + padBox;
  ensureSpace(infoH + 10);
  encadreArrondi(
    doc,
    m,
    y,
    wBox,
    infoH,
    PDF_THEME.fillSection,
    PDF_THEME.borderAccent,
    0.5
  );
  bandeauTitreSection(doc, m + 0.45, y + 0.45, wBox - 0.9, infoTitre);
  let yInfo = y + 8.5 + padBox + PDF_TYPO.lineBody;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.body);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `${roleDroit} : ${nomCompletLocataire(locataire)}`,
    m + padBox + 2,
    yInfo
  );
  doc.setFont("helvetica", "normal");
  y += infoH + gY.afterBloc;

  const hc = parseEuro(contrat.loyerHc);
  const charges = parseEuro(contrat.charges);
  const ccRef = parseEuro(contrat.loyerChargesComprises);
  const tvaHc = parseEuro(contrat.loyerHcTva);
  const tvaCharges = parseEuro(contrat.chargesTva);
  const tvaTot = tvaHc + tvaCharges;
  const rep = reportEntrant ?? 0;
  const frais = totalFraisMois ?? 0;

  let detailContH = 8.5 + padBox + 2;
  const traitExtra = quittanceClassique ? 0.55 : 1.2;
  if (hc > 0.005) {
    detailContH +=
      hauteurLigneLibelleMontant(doc, wLbl, "Loyer hors charges", hc) +
      traitExtra;
  }
  if (charges > 0.005) {
    const typ =
      contrat.typeChargesLoyer === "provision"
        ? "provision"
        : "forfait / autre";
    detailContH +=
      hauteurLigneLibelleMontant(
        doc,
        wLbl,
        `Charges (${typ})`,
        charges
      ) + traitExtra;
  }
  if (tvaTot > 0.005) {
    detailContH +=
      hauteurLigneLibelleMontant(doc, wLbl, "TVA (loyer / charges)", tvaTot) +
      traitExtra;
  }
  if (ccRef > 0.005) {
    detailContH +=
      hauteurLigneLibelleMontant(
        doc,
        wLbl,
        "Loyer charges comprises (référence bail)",
        ccRef
      ) + traitExtra;
  }
  if (rep > 0.005) {
    detailContH +=
      hauteurLigneLibelleMontant(
        doc,
        wLbl,
        "Report à payer (période)",
        rep
      ) + traitExtra;
  }
  if (frais > 0.005) {
    detailContH +=
      hauteurLigneLibelleMontant(doc, wLbl, "Frais divers (mois)", frais) +
      traitExtra;
  }
  if (montantDu > 0.005) {
    detailContH +=
      hauteurLigneLibelleMontant(
        doc,
        wLbl,
        "Montant total exigible (période)",
        montantDu
      ) + traitExtra;
  }
  detailContH +=
    hauteurLigneLibelleMontant(
      doc,
      wLbl,
      "Montant déjà versé (saisi)",
      montantPaye
    ) + traitExtra;
  detailContH +=
    hauteurLigneLibelleMontant(
      doc,
      wLbl,
      "Solde après versements",
      solde
    ) + 2;

  const detailH = detailContH + padBox;
  ensureSpace(detailH + 12);
  encadreArrondi(
    doc,
    m,
    y,
    wBox,
    detailH,
    PDF_THEME.fillSection,
    PDF_THEME.borderStrong,
    0.5
  );
  bandeauTitreSection(doc, m + 0.45, y + 0.45, wBox - 0.9, "Détails du terme");

  let yd = y + 8.5 + padBox + 2;
  const xLbl = m + padBox + 2;
  const xR = m + wBox - padBox;

  function traitLigneFin(yy: number): void {
    drawRGB(doc, PDF_THEME.borderSoft);
    doc.setLineWidth(0.2);
    doc.line(xLbl, yy + 0.8, xR, yy + 0.8);
  }

  if (hc > 0.005) {
    yd = ligneLibelleMontant(doc, xLbl, yd, wLbl, "Loyer hors charges", hc);
    traitLigneFin(yd);
  }
  if (charges > 0.005) {
    const typ =
      contrat.typeChargesLoyer === "provision"
        ? "provision"
        : "forfait / autre";
    yd = ligneLibelleMontant(
      doc,
      xLbl,
      yd,
      wLbl,
      `Charges (${typ})`,
      charges
    );
    traitLigneFin(yd);
  }
  if (tvaTot > 0.005) {
    yd = ligneLibelleMontant(
      doc,
      xLbl,
      yd,
      wLbl,
      "TVA (loyer / charges)",
      tvaTot
    );
    traitLigneFin(yd);
  }
  if (ccRef > 0.005) {
    yd = ligneLibelleMontant(
      doc,
      xLbl,
      yd,
      wLbl,
      "Loyer charges comprises (référence bail)",
      ccRef
    );
    traitLigneFin(yd);
  }
  if (rep > 0.005) {
    yd = ligneLibelleMontant(
      doc,
      xLbl,
      yd,
      wLbl,
      "Report à payer (période)",
      rep
    );
    traitLigneFin(yd);
  }
  if (frais > 0.005) {
    yd = ligneLibelleMontant(doc, xLbl, yd, wLbl, "Frais divers (mois)", frais);
    traitLigneFin(yd);
  }
  if (montantDu > 0.005) {
    yd = ligneLibelleMontant(
      doc,
      xLbl,
      yd,
      wLbl,
      "Montant total exigible (période)",
      montantDu
    );
    traitLigneFin(yd);
  }
  yd = ligneLibelleMontant(
    doc,
    xLbl,
    yd,
    wLbl,
    "Montant déjà versé (saisi)",
    montantPaye
  );
  traitLigneFin(yd);
  yd = ligneLibelleMontant(
    doc,
    xLbl,
    yd,
    wLbl,
    "Solde après versements",
    solde
  );
  y += detailH + gY.afterDetail;

  if (type === "quittance" && montantPaye > 0.005) {
    const dv = dateVersement
      ? formatDateFr(dateVersement)
      : formatDateFr(new Date().toISOString().slice(0, 10));
    const payH = quittanceClassique ? 17 : 20;
    ensureSpace(payH + 12);
    encadreArrondi(
      doc,
      m,
      y,
      wBox,
      payH,
      PDF_THEME.fillHighlight,
      PDF_THEME.borderStrong,
      0.65
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_TYPO.body);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `${roleDroit} a versé ${formatMontantPdf(montantPaye)} le ${dv}.`,
      m + padBox,
      quittanceClassique ? y + 7.5 : y + 9
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_TYPO.subtitle + 1);
    textRGB(doc, PDF_THEME.navy);
    doc.text(
      `TOTAL PAYE : ${formatMontantPdf(montantPaye)}`,
      m + padBox,
      quittanceClassique ? y + 13.8 : y + 16
    );
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += payH + gY.afterPaiement;
  }

  if (type === "avis_echeance") {
    ensureSpace(28 + 30);
    encadreArrondi(
      doc,
      m,
      y,
      wBox,
      28,
      PDF_THEME.fillStripe,
      PDF_THEME.borderAccent,
      0.45
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_TYPO.subtitle);
    doc.text(
      `Somme à régler (période ${periode.labelPlage})`,
      m + padBox,
      y + 10
    );
    doc.text(formatMontantPdf(montantDu), m + padBox, y + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_TYPO.body);
    y += 28 + 6;
    y = appendLinesSized(
      doc,
      [
        `Solde restant dû : ${formatMontantPdf(solde)}.`,
        "Merci d'effectuer le règlement selon les modalités du bail.",
      ],
      m,
      y,
      wBox,
      PDF_TYPO.lineBody,
      PDF_TYPO.body
    );
    y += 4;
  }

  if (type === "avis_paiement") {
    ensureSpace(22 + 24);
    encadreArrondi(
      doc,
      m,
      y,
      wBox,
      22,
      PDF_THEME.fillStripe,
      PDF_THEME.borderAccent,
      0.45
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_TYPO.subtitle);
    doc.text(
      `Solde sur l'échéance : ${formatMontantPdf(solde)}`,
      m + padBox,
      y + 12
    );
    doc.setFont("helvetica", "normal");
    y += 22 + 5;
    y = appendLinesSized(
      doc,
      [
        `Montant dû (période) : ${formatMontantPdf(montantDu)} — Déjà payé : ${formatMontantPdf(montantPaye)}.`,
      ],
      m,
      y,
      wBox,
      PDF_TYPO.lineBody,
      PDF_TYPO.body
    );
    y += 4;
  }

  const bienParags = [
    `Correspondant à la location du bien situé : ${ligneBien || adresseBien || "—"}.`,
    `Pour la période du ${periode.labelPlage}.`,
  ];
  setFontBody(doc);
  const bienW = wBox - 2 * padBox;
  const bienLines = bienParags.flatMap((p) => doc.splitTextToSize(p, bienW));
  const bienH = padBox * 2 + bienLines.length * PDF_TYPO.lineBody + 3;
  ensureSpace(bienH + 12);
  encadreArrondi(
    doc,
    m,
    y,
    wBox,
    bienH,
    PDF_THEME.white,
    PDF_THEME.borderSoft,
    0.4
  );
  appendLinesSized(
    doc,
    bienParags,
    m + padBox,
    y + padBox + PDF_TYPO.lineBody,
    bienW,
    PDF_TYPO.lineBody,
    PDF_TYPO.body
  );
  y += bienH + gY.afterBien;

  if (contrat.numeroContratInterne.trim()) {
    ensureSpace(16);
    setFontBody(doc);
    y = appendLinesSized(
      doc,
      [`Référence interne du bail : ${contrat.numeroContratInterne.trim()}`],
      m,
      y,
      wBox,
      PDF_TYPO.lineBody,
      PDF_TYPO.body
    );
  }

  y += gY.beforeSign;
  ensureSpace(36);
  drawRGB(doc, PDF_THEME.borderAccent);
  doc.setLineWidth(0.4);
  doc.line(m, y, W - m, y);
  y += 7;

  const signataire =
    estSousLocation && sousBailleur
      ? nomCompletLocataire(sousBailleur)
      : bailleur?.nom.trim() || "Le bailleur";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.body);
  textRGB(doc, PDF_THEME.navy);
  doc.text(signataire, m, y);
  doc.setTextColor(0, 0, 0);
  y += PDF_TYPO.lineBody;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_TYPO.small);
  textRGB(doc, PDF_THEME.muted);
  doc.text(
    `Date ${periode.debutLabel} · Période ${periode.labelPlage}`,
    m,
    y
  );
  doc.setTextColor(0, 0, 0);
  y += 9;

  if (type !== "quittance" || obsTrim) {
    const obs =
      obsTrim ||
      "(Aucune observation — à compléter avant envoi officiel.)";
    doc.setFontSize(PDF_TYPO.small);
    const obsWrapW = wBox - 2 * padBox;
    const obsLines = doc.splitTextToSize(obs, obsWrapW);
    const obsH = padBox + 9 + obsLines.length * PDF_TYPO.lineSmall + padBox;
    ensureSpace(obsH + 18);
    encadreArrondi(
      doc,
      m,
      y,
      wBox,
      obsH,
      PDF_THEME.fillSection,
      PDF_THEME.borderSoft,
      0.35
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_TYPO.small);
    textRGB(doc, PDF_THEME.navy);
    doc.text("Observations", m + padBox, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    let yo = y + 11;
    for (const ln of obsLines) {
      doc.text(ln, m + padBox, yo);
      yo += PDF_TYPO.lineSmall;
    }
    y += obsH + 4;
  } else {
    y += 2;
  }

  ensureSpace(14);
  doc.setFontSize(PDF_TYPO.foot);
  textRGB(doc, PDF_THEME.muted);
  appendLinesSized(
    doc,
    [
      `Document généré par ${emetteurLib} — relire et compléter les mentions obligatoires avant envoi.`,
    ],
    m,
    y,
    wBox,
    3.5,
    PDF_TYPO.foot
  );

  const fileName = nomFichierDocumentMois(type, moisCle, logement?.titre);
  return { doc, fileName };
}

export function telechargerDocumentMoisPdf(opts: DocumentMoisPdfOptions): void {
  const { doc, fileName } = buildDocumentMoisPdf(opts);
  doc.save(fileName);
}
