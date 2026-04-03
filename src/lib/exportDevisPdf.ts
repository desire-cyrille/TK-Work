import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { jsPDF } from "jspdf";
import {
  PDF_CATEGORIE_COULEUR,
  lignesBudgetPourPdf,
  type LigneBudget,
} from "./devisCalcul";
import { lireParametresDevisDefaut } from "./devisDefaultsStorage";
import { formatEuro } from "./money";
import type { Devis } from "./devisStorage";
import { PIED_PAGE_PDF_DEFAUT, type TarifsZone } from "./devisTypes";

type TotauxBudget = {
  lignes: LigneBudget[];
  sousTotalHt: number;
  fraisGestion: number;
  totalHt: number;
};

const W = 210;
const H = 297;
const M = 16;
const TEXT_W = W - 2 * M;
/** Réserve bas de page pour le pied dessiné ensuite (pdf-lib). */
const RESERVE_BAS_MM = 34;

const MM_TO_PT = 2.834645669;

function setFill(doc: jsPDF, rgbC: [number, number, number]) {
  doc.setFillColor(rgbC[0], rgbC[1], rgbC[2]);
}

function setText(doc: jsPDF, rgbC: [number, number, number]) {
  doc.setTextColor(rgbC[0], rgbC[1], rgbC[2]);
}

function remplirPageBlanche(doc: jsPDF) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");
}

function pageGarde(doc: jsPDF, d: Devis) {
  const { theme, contenu } = d;
  setFill(doc, theme.gardeFond);
  doc.rect(0, 0, W, H, "F");
  setText(doc, theme.gardeTexte);

  let y = H * 0.36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  const titre = contenu.titrePageGarde.trim() || "PROPOSITION";
  for (const line of doc.splitTextToSize(titre, TEXT_W)) {
    doc.text(line, W / 2, y, { align: "center" });
    y += 10;
  }
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  const sous = contenu.sousTitrePageGarde.trim();
  if (sous) {
    for (const line of doc.splitTextToSize(sous, TEXT_W)) {
      doc.text(line, W / 2, y, { align: "center" });
      y += 7;
    }
  }
  y += 16;
  doc.setFontSize(11);
  const clientLine = d.clientEstSociete
    ? d.clientSociete?.trim() || d.client.trim()
    : d.client.trim();
  if (clientLine) {
    doc.text(clientLine, W / 2, y, { align: "center" });
    y += 6;
  }
  const adr = d.clientAdresse?.trim();
  if (adr) {
    for (const line of doc.splitTextToSize(adr, TEXT_W - 20)) {
      doc.text(line, W / 2, y, { align: "center" });
      y += 5.5;
    }
  }
  if (d.clientEstSociete) {
    const siren = d.clientSiren?.trim();
    const tva = d.clientTva?.trim();
    if (siren) {
      doc.text(`SIREN ${siren}`, W / 2, y, { align: "center" });
      y += 5.5;
    }
    if (tva) {
      doc.text(`N° TVA ${tva}`, W / 2, y, { align: "center" });
      y += 5.5;
    }
  }
  doc.text(d.titre.trim() || "Devis", W / 2, y, { align: "center" });
  y += 14;
  doc.setFontSize(9);
  const gen = `Généré le ${new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}`;
  doc.text(gen, W / 2, H - 42, { align: "center" });
  setText(doc, [0, 0, 0]);
}

function corpsCentre(
  doc: jsPDF,
  titre: string,
  texte: string,
  options?: { nouvellePage?: boolean; topInsetMm?: number },
) {
  if (options?.nouvellePage !== false) {
    doc.addPage();
  }
  remplirPageBlanche(doc);
  const inset = options?.topInsetMm ?? 0;
  let y = M + 8 + inset;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(doc, [25, 25, 25]);
  for (const line of doc.splitTextToSize(titre, TEXT_W)) {
    doc.text(line, W / 2, y, { align: "center" });
    y += 8;
  }
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setText(doc, [35, 35, 35]);
  const body = texte.trim() || "—";
  for (const line of doc.splitTextToSize(body, TEXT_W)) {
    if (y > H - M - RESERVE_BAS_MM) {
      doc.addPage();
      remplirPageBlanche(doc);
      y = M + 8 + inset;
    }
    doc.text(line, W / 2, y, { align: "center" });
    y += 6;
  }
  setText(doc, [0, 0, 0]);
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > H - M - RESERVE_BAS_MM) {
    doc.addPage();
    remplirPageBlanche(doc);
    return M + 10;
  }
  return y;
}

