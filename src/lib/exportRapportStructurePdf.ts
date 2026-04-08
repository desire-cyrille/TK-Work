import { jsPDF } from "jspdf";
import {
  COL_DOMAINE_ID,
  COL_ETAT_ID,
  COL_SUJET_ID,
  TABLEAU_ETAT_LEGENDE,
  type TableauSuiviBloc,
  type TableauSuiviColonne,
  type TableauSuiviSujetRow,
} from "./tableauSuivi";

/** Ligne affichée dans le PDF seulement si au moins un champ utile est renseigné. */
function tableauSujetRowRempliePourPdf(
  suj: TableauSuiviSujetRow,
  colonnes: TableauSuiviColonne[],
): boolean {
  if (suj.sujet.trim()) return true;
  if ((suj.cellules[COL_SUJET_ID] ?? "").trim()) return true;
  for (const c of colonnes) {
    const id = c.id;
    if (id === COL_DOMAINE_ID || id === COL_SUJET_ID) continue;
    if ((suj.cellules[id] ?? "").trim()) return true;
  }
  return false;
}

function filtrerBlocsTableauSuiviPourPdf(
  blocs: TableauSuiviBloc[],
  colonnes: TableauSuiviColonne[],
): TableauSuiviBloc[] {
  return blocs
    .map((b) => ({
      ...b,
      sujets: b.sujets.filter((s) =>
        tableauSujetRowRempliePourPdf(s, colonnes),
      ),
    }))
    .filter((b) => b.sujets.length > 0);
}

/** Style TK Pro (rouge + bandeau sombre), aligné sur l’app et tkpro.fr */
const BRAND_RED: [number, number, number] = [229, 57, 53];
const HERO_DARK: [number, number, number] = [26, 26, 28];
const MARGE = 15;
const PAGE_W = 210;
const MAX_TXT = 180;
/** Centre horizontal de la page A4 (mm) pour le texte centré. */
const PAGE_CENTER_X = PAGE_W / 2;

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

/**
 * Même critère que le rendu PDF : au moins une ligne avec sujet ou cellule utile
 * (les lignes entièrement vides sont exclues).
 */
export function tableauSuiviPdfANContenu(
  t: PdfBlocTableauSuivi | undefined,
  inclureTableauSuiviPdf: boolean | undefined,
): boolean {
  if (inclureTableauSuiviPdf === false) return false;
  return Boolean(
    t?.colonnes?.length &&
      filtrerBlocsTableauSuiviPourPdf(t.blocs, t.colonnes).length > 0,
  );
}

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

