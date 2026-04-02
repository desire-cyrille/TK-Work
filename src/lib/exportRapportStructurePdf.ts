import { jsPDF } from "jspdf";
import type { TableauSuiviColonne, TableauSuiviLigne } from "./tableauSuivi";

/** Bandeau type pièce jointe (bleu nuit). */
const NAVY: [number, number, number] = [31, 59, 102];
const MARGE = 15;
const PAGE_W = 210;
const MAX_TXT = 180;

export type PdfSectionSite = {
  siteNom: string;
  sitePhotoDataUrl?: string;
  /** Une ou plusieurs images par domaine (mensuel : plusieurs jours). */
  domaines: { titre: string; texte: string; photoDataUrls?: string[] }[];
  /** Tableau de suivi (même colonnes que le projet). */
  tableauSuivi?: {
    colonnes: TableauSuiviColonne[];
    lignes: TableauSuiviLigne[];
  };
};

export type ExportRapportPdfInput = {
  projetTitre: string;
  couvertureDataUrl?: string;
  /** Logo émetteur / structure : haut gauche du bandeau. */
  logoDataUrl?: string;
  /** Logo client : haut droite du bandeau (page de garde et sections site). */
  logoClientDataUrl?: string;
  /** Ex. « La Familiale — Rapport d’activité » */
  titreBandeau: string;
  typeRapportLibelle: string;
  titreDocument: string;
  periodeLibelle: string;
  genereLeLibelle: string;
  sitesNomsListe: string[];
  coordonneesEmetteur?: string;
  clientRaisonSociale?: string;
  clientCoordonnees?: string;
  missionLignes?: string[];
  sectionsParSite: PdfSectionSite[];
  synthese: string;
  piedDePage: string;
  nomFichierPrefix: string;
  /** Si `false`, le tableau de suivi n’est pas dessiné (défaut : affiché). */
  inclureTableauSuiviPdf?: boolean;
}

function imgFmt(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.includes("image/png") || dataUrl.includes("PNG") ? "PNG" : "JPEG";
}

function addImageFit(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
): number {
  try {
    const fmt = imgFmt(dataUrl);
    const props = doc.getImageProperties(dataUrl);
    const ratio = props.width / props.height;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    doc.addImage(dataUrl, fmt, x, y, w, h);
    return h;
  } catch {
    return 0;
  }
}

/** Logo aligné à droite ; retourne la largeur utilisée (0 si échec). */
function addImageAlignedRight(
  doc: jsPDF,
  dataUrl: string,
  top: number,
  rightMargin: number,
  maxW: number,
  maxH: number,
): number {
  try {
    const fmt = imgFmt(dataUrl);
    const props = doc.getImageProperties(dataUrl);
    const ratio = props.width / props.height;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    const x = PAGE_W - rightMargin - w;
    doc.addImage(dataUrl, fmt, x, top, w, h);
    return w;
  } catch {
    return 0;
  }
}

const TABLEAU_ROW_H = 6.5;
const TABLEAU_HDR_H = 7.5;
const CELL_LIGHT: [number, number, number] = [236, 241, 248];