function createDonutDataUrl(
  slices: { value: number; color: string }[],
  sizePx: number,
): string | null {
  if (typeof document === "undefined") return null;
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const cx = sizePx / 2;
  const cy = sizePx / 2;
  const r = sizePx * 0.4;
  const rIn = sizePx * 0.22;
  let ang = -Math.PI / 2;
  for (const s of slices) {
    const slice = (s.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, ang, ang + slice);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ang += slice;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, rIn, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  return canvas.toDataURL("image/png");
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function pageTarificationDetaillee(
  doc: jsPDF,
  d: Devis,
  totaux: TotauxBudget,
  tarifs: TarifsZone,
  topInsetMm: number,
) {
  doc.addPage();
  remplirPageBlanche(doc);

  const lignesPdf = lignesBudgetPourPdf(d.contenu, tarifs);

  let y = M + 6 + topInsetMm;
  doc.setDrawColor(55, 55, 55);
  doc.setLineWidth(0.35);
  const boxW = 100;
  const titleBoxH = 11;
  doc.rect((W - boxW) / 2, y, boxW, titleBoxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setText(doc, [28, 28, 28]);
  doc.text("TARIFICATION DÉTAILLÉE", W / 2, y + 7.5, { align: "center" });
  y += titleBoxH + 14;

  const tableLeft = M + 2;
  const tableW = 100;
  const colCat = tableLeft + 4;
  const colQty = tableLeft + 62;
  const colTar = tableLeft + 86;
  const rowH = 9;
  const stripeW = 3.2;

  const chartX = tableLeft + tableW + 12;
  const chartMm = 56;
  const chartY = y + 2;

  const actifsChart = lignesPdf.filter((l) => l.actif && l.montant > 0);
  const sumChart = actifsChart.reduce((a, l) => a + l.montant, 0);
  if (sumChart > 0) {
    const donut = createDonutDataUrl(
      actifsChart.map((l) => ({
        value: l.montant,
        color: rgbToHex(...PDF_CATEGORIE_COULEUR[l.cle]),
      })),
      240,
    );
    if (donut) {
      doc.addImage(donut, "PNG", chartX, chartY, chartMm, chartMm);
    }
    let ly = chartY + chartMm + 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    for (const l of actifsChart) {
      const pct = Math.round((l.montant / sumChart) * 100);
      const [r, g, b] = PDF_CATEGORIE_COULEUR[l.cle];
      doc.setFillColor(r, g, b);
      doc.rect(chartX, ly - 3, 3, 3, "F");
      setText(doc, [40, 40, 40]);
      doc.text(`${l.libelle} ${pct} %`, chartX + 5, ly);
      ly += 5.5;
    }
  } else {
    doc.setFontSize(8.5);
    setText(doc, [120, 120, 120]);
    doc.text("Répartition : aucun montant", chartX, chartY + 20);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, [45, 45, 45]);
  doc.setFillColor(235, 235, 237);
  const headerH = 7.5;
  doc.rect(tableLeft, y, tableW, headerH, "F");
  doc.text("CATÉGORIES", colCat, y + 5.2);
  doc.text("QUANTITÉ", colQty, y + 5.2);
  doc.text("TARIF HT", colTar + 12, y + 5.2, { align: "right" });
  y += headerH + 4;

  doc.setFont("helvetica", "normal");
  for (const l of lignesPdf) {
    y = ensureSpace(doc, y, rowH + 8);
    const [r, g, b] = PDF_CATEGORIE_COULEUR[l.cle];
    doc.setFillColor(252, 252, 254);
    doc.rect(tableLeft, y, tableW, rowH + 1.5, "F");
    doc.setFillColor(r, g, b);
    doc.rect(tableLeft, y, stripeW, rowH + 1.5, "F");
    doc.setDrawColor(200, 200, 204);
    doc.rect(tableLeft, y, tableW, rowH + 1.5, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    setText(doc, [22, 22, 28]);
    doc.text(l.libelle, colCat + stripeW + 2, y + 6);
    doc.setFont("helvetica", "normal");
    setText(doc, [l.actif ? 45 : 140, l.actif ? 45 : 140, l.actif ? 50 : 140]);
    doc.text(l.actif ? l.quantiteLibelle : "—", colQty, y + 6);
    doc.text(
      l.actif ? formatEuro(l.montant) : "Hors budget",
      colTar + 12,
      y + 6,
      { align: "right" },
    );
    y += rowH + 2;
    if (l.actif && l.detailLigne) {
      doc.setFontSize(7);
      setText(doc, [95, 95, 100]);
      doc.text(l.detailLigne, colCat + 1, y + 4);
      y += 6;
      doc.setFontSize(8.2);
    }
  }

  y += 6;
  y = ensureSpace(doc, y, 36);
  doc.setDrawColor(160, 160, 168);
  doc.line(tableLeft, y, tableLeft + tableW, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  setText(doc, [30, 30, 30]);
  doc.text("MONTANT LA PRESTATION HT", colCat, y);
  doc.text(formatEuro(totaux.sousTotalHt), colTar + 12, y, { align: "right" });
  y += rowH;
  doc.setFont("helvetica", "normal");
  doc.text(
    `Frais de gestion (${d.contenu.fraisGestionPourcent} %)`,
    colCat,
    y,
  );
  doc.text(formatEuro(totaux.fraisGestion), colTar + 12, y, {
    align: "right",
  });
  y += rowH + 2;
  doc.setFillColor(55, 55, 62);
  doc.rect(tableLeft, y - 1, tableW, rowH + 2, "F");
  doc.setFont("helvetica", "bold");
  setText(doc, [255, 255, 255]);
  doc.text("MONTANT TOTAL HT", colCat, y + 5);
  doc.text(formatEuro(totaux.totalHt), colTar + 12, y + 5, {
    align: "right",
  });
  y += rowH + 12;

  y = ensureSpace(doc, y, 48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, [30, 30, 30]);
  doc.text("GRILLE TARIFAIRE", tableLeft, y);
  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setFillColor(240, 240, 242);
  const grilleHeadH = 6.5;
  doc.rect(tableLeft, y, tableW + 28, grilleHeadH, "F");
  setText(doc, [45, 45, 45]);
  doc.text("Catégorie", colCat, y + 4.5);
  doc.text("Quotation", colCat + 50, y + 4.5);
  doc.text("Tarif", colCat + 104, y + 4.5);
  y += grilleHeadH + 3;
  doc.setFont("helvetica", "normal");
  const grille: [string, string, string][] = [
    ["Déplacement", "Kilomètre", `${tarifs.tarifKm.toFixed(2).replace(".", ",")} €`],
    ["Exploitation", "Heure", `${tarifs.tarifHeure.toFixed(2).replace(".", ",")} €`],
    [
      "Restauration",
      "Jour (1 repas)",
      `${tarifs.prixRepasDefaut.toFixed(2).replace(".", ",")} €`,
    ],
    [
      "Permanence",
      `Jour (${d.contenu.permanence.nbHeuresParJour || 8} h)`,
      `${d.contenu.permanence.tarifJour.toFixed(2).replace(".", ",")} €`,
    ],
    [
      "Frais de gestion",
      `${d.contenu.fraisGestionPourcent} % du montant HT`,
      formatEuro(totaux.fraisGestion),
    ],
  ];
  for (const [cat, quot, tar] of grille) {
    y = ensureSpace(doc, y, 8);
    doc.setDrawColor(210, 210, 215);
    doc.line(tableLeft, y, tableLeft + tableW + 28, y);
    setText(doc, [40, 40, 45]);
    doc.text(cat, colCat, y + 5.5);
    doc.text(quot, colCat + 50, y + 5.5);
    doc.text(tar, colCat + 104, y + 5.5);
    y += 7;
  }
  setText(doc, [0, 0, 0]);
}

function pageConclusion(doc: jsPDF, d: Devis, topInsetMm: number) {
  corpsCentre(doc, "Conclusion", d.contenu.texteConclusion, {
    nouvellePage: false,
    topInsetMm,
  });
}

function pageBandeauAnnexeCompta(
  doc: jsPDF,
  d: Devis,
  topInsetMm: number,
) {
  remplirPageBlanche(doc);
  let y = M + 10 + topInsetMm;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text("Document issu du logiciel de comptabilité", W / 2, y, {
    align: "center",
  });
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const nom = d.pdfComptabiliteNom?.trim() || "Pièce jointe";
  doc.text(nom, W / 2, y, { align: "center" });
  y += 12;
  doc.setTextColor(60, 60, 60);
  for (const part of doc.splitTextToSize(
    "Les pages suivantes reprennent l’export PDF de votre logiciel de comptabilité.",
    TEXT_W,
  )) {
    doc.text(part, W / 2, y, { align: "center" });
    y += 5;
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!m) return null;
  try {
    return Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function appliquerLogoEtPiedPageSurDocument(
  pdf: PDFDocument,
  opts: { logoDataUrl?: string; footerText: string },
) {
  const lines = opts.footerText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!opts.logoDataUrl && lines.length === 0) return;

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  type Emb = Awaited<ReturnType<PDFDocument["embedPng"]>>;
  let embedded: Emb | null = null;
  if (opts.logoDataUrl?.trim()) {
    const bytes = dataUrlToBytes(opts.logoDataUrl.trim());
    if (bytes) {
      try {
        if (/^data:image\/png/i.test(opts.logoDataUrl)) {
          embedded = await pdf.embedPng(bytes);
        } else {
          embedded = await pdf.embedJpg(bytes);
        }
      } catch {
        embedded = null;
      }
    }
  }

  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width: pw, height: ph } = page.getSize();
    const isGarde = i === 0;

    if (embedded) {
      const maxWPt = 30 * MM_TO_PT;
      const sc = maxWPt / embedded.width;
      const iw = embedded.width * sc;
      const ih = embedded.height * sc;
      const margin = 11 * MM_TO_PT;
      page.drawImage(embedded, {
        x: margin,
        y: ph - margin - ih,
        width: iw,
        height: ih,
      });
    }

    if (lines.length === 0) continue;
    const footerColor = isGarde ? rgb(0.88, 0.88, 0.9) : rgb(0.34, 0.34, 0.38);
    const fs = 6;
    let yFromBottom = 14;
    for (const line of lines) {
      const tw = font.widthOfTextAtSize(line, fs);
      page.drawText(line, {
        x: Math.max(10, (pw - tw) / 2),
        y: yFromBottom,
        size: fs,
        font,
        color: footerColor,
      });
      yFromBottom += 7;
    }
  }
}

export async function genererDevisPdfBlob(
  d: Devis,
  totaux: TotauxBudget,
  tarifs: TarifsZone,
): Promise<Blob> {
  const glob = lireParametresDevisDefaut();
  const topInsetMm = glob.logoPdfDataUrl ? 11 : 0;
  const pied =
    glob.piedPagePdf?.trim() || PIED_PAGE_PDF_DEFAUT;

  const docCorps = new jsPDF({ unit: "mm", format: "a4" });
  pageGarde(docCorps, d);
  corpsCentre(
    docCorps,
    "Description de la prestation",
    d.contenu.descriptionPrestation,
    { topInsetMm },
  );
  pageTarificationDetaillee(docCorps, d, totaux, tarifs, topInsetMm);
  const bufCorps = docCorps.output("arraybuffer");

  const docFin = new jsPDF({ unit: "mm", format: "a4" });
  pageConclusion(docFin, d, topInsetMm);
  const bufFin = docFin.output("arraybuffer");

  const merged = await PDFDocument.create();

  const corpsPdf = await PDFDocument.load(bufCorps);
  const corpsPages = await merged.copyPages(corpsPdf, corpsPdf.getPageIndices());
  corpsPages.forEach((p) => merged.addPage(p));

  if (d.pdfComptabiliteBase64?.trim()) {
    const docBandeau = new jsPDF({ unit: "mm", format: "a4" });
    pageBandeauAnnexeCompta(docBandeau, d, topInsetMm);
    const bufBandeau = docBandeau.output("arraybuffer");
    const bandeauPdf = await PDFDocument.load(bufBandeau);
    const bandeauPages = await merged.copyPages(
      bandeauPdf,
      bandeauPdf.getPageIndices(),
    );
    bandeauPages.forEach((p) => merged.addPage(p));
    try {
      const raw = d.pdfComptabiliteBase64.replace(
        /^data:application\/pdf;base64,/,
        "",
      );
      const bin = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const ann = await PDFDocument.load(bin);
      const annPages = await merged.copyPages(ann, ann.getPageIndices());
      annPages.forEach((p) => merged.addPage(p));
    } catch {
      /* ignore invalid annex */
    }
  }

  const finPdf = await PDFDocument.load(bufFin);
  const finPages = await merged.copyPages(finPdf, finPdf.getPageIndices());
  finPages.forEach((p) => merged.addPage(p));

  await appliquerLogoEtPiedPageSurDocument(merged, {
    logoDataUrl: glob.logoPdfDataUrl,
    footerText: pied,
  });

  const out = await merged.save();
  return new Blob([out], { type: "application/pdf" });
}

export function nomFichierPdfDevis(d: Devis): string {
  const slug = (d.titre || "devis")
    .replace(/[^\w\d\-]+/g, "_")
    .slice(0, 60);
  return `devis_${slug}_${d.id.slice(0, 8)}.pdf`;
}