/** Hauteur d’image mise à l’échelle (mm), sans dessiner — aligné sur addImageFit. */
function estimateImageFitHeight(
  doc: jsPDF,
  dataUrl: string,
  maxW: number,
  maxH: number,
): number {
  try {
    const props = doc.getImageProperties(dataUrl);
    const ratio = props.width / props.height;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
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

/** Hauteur minimale d’une ligne de données (mm). */
const TABLEAU_ROW_H_MIN = 6.8;
const TABLEAU_HDR_H = 7.5;
/** Interligne texte cellule (mm). */
const TABLEAU_CELL_LINE_H = 3.15;
/** Marge verticale dans une cellule texte (mm). */
const TABLEAU_CELL_PAD_V = 1.15;
/** Limite de sécurité (lignes) pour éviter une ligne de tableau plus haute qu’une page. */
const TABLEAU_MAX_LINES_PAR_CELLULE = 28;
/** Bas de zone utile avant saut (mm). */
const TABLEAU_PAGE_BOTTOM = 283;
/** Espace entre la fin du texte site et le titre « Tableau de suivi » (mm). */
const TABLEAU_GAP_APRES_TEXTE = 8;
/** Hauteur mini restante pour enchaîner le tableau sur la page courante (titre + en-tête) (mm). */
const TABLEAU_MIN_RESTE_POUR_MEME_PAGE = 28;
const CELL_DOMAIN: [number, number, number] = [240, 244, 250];
const CELL_SUBJ: [number, number, number] = [248, 250, 252];
const CELL_BODY: [number, number, number] = [255, 255, 255];
const BORDER: [number, number, number] = [198, 206, 216];
/** Sous le bandeau titre site (mm). */
const SITE_CORPS_Y_DEBUT = 24;

/**
 * Hauteur verticale du bloc « Tableau de suivi » + légende (mm).
 * `blocsPdf` = blocs déjà filtrés (lignes vides exclues).
 */
function tableauSuiviExtentMm(
  doc: jsPDF,
  colonnes: TableauSuiviColonne[],
  blocsPdf: TableauSuiviBloc[],
  st: string,
): number {
  const nc = colonnes.length;
  const wTot = MAX_TXT;
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

  function nbLignesTexteDansCellule(txt: string, cw: number): number {
    const t = txt.trim();
    if (!t) return 1;
    const parts = doc.splitTextToSize(t, Math.max(cw - 2, 4));
    return Math.min(
      Math.max(1, parts.length),
      TABLEAU_MAX_LINES_PAR_CELLULE,
    );
  }

  function hauteurLignePourSujet(suj: TableauSuiviBloc["sujets"][number]): number {
    let maxLines = 1;
    for (let ci = 1; ci < nc; ci++) {
      const cw = colW(ci);
      const colId = colonnes[ci]?.id;
      if (inclutColonneEtat && colId === COL_ETAT_ID) continue;
      const cellTxt =
        ci === 1 ? suj.sujet : colId ? (suj.cellules[colId] ?? "") : "";
      maxLines = Math.max(maxLines, nbLignesTexteDansCellule(cellTxt, cw));
    }
    return Math.max(
      TABLEAU_ROW_H_MIN,
      maxLines * TABLEAU_CELL_LINE_H + TABLEAU_CELL_PAD_V * 2,
    );
  }

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

  let h = 8 + TABLEAU_HDR_H;
  if (st) {
    const subLines = doc.splitTextToSize(st, wTot);
    h += Math.min(subLines.length, 4) * 3.9 + 2;
  }
  for (const b of blocsPdf) {
    if (b.sujets.length === 0) {
      h += TABLEAU_ROW_H_MIN;
    } else {
      for (const suj of b.sujets) {
        h += hauteurLignePourSujet(suj);
      }
    }
  }
  h += hauteurLegendeEstimee();
  h += 5 + 6;
  return h;
}

/**
 * Vérifie si texte domaines + liste de tableaux tiennent sur une seule page sous le bandeau site,
 * et retourne la hauteur totale (mm) pour centrage vertical.
 */
function simulerHauteurSectionSiteUnePage(
  doc: jsPDF,
  section: PdfSectionSite,
  tableaux: PdfBlocTableauSuivi[],
): { unePage: boolean; hMm: number } {
  let y = SITE_CORPS_Y_DEBUT;
  const yMax = TABLEAU_PAGE_BOTTOM;
  const hPage = yMax - MARGE;

  if (section.sitePhotoDataUrl?.trim()) {
    y +=
      estimateImageFitHeight(doc, section.sitePhotoDataUrl, 90, 50) + 6;
  }

  for (const dom of section.domaines) {
    y += 7;
    const imgs = (dom.photoDataUrls ?? []).filter((u) => u?.trim());
    for (const dataUrl of imgs) {
      if (y > 200) return { unePage: false, hMm: 0 };
      y += estimateImageFitHeight(doc, dataUrl, MAX_TXT, 65) + 5;
    }
    if (dom.texte.trim()) {
      const parts = doc.splitTextToSize(dom.texte.trim(), MAX_TXT);
      for (const _line of parts) {
        if (y > yMax) return { unePage: false, hMm: 0 };
        y += 5;
      }
    }
    y += 5;
  }

  for (const t of tableaux) {
    const blocsPdf = filtrerBlocsTableauSuiviPourPdf(t.blocs, t.colonnes);
    if (!blocsPdf.length) continue;
    const st = t.sousTitre?.trim() ?? "";
    const extent = tableauSuiviExtentMm(doc, t.colonnes, blocsPdf, st);
    const yApresGap = y + TABLEAU_GAP_APRES_TEXTE;
    const espaceRestant = yMax - yApresGap;
    if (extent <= espaceRestant) {
      y = yApresGap + extent;
    } else if (extent <= hPage) {
      return { unePage: false, hMm: 0 };
    } else {
      return { unePage: false, hMm: 0 };
    }
  }

  return { unePage: true, hMm: y - SITE_CORPS_Y_DEBUT };
}

function drawTableauSuiviPdf(
  doc: jsPDF,
  yStart: number,
  colonnes: TableauSuiviColonne[],
  blocs: TableauSuiviBloc[],
  sousTitre?: string,
): number {
  const nc = colonnes.length;
  if (!nc || !blocs.length) return yStart;

  const blocsPdf = filtrerBlocsTableauSuiviPourPdf(blocs, colonnes);
  if (!blocsPdf.length) return yStart;

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

  function nbLignesTexteDansCellule(txt: string, cw: number): number {
    const t = txt.trim();
    if (!t) return 1;
    const parts = doc.splitTextToSize(t, Math.max(cw - 2, 4));
    return Math.min(
      Math.max(1, parts.length),
      TABLEAU_MAX_LINES_PAR_CELLULE,
    );
  }

  function hauteurLignePourSujet(suj: TableauSuiviBloc["sujets"][number]): number {
    let maxLines = 1;
    for (let ci = 1; ci < nc; ci++) {
      const cw = colW(ci);
      const colId = colonnes[ci]?.id;
      if (inclutColonneEtat && colId === COL_ETAT_ID) continue;
      const cellTxt =
        ci === 1 ? suj.sujet : colId ? (suj.cellules[colId] ?? "") : "";
      maxLines = Math.max(maxLines, nbLignesTexteDansCellule(cellTxt, cw));
    }
    return Math.max(
      TABLEAU_ROW_H_MIN,
      maxLines * TABLEAU_CELL_LINE_H + TABLEAU_CELL_PAD_V * 2,
    );
  }

  /** Hauteur légende état (mm), cohérente avec le dessin réel. */
  const extent = tableauSuiviExtentMm(doc, colonnes, blocsPdf, st);
  const maxY = TABLEAU_PAGE_BOTTOM;
  const yApresSeparation = yStart + TABLEAU_GAP_APRES_TEXTE;
  const espaceRestant = maxY - yApresSeparation;
  const hauteurPageUtile = maxY - MARGE;

  let y: number;
  if (extent <= espaceRestant) {
    /** Tout le tableau tient sous le contenu site sur la page courante. */
    y = yApresSeparation;
  } else if (extent <= hauteurPageUtile) {
    /** Une page entière suffit, mais pas dans l’espace restant : page dédiée. */
    doc.addPage();
    y = MARGE;
  } else {
    /** Tableau multi-pages : enchaîner si assez de place pour titre + en-tête, sinon saut. */
    if (espaceRestant >= TABLEAU_MIN_RESTE_POUR_MEME_PAGE) {
      y = yApresSeparation;
    } else {
      doc.addPage();
      y = MARGE;
    }
  }

  /** Sauts internes si le bloc ne tient pas jusqu’en bas de page à partir de `y`. */
  let splitMode = y + extent > maxY;
  if (y === MARGE && !splitMode) {
    const zone = maxY - MARGE;
    y = MARGE + Math.max(0, (zone - extent) / 2);
    splitMode = y + extent > maxY;
  }

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
    const raw = text.trim();
    if (!raw) return;
    let parts = doc.splitTextToSize(raw, Math.max(cw - 2, 4)) as string[];
    if (parts.length > TABLEAU_MAX_LINES_PAR_CELLULE) {
      parts = parts.slice(0, TABLEAU_MAX_LINES_PAR_CELLULE);
      const last = parts[parts.length - 1] ?? "";
      parts[parts.length - 1] =
        last.length > 4 ? `${last.slice(0, last.length - 4)}…` : `${last}…`;
    }
    const lineH = TABLEAU_CELL_LINE_H;
    const totalH = parts.length * lineH;
    const cx = x + cw / 2;
    const ty0 = yTop + (ch - totalH) / 2 + lineH * 0.28;
    let ty = ty0;
    for (const line of parts) {
      doc.text(line, cx, ty, { align: "center" });
      ty += lineH;
    }
  }

  function drawCarreEtat(
    code: string,
    xi: number,
    rowY: number,
    cw: number,
    rowH: number,
  ) {
    const pad = 1.1;
    const side = Math.min(
      Math.max(cw - pad * 2, 2.8),
      rowH - pad * 2,
      5,
    );
    const cx = xi + (cw - side) / 2;
    const cy = rowY + (rowH - side) / 2;
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
  doc.setTextColor(...BRAND_RED);
  doc.text("Tableau de suivi", PAGE_CENTER_X, y, { align: "center" });
  y += 8;

  if (st) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(75, 82, 92);
    const subLines = doc.splitTextToSize(st, wTot);
    for (let si = 0; si < Math.min(subLines.length, 4); si++) {
      pageBreakIf(4);
      doc.text(subLines[si] as string, PAGE_CENTER_X, y, { align: "center" });
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
    doc.setFillColor(...BRAND_RED);
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

  for (const bloc of blocsPdf) {
    const rowHeights =
      bloc.sujets.length === 0
        ? [TABLEAU_ROW_H_MIN]
        : bloc.sujets.map((suj) => hauteurLignePourSujet(suj));
    const blockH = rowHeights.reduce((acc, h) => acc + h, 0);
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
    doc.setTextColor(...BRAND_RED);
    const domLines = doc.splitTextToSize(bloc.domaineLabel, w0 - 3);
    let dy = y + blockH / 2 - (Math.min(domLines.length, 3) * 3) / 2;
    for (let li = 0; li < Math.min(domLines.length, 4); li++) {
      doc.text(domLines[li] as string, x + w0 / 2, dy, { align: "center" });
      dy += 3.3;
    }
    const xAfterDom = x + w0;

    let yRow = y;
    for (let ri = 0; ri < bloc.sujets.length; ri++) {
      const suj = bloc.sujets[ri];
      const rowH = rowHeights[ri] ?? TABLEAU_ROW_H_MIN;
      const rowY = yRow;
      yRow += rowH;
      let xi = xAfterDom;
      for (let ci = 1; ci < nc; ci++) {
        const cw = colW(ci);
        doc.setFillColor(...(ci === 1 ? CELL_SUBJ : CELL_BODY));
        doc.rect(xi, rowY, cw, rowH, "F");
        doc.setDrawColor(...BORDER);
        doc.rect(xi, rowY, cw, rowH, "S");
        const colId = colonnes[ci]?.id;
        if (inclutColonneEtat && colId === COL_ETAT_ID) {
          const code = (suj.cellules[colId] ?? "").trim();
          drawCarreEtat(code, xi, rowY, cw, rowH);
        } else {
          const txt = ci === 1 ? suj.sujet : colId ? (suj.cellules[colId] ?? "") : "";
          drawCellText(txt, xi, rowY, cw, rowH, ci === 1);
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
    doc.setTextColor(...BRAND_RED);
    doc.text("Légende — colonne État", PAGE_CENTER_X, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(48, 55, 65);
    const sq = 2.6;
    const gapApresCarre = 3.5;
    const labelMaxW = wTot - sq - gapApresCarre - 2;
    for (const ent of TABLEAU_ETAT_LEGENDE) {
      pageBreakIf(8);
      const lines = doc.splitTextToSize(ent.label, labelMaxW);
      let maxLineW = 0;
      for (let li = 0; li < Math.min(lines.length, 4); li++) {
        maxLineW = Math.max(maxLineW, doc.getTextWidth(lines[li] as string));
      }
      const rowW = sq + gapApresCarre + maxLineW;
      const rowStartX = PAGE_CENTER_X - rowW / 2;
      doc.setFillColor(...ent.rgb);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.12);
      doc.rect(rowStartX, y - sq + 0.6, sq, sq, "FD");
      let ly = y;
      for (let li = 0; li < Math.min(lines.length, 4); li++) {
        doc.text(lines[li] as string, rowStartX + sq + gapApresCarre, ly);
        ly += 3.1;
      }
      y = ly + 1;
    }
    y += 2;
  }

  return y + 5;
}

/** Sous le bandeau sombre de la page de garde PDF (mm). */
const GARDE_CORPS_Y0 = 46;
/** Au-delà de cette ordonnée, suiteBloc enchaîne sur une nouvelle page. */
const GARDE_SUITE_Y_MAX = 270;

/**
 * Simule la fin du corps de page de garde (couverture + cadre + blocs émetteur/client/mission)
 * pour une position de départ donnée.
 */
function simulerFinYCorpsPageGarde(
  doc: jsPDF,
  input: ExportRapportPdfInput,
  yStart: number,
): { finY: number; depasseUnePage: boolean } {
  let y = yStart;
  let depasseUnePage = false;

  if (input.couvertureDataUrl?.trim()) {
    y +=
      estimateImageFitHeight(doc, input.couvertureDataUrl, MAX_TXT, 72) + 8;
  }

  const boxH = Math.min(70, 278 - y - 30);
  const yBoxTop = y;
  let yi = y + 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  for (const _ of doc.splitTextToSize(input.titreDocument, MAX_TXT - 10)) {
    yi += 6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  yi += 6;
  yi += 8;

  doc.setFont("helvetica", "bold");
  yi += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const _ of input.sitesNomsListe) {
    if (yi > yBoxTop + boxH - 6) break;
    yi += 4.5;
  }

  y = yBoxTop + boxH + 10;

  const simSuiteBloc = (lines: string[], size = 9) => {
    const nonempty = lines.filter((l) => l.trim());
    if (!nonempty.length) return;
    y += 6;
    for (const line of nonempty) {
      const parts = doc.splitTextToSize(line, MAX_TXT);
      for (const _ of parts) {
        if (y > GARDE_SUITE_Y_MAX) {
          depasseUnePage = true;
          return;
        }
        y += size === 9 ? 4.6 : 5;
      }
    }
    y += 5;
  };

  if (input.coordonneesEmetteur?.trim()) {
    simSuiteBloc(input.coordonneesEmetteur.split("\n"), 9);
  }
  if (depasseUnePage) return { finY: y, depasseUnePage: true };
  if (input.clientRaisonSociale?.trim() || input.clientCoordonnees?.trim()) {
    const cli: string[] = [];
    if (input.clientRaisonSociale?.trim()) cli.push(input.clientRaisonSociale.trim());
    if (input.clientCoordonnees?.trim()) cli.push(...input.clientCoordonnees.split("\n"));
    simSuiteBloc(cli, 9);
  }
  if (depasseUnePage) return { finY: y, depasseUnePage: true };
  if (input.missionLignes?.filter((l) => l.trim()).length) {
    simSuiteBloc(input.missionLignes!, 9);
  }

  return { finY: y, depasseUnePage };
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

  // —— Page de garde : bandeau sombre + accent rouge + pastille (comme l’app) ——
  const BAND_H = 40;
  doc.setFillColor(...HERO_DARK);
  doc.rect(0, 0, PAGE_W, BAND_H, "F");

  if (input.logoDataUrl?.trim()) {
    addImageFit(doc, input.logoDataUrl, 12, 8, 24, 16);
  }
  if (input.logoClientDataUrl?.trim()) {
    addImageAlignedRight(doc, input.logoClientDataUrl, 8, 12, 26, 18);
  }

  const accentBarX = input.logoDataUrl?.trim() ? 40 : 14;
  const textStart = accentBarX + 2.8;
  const pillX = 118;
  const pillRightPad = input.logoClientDataUrl?.trim() ? 38 : 11;
  const maxTitleW = Math.max(34, pillX - textStart - 4);

  doc.setFillColor(...BRAND_RED);
  doc.rect(accentBarX, 11, 1.35, 18, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  let tyBandeau = 16;
  for (const ln of doc.splitTextToSize(input.titreBandeau, maxTitleW)) {
    if (tyBandeau > 29) break;
    doc.text(ln, textStart, tyBandeau);
    tyBandeau += 5.4;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(232, 232, 236);
  doc.text(
    input.typeRapportLibelle,
    textStart,
    Math.min(tyBandeau + 1.2, 34),
  );

  const pillW = PAGE_W - pillX - pillRightPad;
  const pillH = 24;
  const pillY = (BAND_H - pillH) / 2;
  doc.setFillColor(...BRAND_RED);
  doc.roundedRect(pillX, pillY, pillW, pillH, 11, 11, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const pillLines = doc.splitTextToSize(input.titreBandeau, pillW - 8);
  let py = pillY + pillH / 2 - (Math.min(pillLines.length, 2) * 4) / 2 + 3;
  for (let pi = 0; pi < Math.min(pillLines.length, 2); pi++) {
    doc.text(pillLines[pi] as string, pillX + pillW / 2, py, {
      align: "center",
    });
    py += 4.1;
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  let padTopGarde = 0;
  const simGarde0 = simulerFinYCorpsPageGarde(doc, input, GARDE_CORPS_Y0);
  if (!simGarde0.depasseUnePage) {
    const hGarde = simGarde0.finY - GARDE_CORPS_Y0;
    const zoneGarde = GARDE_SUITE_Y_MAX - GARDE_CORPS_Y0;
    if (hGarde > 0 && hGarde < zoneGarde) {
      padTopGarde = (zoneGarde - hGarde) / 2;
      const simGarde1 = simulerFinYCorpsPageGarde(
        doc,
        input,
        GARDE_CORPS_Y0 + padTopGarde,
      );
      if (simGarde1.depasseUnePage || simGarde1.finY > GARDE_SUITE_Y_MAX) {
        padTopGarde = 0;
      }
    }
  }

  let y = GARDE_CORPS_Y0 + padTopGarde;
  if (input.couvertureDataUrl?.trim()) {
    const hIm = addImageFit(doc, input.couvertureDataUrl, MARGE, y, MAX_TXT, 72);
    y += hIm + 8;
  }

  doc.setFillColor(252, 248, 247);
  const boxH = Math.min(70, 278 - y - 30);
  if (boxH > 18) {
    doc.roundedRect(MARGE, y, MAX_TXT, boxH, 2, 2, "F");
    doc.setDrawColor(...BRAND_RED);
    doc.setLineWidth(0.35);
    doc.roundedRect(MARGE, y, MAX_TXT, boxH, 2, 2, "S");
  }

  let yi = y + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_RED);
  for (const part of doc.splitTextToSize(input.titreDocument, MAX_TXT - 10)) {
    doc.text(part, PAGE_CENTER_X, yi, { align: "center" });
    yi += 6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(45);
  doc.text(`Période : ${input.periodeLibelle}`, PAGE_CENTER_X, yi, {
    align: "center",
  });
  yi += 6;
  doc.text(input.genereLeLibelle, PAGE_CENTER_X, yi, { align: "center" });
  yi += 8;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_RED);
  doc.text("Sites", PAGE_CENTER_X, yi, { align: "center" });
  yi += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const nom of input.sitesNomsListe) {
    if (yi > y + boxH - 6) break;
    doc.text(`• ${nom}`, PAGE_CENTER_X, yi, { align: "center" });
    yi += 4.5;
  }

  y = y + boxH + 10;

  const suiteBloc = (lines: string[], titre: string, size = 9) => {
    if (!lines.filter((l) => l.trim()).length) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_RED);
    doc.text(titre, PAGE_CENTER_X, y, { align: "center" });
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
        doc.text(part, PAGE_CENTER_X, y, { align: "center" });
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
      tableauSuiviPdfANContenu(
        section.tableauSuivi,
        input.inclureTableauSuiviPdf,
      ) ||
      Boolean(
        section.tableauxSuivi?.some((t) =>
          tableauSuiviPdfANContenu(t, input.inclureTableauSuiviPdf),
        ),
      );
    /* Pas de page site si aucun domaine (texte / photos d’axes) ni tableau utile. */
    if (!section.domaines.length && !hasTableauPdf) {
      continue;
    }

    doc.addPage();
    y = MARGE;

    doc.setFillColor(...HERO_DARK);
    doc.rect(0, 0, PAGE_W, 16, "F");
    doc.setFillColor(...BRAND_RED);
    doc.rect(12, 4.5, 1.2, 7, "F");
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
    const nSiteLines = Math.min(lignesSite.length, 2);
    let lySite = nSiteLines <= 1 ? 10 : 7;
    for (let si = 0; si < nSiteLines; si++) {
      doc.text(lignesSite[si] as string, PAGE_CENTER_X, lySite, {
        align: "center",
      });
      lySite += 5.2;
    }
    doc.setTextColor(0, 0, 0);

    const listeTableauxSite: PdfBlocTableauSuivi[] = [];
    if (input.inclureTableauSuiviPdf !== false) {
      if (section.tableauxSuivi?.length) {
        for (const t of section.tableauxSuivi) {
          if (tableauSuiviPdfANContenu(t, input.inclureTableauSuiviPdf)) {
            listeTableauxSite.push(t);
          }
        }
      } else if (
        tableauSuiviPdfANContenu(
          section.tableauSuivi,
          input.inclureTableauSuiviPdf,
        )
      ) {
        listeTableauxSite.push(section.tableauSuivi!);
      }
    }
    const simSite = simulerHauteurSectionSiteUnePage(
      doc,
      section,
      listeTableauxSite,
    );
    const zoneCorpsSite = TABLEAU_PAGE_BOTTOM - SITE_CORPS_Y_DEBUT;
    y =
      SITE_CORPS_Y_DEBUT +
      (simSite.unePage && simSite.hMm > 0
        ? Math.max(0, (zoneCorpsSite - simSite.hMm) / 2)
        : 0);

    if (section.sitePhotoDataUrl?.trim()) {
      const h = addImageFit(doc, section.sitePhotoDataUrl, MARGE, y, 90, 50);
      y += h + 6;
    }

    for (const dom of section.domaines) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...BRAND_RED);
      doc.text(dom.titre, PAGE_CENTER_X, y, { align: "center" });
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
          doc.text(part, PAGE_CENTER_X, y, { align: "center" });
          y += 5;
        }
      }
      y += 5;
    }

    if (input.inclureTableauSuiviPdf !== false) {
      for (const t of listeTableauxSite) {
        y = drawTableauSuiviPdf(
          doc,
          y,
          t.colonnes,
          t.blocs,
          t.sousTitre,
        );
      }
    }
  }

  const syn = input.synthese.trim();
  if (syn) {
    doc.addPage();
    const partsSyn = doc.splitTextToSize(syn, MAX_TXT);
    const hSynBloc = 13 + partsSyn.length * 5;
    const zoneSyn = TABLEAU_PAGE_BOTTOM - MARGE;
    y =
      MARGE +
      (hSynBloc < zoneSyn ? Math.max(0, (zoneSyn - hSynBloc) / 2) : 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BRAND_RED);
    doc.text("Synthèse", PAGE_CENTER_X, y, { align: "center" });
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(25);
    for (const part of partsSyn) {
      if (y > 275) {
        doc.addPage();
        y = MARGE;
      }
      doc.text(part, PAGE_CENTER_X, y, { align: "center" });
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