function drawTableauSuiviPdf(
  doc: jsPDF,
  yStart: number,
  colonnes: TableauSuiviColonne[],
  lignes: TableauSuiviLigne[],
): number {
  const nc = colonnes.length;
  if (!nc || !lignes.length) return yStart;

  let y = yStart;
  const x0 = MARGE;
  const wTot = MAX_TXT;
  const wLead =
    nc >= 2 ? Math.min(36, wTot * 0.2) : Math.max(wTot / nc, 14);
  const wLead2 = nc >= 2 ? Math.min(40, wTot * 0.22) : 0;
  const wData =
    nc > 2
      ? Math.max((wTot - wLead - wLead2) / (nc - 2), 14)
      : wTot / Math.max(nc, 1);

  function colW(i: number): number {
    if (nc === 1) return wTot;
    if (i === 0) return wLead;
    if (i === 1) return wLead2;
    return wData;
  }

  function pageBreakIf(need: number) {
    if (y + need > 283) {
      doc.addPage();
      y = MARGE;
    }
  }

  pageBreakIf(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Tableau de suivi", x0, y);
  y += 8;

  pageBreakIf(TABLEAU_HDR_H);
  let x = x0;
  doc.setFontSize(7);
  for (let i = 0; i < nc; i++) {
    const cw = colW(i);
    doc.setFillColor(...NAVY);
    doc.rect(x, y, cw, TABLEAU_HDR_H, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.12);
    doc.rect(x, y, cw, TABLEAU_HDR_H, "S");
    doc.setTextColor(255, 255, 255);
    const lab = (colonnes[i].label || " ").trim() || "\u2014";
    const lines = doc.splitTextToSize(lab, Math.max(cw - 2, 4));
    doc.text((lines[0] as string) || "\u2014", x + 1, y + 5);
    x += cw;
  }
  y += TABLEAU_HDR_H;

  doc.setTextColor(38);
  for (const ligne of lignes) {
    pageBreakIf(TABLEAU_ROW_H);
    x = x0;
    for (let i = 0; i < nc; i++) {
      const cw = colW(i);
      const cid = colonnes[i].id;
      const raw = (ligne.cellules[cid] ?? "").trim();
      if (i < 2) {
        doc.setFillColor(...CELL_LIGHT);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(x, y, cw, TABLEAU_ROW_H, "F");
      doc.setDrawColor(175, 184, 195);
      doc.setLineWidth(0.18);
      doc.rect(x, y, cw, TABLEAU_ROW_H, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(35);
      if (raw) {
        const parts = doc.splitTextToSize(raw, Math.max(cw - 2, 4));
        let ty = y + 4.5;
        for (let li = 0; li < Math.min(parts.length, 2); li++) {
          doc.text(parts[li] as string, x + 1, ty);
          ty += 3.1;
        }
      }
      x += cw;
    }
    y += TABLEAU_ROW_H;
  }

  return y + 5;
}

function appliquerPiedsDePage(doc: jsPDF, pied: string) {
  const total = doc.getNumberOfPages();
  const lines = pied.trim() ? doc.splitTextToSize(pied.trim(), MAX_TXT) : [];
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    let py = 292;
    for (let j = lines.length - 1; j >= 0; j--) {
      doc.text(lines[j] as string, PAGE_W / 2, py, { align: "center" });
      py -= 3.2;
    }
    doc.setTextColor(0);
  }
}

/**
 * Génère le PDF structuré (page de garde façon rapport d’entretien, corps par site, synthèse).
 * Les domaines vides (sans texte ni photo) sont exclus côté appelant.
 */
export function buildRapportPdfBlob(input: ExportRapportPdfInput): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  function drawPageFooterPlaceholders() {
    /* réservé si besoin d’entête répétée ; le pied global est appliqué à la fin */
  }

  // —— Page de garde ——
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 40, "F");

  if (input.logoDataUrl?.trim()) {
    addImageFit(doc, input.logoDataUrl, 12, 8, 24, 16);
  }
  if (input.logoClientDataUrl?.trim()) {
    addImageAlignedRight(doc, input.logoClientDataUrl, 8, 12, 26, 18);
  }

  const lxBandeau = MARGE + (input.logoDataUrl ? 28 : 0);
  const reserveDroiteBandeau = input.logoClientDataUrl?.trim() ? 34 : MARGE;
  const largeurTexteBandeau = Math.max(
    60,
    PAGE_W - lxBandeau - reserveDroiteBandeau,
  );
  let tyBandeau = 14;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  for (const ln of doc.splitTextToSize(input.titreBandeau, largeurTexteBandeau)) {
    if (tyBandeau > 36) break;
    doc.text(ln, lxBandeau, tyBandeau);
    tyBandeau += 6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(input.typeRapportLibelle, lxBandeau, Math.min(tyBandeau + 2, 36));
  doc.setTextColor(0, 0, 0);

  let y = 46;
  if (input.couvertureDataUrl?.trim()) {
    const hIm = addImageFit(doc, input.couvertureDataUrl, MARGE, y, MAX_TXT, 72);
    y += hIm + 8;
  }

  doc.setFillColor(240, 245, 250);
  const boxH = Math.min(70, 278 - y - 30);
  if (boxH > 18) {
    doc.roundedRect(MARGE, y, MAX_TXT, boxH, 2, 2, "F");
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.35);
    doc.roundedRect(MARGE, y, MAX_TXT, boxH, 2, 2, "S");
  }

  let yi = y + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  for (const part of doc.splitTextToSize(input.titreDocument, MAX_TXT - 10)) {
    doc.text(part, MARGE + 4, yi);
    yi += 6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(45);
  doc.text(`Période : ${input.periodeLibelle}`, MARGE + 4, yi);
  yi += 6;
  doc.text(input.genereLeLibelle, MARGE + 4, yi);
  yi += 8;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Sites", MARGE + 4, yi);
  yi += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const nom of input.sitesNomsListe) {
    if (yi > y + boxH - 6) break;
    doc.text(`• ${nom}`, MARGE + 6, yi);
    yi += 4.5;
  }

  y = y + boxH + 10;

  const suiteBloc = (lines: string[], titre: string, size = 9) => {
    if (!lines.filter((l) => l.trim()).length) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(titre, MARGE, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(35);
    for (const line of lines) {
      for (const part of doc.splitTextToSize(line, MAX_TXT)) {
        if (y > 270) {
          doc.addPage();
          y = MARGE;
          drawPageFooterPlaceholders();
        }
        doc.text(part, MARGE, y);
        y += size === 9 ? 4.6 : 5;
      }
    }
    y += 5;
  };

  if (input.coordonneesEmetteur?.trim()) {
    suiteBloc(input.coordonneesEmetteur.split("\n"), "Émetteur", 9);
  }
  if (input.clientRaisonSociale?.trim() || input.clientCoordonnees?.trim()) {
    const cli: string[] = [];
    if (input.clientRaisonSociale?.trim()) cli.push(input.clientRaisonSociale.trim());
    if (input.clientCoordonnees?.trim()) cli.push(...input.clientCoordonnees.split("\n"));
    suiteBloc(cli, "Client", 9);
  }
  if (input.missionLignes?.filter((l) => l.trim()).length) {
    suiteBloc(input.missionLignes!, "Mission", 9);
  }

  // —— Corps : une section par site (intercalaire) ——
  for (const section of input.sectionsParSite) {
    const hasTableauPdf =
      input.inclureTableauSuiviPdf !== false &&
      Boolean(section.tableauSuivi?.lignes?.length);
    if (
      !section.domaines.length &&
      !section.sitePhotoDataUrl?.trim() &&
      !hasTableauPdf
    ) {
      continue;
    }

    doc.addPage();
    y = MARGE;

    doc.setFillColor(...NAVY);
    doc.rect(0, 0, PAGE_W, 16, "F");
    if (input.logoClientDataUrl?.trim()) {
      addImageAlignedRight(doc, input.logoClientDataUrl, 2.5, 10, 22, 11);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    const titreSiteW = input.logoClientDataUrl?.trim()
      ? PAGE_W - MARGE - 40 - MARGE
      : MAX_TXT;
    const lignesSite = doc.splitTextToSize(section.siteNom, titreSiteW);
    if (lignesSite[0]) doc.text(lignesSite[0], MARGE, 10);
    doc.setTextColor(0, 0, 0);
    y = 24;

    if (section.sitePhotoDataUrl?.trim()) {
      const h = addImageFit(doc, section.sitePhotoDataUrl, MARGE, y, 90, 50);
      y += h + 6;
    }

    for (const dom of section.domaines) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      doc.text(dom.titre, MARGE, y);
      y += 7;
      doc.setTextColor(30);

      const imgs = (dom.photoDataUrls ?? []).filter((u) => u?.trim());
      for (const dataUrl of imgs) {
        if (y > 200) {
          doc.addPage();
          y = MARGE;
        }
        const h = addImageFit(doc, dataUrl, MARGE, y, MAX_TXT, 65);
        y += h + 5;
      }

      if (dom.texte.trim()) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        for (const part of doc.splitTextToSize(dom.texte.trim(), MAX_TXT)) {
          if (y > 275) {
            doc.addPage();
            y = MARGE;
          }
          doc.text(part, MARGE, y);
          y += 5;
        }
      }
      y += 5;
    }

    if (hasTableauPdf && section.tableauSuivi) {
      y = drawTableauSuiviPdf(
        doc,
        y,
        section.tableauSuivi.colonnes,
        section.tableauSuivi.lignes,
      );
    }
  }

  const syn = input.synthese.trim();
  if (syn) {
    doc.addPage();
    y = MARGE;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text("Synthèse", MARGE, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(25);
    for (const part of doc.splitTextToSize(syn, MAX_TXT)) {
      if (y > 275) {
        doc.addPage();
        y = MARGE;
      }
      doc.text(part, MARGE, y);
      y += 5;
    }
  }

  const pied =
    input.piedDePage.trim() ||
    "Document généré depuis le module Rapport — données locales.";
  appliquerPiedsDePage(doc, pied);
  return doc.output("blob");
}

export function telechargerRapportPdfDepuisBlob(
  input: Pick<ExportRapportPdfInput, "titreDocument" | "nomFichierPrefix">,
  blob: Blob,
): void {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  const safe = input.titreDocument
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 50);
  a.download = `${input.nomFichierPrefix}${safe || "rapport"}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
