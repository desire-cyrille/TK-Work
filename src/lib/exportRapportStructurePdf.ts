import { jsPDF } from "jspdf";
import {
  COL_ETAT_ID,
  TABLEAU_ETAT_LEGENDE,
  type TableauSuiviBloc,
  type TableauSuiviColonne,
} from "./tableauSuivi";

/** Bandeau type pièce jointe (bleu nuit). */
const NAVY: [number, number, number] = [31, 59, 102];
const MARGE = 15;
const PAGE_W = 210;
const MAX_TXT = 180;

export type PdfBlocTableauSuivi = {
  colonnes: TableauSuiviColonne[];
  blocs: TableauSuiviBloc[];
  /** Sous le titre « Tableau de suivi » (ex. jour + date d’enregistrement). */
  sousTitre?: string;
};

export type PdfSectionSite = {
  siteNom: string;
  sitePhotoDataUrl?: string;
  /** Une ou plusieurs images par domaine (mensuel : plusieurs jours). */
  domaines: { titre: string; texte: string; photoDataUrls?: string[] }[];
  /** Tableau de suivi (quotidien / brouillon unique). */
  tableauSuivi?: PdfBlocTableauSuivi;
  /** Plusieurs tableaux (ex. mensuel / fin de mission : premier & dernier jour). */
  tableauxSuivi?: PdfBlocTableauSuivi[];
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

const TABLEAU_ROW_H = 6.8;
const TABLEAU_HDR_H = 7.5;
/** Bas de zone utile avant saut (mm). */
const TABLEAU_PAGE_BOTTOM = 283;
const CELL_DOMAIN: [number, number, number] = [240, 244, 250];
const CELL_SUBJ: [number, number, number] = [248, 250, 252];
const CELL_BODY: [number, number, number] = [255, 255, 255];
const BORDER: [number, number, number] = [198, 206, 216];

function drawTableauSuiviPdf(
  doc: jsPDF,
  yStart: number,
  colonnes: TableauSuiviColonne[],
  blocs: TableauSuiviBloc[],
  sousTitre?: string,
): number {
  const nc = colonnes.length;
  if (!nc || !blocs.length) return yStart;

  /** Toujours une page dédiée (ne pas enchaîner après le texte des domaines). */
  doc.addPage();
  let y = MARGE;

  const x0 = MARGE;
  const wTot = MAX_TXT;
  const st = sousTitre?.trim() ?? "";
  const wLead =
    nc >= 2 ? Math.min(34, wTot * 0.19) : Math.max(wTot / nc, 14);
  const wLead2 = nc >= 2 ? Math.min(36, wTot * 0.2) : 0;
  const wData =
    nc > 2
      ? Math.max((wTot - wLead - wLead2) / (nc - 2), 13)
      : wTot / Math.max(nc, 1);

  function colW(i: number): number {
    if (nc === 1) return wTot;
    if (i === 0) return wLead;
    if (i === 1) return wLead2;
    return wData;
  }

  const inclutColonneEtat = colonnes.some((c) => c.id === COL_ETAT_ID);

  /** Hauteur légende état (mm), cohérente avec le dessin réel. */
  function hauteurLegendeEstimee(): number {
    if (!inclutColonneEtat) return 0;
    let h = 3 + 5 + 2;
    const sq = 2.6;
    const gapApresCarre = 3.5;
    for (const ent of TABLEAU_ETAT_LEGENDE) {
      const lines = doc.splitTextToSize(ent.label, wTot - sq - gapApresCarre - 2);
      h += Math.min(lines.length, 4) * 3.1 + 1;
    }
    return h + 2;
  }

  /** Hauteur dessinée : titre, en-tête, lignes, légende, marge de fin (mm). */
  function hauteurTableauDessinee(): number {
    let h = 8 + TABLEAU_HDR_H;
    if (st) {
      const subLines = doc.splitTextToSize(st, wTot);
      h += Math.min(subLines.length, 4) * 3.9 + 2;
    }
    for (const b of blocs) {
      h += Math.max(b.sujets.length, 1) * TABLEAU_ROW_H;
    }
    h += hauteurLegendeEstimee();
    h += 5 + 6;
    return h;
  }

  const extent = hauteurTableauDessinee();
  const fitsOnUnePage = MARGE + extent <= TABLEAU_PAGE_BOTTOM;
  /** Si false, tableau plus haut qu’une A4 : sauts entre blocs / légende. */
  const splitMode = !fitsOnUnePage;

  function pageBreakIf(needLocal: number) {
    if (!splitMode) return;
    if (y + needLocal > TABLEAU_PAGE_BOTTOM) {
      doc.addPage();
      y = MARGE;
    }
  }

  function drawCellText(
    text: string,
    x: number,
    yTop: number,
    cw: number,
    ch: number,
    bold = false,
  ) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(7);
    doc.setTextColor(32);
    if (!text.trim()) return;
    const parts = doc.splitTextToSize(text.trim(), Math.max(cw - 2, 4));
    const maxLines = Math.min(parts.length, Math.max(1, Math.floor(ch / 3.2)));
    const lineH = 3.15;
    const totalH = maxLines * lineH;
    const cx = x + cw / 2;
    let ty = yTop + (ch - totalH) / 2 + 3.35;
    for (let li = 0; li < maxLines; li++) {
      if (ty > yTop + ch - 0.5) break;
      doc.text(parts[li] as string, cx, ty, { align: "center" });
      ty += lineH;
    }
  }

  function drawCarreEtat(
    code: string,
    xi: number,
    rowY: number,
    cw: number,
  ) {
    const pad = 1.1;
    const side = Math.min(Math.max(cw - pad * 2, 2.8), TABLEAU_ROW_H - pad * 2, 5);
    const cx = xi + (cw - side) / 2;
    const cy = rowY + (TABLEAU_ROW_H - side) / 2;
    doc.setLineWidth(0.15);
    if (!code.trim()) {
      doc.setFillColor(250, 251, 252);
      doc.setDrawColor(...BORDER);
      doc.rect(cx, cy, side, side, "FD");
      return;
    }
    const ent = TABLEAU_ETAT_LEGENDE.find((e) => e.code === code.trim());
    const rgb = ent?.rgb ?? ([200, 200, 200] as const);
    doc.setFillColor(...rgb);
    doc.setDrawColor(
      Math.max(0, rgb[0] - 35),
      Math.max(0, rgb[1] - 35),
      Math.max(0, rgb[2] - 35),
    );
    doc.rect(cx, cy, side, side, "FD");
  }

  pageBreakIf(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Tableau de suivi", x0, y);
  y += 8;

  if (st) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(75, 82, 92);
    const subLines = doc.splitTextToSize(st, wTot);
    for (let si = 0; si < Math.min(subLines.length, 4); si++) {
      pageBreakIf(4);
      doc.text(subLines[si] as string, x0, y);
      y += 3.9;
    }
    y += 2;
    doc.setTextColor(0, 0, 0);
  }

  pageBreakIf(TABLEAU_HDR_H);
  let x = x0;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  for (let i = 0; i < nc; i++) {
    const cw = colW(i);
    doc.setFillColor(...NAVY);
    doc.rect(x, y, cw, TABLEAU_HDR_H, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.1);
    doc.rect(x, y, cw, TABLEAU_HDR_H, "S");
    doc.setTextColor(255, 255, 255);
    const lab = (colonnes[i].label || " ").trim() || "\u2014";
    const lines = doc.splitTextToSize(lab, Math.max(cw - 2, 4));
    const cx = x + cw / 2;
    let hy = y + 4.2;
    for (let hi = 0; hi < Math.min(lines.length, 2); hi++) {
      doc.text(lines[hi] as string, cx, hy, { align: "center" });
      hy += 3.1;
    }
    x += cw;
  }
  y += TABLEAU_HDR_H;

  for (const bloc of blocs) {
    const n = Math.max(bloc.sujets.length, 1);
    const blockH = n * TABLEAU_ROW_H;
    pageBreakIf(blockH + 2);

    x = x0;
    const w0 = colW(0);
    doc.setFillColor(...CELL_DOMAIN);
    doc.rect(x, y, w0, blockH, "F");
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.18);
    doc.rect(x, y, w0, blockH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    const domLines = doc.splitTextToSize(bloc.domaineLabel, w0 - 3);
    let dy = y + blockH / 2 - (Math.min(domLines.length, 3) * 3) / 2;
    for (let li = 0; li < Math.min(domLines.length, 4); li++) {
      doc.text(domLines[li] as string, x + w0 / 2, dy, { align: "center" });
      dy += 3.3;
    }
    const xAfterDom = x + w0;

    for (let ri = 0; ri < bloc.sujets.length; ri++) {
      const suj = bloc.sujets[ri];
      const rowY = y + ri * TABLEAU_ROW_H;
      let xi = xAfterDom;
      for (let ci = 1; ci < nc; ci++) {
        const cw = colW(ci);
        doc.setFillColor(...(ci === 1 ? CELL_SUBJ : CELL_BODY));
        doc.rect(xi, rowY, cw, TABLEAU_ROW_H, "F");
        doc.setDrawColor(...BORDER);
        doc.rect(xi, rowY, cw, TABLEAU_ROW_H, "S");
        const colId = colonnes[ci]?.id;
        if (inclutColonneEtat && colId === COL_ETAT_ID) {
          const code = (suj.cellules[colId] ?? "").trim();
          drawCarreEtat(code, xi, rowY, cw);
        } else {
          const txt = ci === 1 ? suj.sujet : colId ? (suj.cellules[colId] ?? "") : "";
          drawCellText(txt, xi, rowY, cw, TABLEAU_ROW_H, ci === 1);
        }
        xi += cw;
      }
    }
    y += blockH;
  }

  if (inclutColonneEtat) {
    pageBreakIf(22);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text("Légende — colonne État", x0, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(48, 55, 65);
    const sq = 2.6;
    const gapApresCarre = 3.5;
    for (const ent of TABLEAU_ETAT_LEGENDE) {
      pageBreakIf(8);
      doc.setFillColor(...ent.rgb);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.12);
      doc.rect(x0, y - sq + 0.6, sq, sq, "FD");
      const lines = doc.splitTextToSize(ent.label, wTot - sq - gapApresCarre - 2);
      let ly = y;
      for (let li = 0; li < Math.min(lines.length, 4); li++) {
        doc.text(lines[li] as string, x0 + sq + gapApresCarre, ly);
        ly += 3.1;
      }
      y = ly + 1;
    }
    y += 2;
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
    const tableauRempli = (t: { blocs: TableauSuiviBloc[] } | undefined) =>
      Boolean(t?.blocs?.some((b) => b.sujets.length > 0));
    const hasTableauPdf =
      input.inclureTableauSuiviPdf !== false &&
      (tableauRempli(section.tableauSuivi) ||
        Boolean(section.tableauxSuivi?.some((t) => tableauRempli(t))));
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

    if (input.inclureTableauSuiviPdf !== false) {
      if (section.tableauxSuivi?.length) {
        for (const t of section.tableauxSuivi) {
          if (!tableauRempli(t)) continue;
          y = drawTableauSuiviPdf(
            doc,
            y,
            t.colonnes,
            t.blocs,
            t.sousTitre,
          );
        }
      } else if (tableauRempli(section.tableauSuivi)) {
        y = drawTableauSuiviPdf(
          doc,
          y,
          section.tableauSuivi!.colonnes,
          section.tableauSuivi!.blocs,
          section.tableauSuivi!.sousTitre,
        );
      }
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
