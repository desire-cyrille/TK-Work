import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { jsPDF } from "jspdf";
import {
  PDF_CATEGORIE_COULEUR,
  lignesBudgetPourPdf,
  tarifUnitairePermanence,
  type LigneBudget,
  type LigneBudgetPdf,
} from "./devisCalcul";
import { lireParametresDevisDefaut } from "./devisDefaultsStorage";
import { formatEuroPdf } from "./money";
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

function formatPlagePages(debut: number, fin: number): string {
  if (debut > fin || debut < 1) return "—";
  if (debut === fin) return String(debut);
  return `${debut} – ${fin}`;
}

/** Page 2 : à remplir après calcul des numéros (setPage 2 + dessin). */
function reserverPageSommaire(doc: jsPDF) {
  doc.addPage();
  remplirPageBlanche(doc);
}

function dimensionsBoiteTitreEncadre(
  doc: jsPDF,
  titre: string,
  options?: { fontSize?: number; boxWidthMm?: number },
): { boxWMm: number; boxHMm: number; lines: string[]; lineHmm: number; fs: number; padMm: number } {
  const fs = options?.fontSize ?? 12;
  const boxWMm = options?.boxWidthMm ?? 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs);
  const lines = doc.splitTextToSize(titre.trim().toUpperCase(), boxWMm - 8) as string[];
  const lineHmm = fs * 0.42 + 1.35;
  const padMm = 2.8;
  const boxHMm = Math.max(11, lines.length * lineHmm + padMm * 2);
  return { boxWMm, boxHMm, lines, lineHmm, fs, padMm };
}

/** Titre de page centré dans un cadre (style « TARIFICATION DÉTAILLÉE »). */
function dessinerTitrePageEncadre(
  doc: jsPDF,
  titre: string,
  yTopMm: number,
  options?: { fontSize?: number; boxWidthMm?: number },
): number {
  const { boxWMm, boxHMm, lines, lineHmm, fs, padMm } = dimensionsBoiteTitreEncadre(
    doc,
    titre,
    options,
  );
  doc.setDrawColor(55, 55, 55);
  doc.setLineWidth(0.35);
  doc.rect((W - boxWMm) / 2, yTopMm, boxWMm, boxHMm);
  setText(doc, [28, 28, 28]);
  let ty = yTopMm + padMm + fs * 0.32;
  for (const ln of lines) {
    doc.text(ln, W / 2, ty, { align: "center" });
    ty += lineHmm;
  }
  return yTopMm + boxHMm;
}

function remplirPageSommaire(
  doc: jsPDF,
  entrees: { libelle: string; debut: number; fin: number }[],
  topInsetMm: number,
) {
  doc.setPage(2);
  remplirPageBlanche(doc);
  let y = M + 8 + topInsetMm;
  y = dessinerTitrePageEncadre(doc, "Sommaire", y, { fontSize: 12, boxWidthMm: 100 });
  y += 6;
  doc.setDrawColor(190, 190, 198);
  doc.setLineWidth(0.3);
  doc.line(M + 2, y, W - M - 2, y);
  y += 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setText(doc, [38, 38, 44]);
  const colDroite = W - M - 4;
  const maxLib = W - 2 * M - 32;
  for (const e of entrees) {
    const plage = formatPlagePages(e.debut, e.fin);
    const lignes = doc.splitTextToSize(e.libelle, maxLib);
    const lineH = 5.5;
    for (let i = 0; i < lignes.length; i++) {
      doc.text(lignes[i]!, M + 4, y);
      if (i === 0) {
        doc.setFont("helvetica", "bold");
        doc.text(plage, colDroite, y, { align: "right" });
        doc.setFont("helvetica", "normal");
      }
      y += lineH;
    }
    y += 3;
    if (y > H - M - RESERVE_BAS_MM - 20) break;
  }
  setText(doc, [0, 0, 0]);
}

/** Retours à la ligne explicites + césure jsPDF pour titre / sous-titre garde. */
function yApresTexteGardeMultiligne(
  doc: jsPDF,
  raw: string,
  maxW: number,
  xCenter: number,
  yStart: number,
  lineH: number,
): number {
  let y = yStart;
  const blocks = raw.split(/\r?\n/);
  for (const block of blocks) {
    const t = block.trim();
    if (t === "") {
      y += lineH * 0.45;
      continue;
    }
    for (const line of doc.splitTextToSize(t, maxW)) {
      doc.text(line as string, xCenter, y, { align: "center" });
      y += lineH;
    }
  }
  return y;
}

function pageGarde(doc: jsPDF, d: Devis) {
  const { theme, contenu } = d;
  setFill(doc, theme.gardeFond);
  doc.rect(0, 0, W, H, "F");
  setText(doc, theme.gardeTexte);

  let y = H * 0.36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  const titre =
    contenu.titrePageGarde.trim() || "PROPOSITION COMMERCIALE";
  y = yApresTexteGardeMultiligne(doc, titre, TEXT_W, W / 2, y, 10);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  const sous = contenu.sousTitrePageGarde.trim();
  if (sous) {
    y = yApresTexteGardeMultiligne(doc, sous, TEXT_W, W / 2, y, 7);
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
  const contentTop = M + 6 + inset;
  const contentBottom = H - M - RESERVE_BAS_MM;
  const available = Math.max(0, contentBottom - contentTop);

  const titleOpts = { fontSize: 12, boxWidthMm: 110 } as const;
  const { boxHMm: titleH } = dimensionsBoiteTitreEncadre(doc, titre, titleOpts);
  const gapCorps = 10;
  const lineStep = 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  const body = texte.trim() || "—";
  const bodyLines = doc.splitTextToSize(body, TEXT_W) as string[];
  const bodyH = bodyLines.length * lineStep;
  const totalBloc = titleH + gapCorps + bodyH;
  const centreVertical = totalBloc <= available;
  let y = centreVertical
    ? contentTop + (available - totalBloc) / 2
    : contentTop;

  y = dessinerTitrePageEncadre(doc, titre, y, titleOpts);
  y += gapCorps;
  setText(doc, [35, 35, 35]);
  for (const line of bodyLines) {
    if (y > H - M - RESERVE_BAS_MM) {
      doc.addPage();
      remplirPageBlanche(doc);
      y = M + 8 + inset;
    }
    doc.text(line, W / 2, y, { align: "center" });
    y += lineStep;
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

/** Remplace espaces insécables / fins souvent mal rendus en PDF. */
function textePdfSafe(s: string): string {
  return s
    .replace(/\u202f|\u00a0|\u2009|\u2007/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const sliceInfos: { start: number; sweep: number; pct: number }[] = [];
  for (const s of slices) {
    const sweep = (s.value / total) * 2 * Math.PI;
    const pct = Math.round((s.value / total) * 100);
    sliceInfos.push({ start: ang, sweep, pct });
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, ang, ang + sweep);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ang += sweep;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, rIn, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const midR = (r + rIn) / 2;
  const fsBase = Math.max(13, Math.floor(sizePx * 0.068));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const inf of sliceInfos) {
    if (inf.pct < 4) continue;
    const mid = inf.start + inf.sweep / 2;
    const tx = cx + Math.cos(mid) * midR;
    const ty = cy + Math.sin(mid) * midR;
    const fs = inf.pct < 10 ? Math.floor(fsBase * 0.82) : fsBase;
    ctx.font = `bold ${fs}px Helvetica, Arial, sans-serif`;
    const label = `${inf.pct} %`;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = Math.max(2.2, fs * 0.18);
    ctx.strokeText(label, tx, ty);
    ctx.fillStyle = "#121212";
    ctx.fillText(label, tx, ty);
  }
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

  const lignesPdf = lignesBudgetPourPdf(d.contenu, tarifs, d.modeleDevis);

  let y = M + 6 + topInsetMm;
  y = dessinerTitrePageEncadre(doc, "Tarification détaillée", y, {
    fontSize: 12,
    boxWidthMm: 100,
  });
  y += 14;

  const tableLeft = M + 2;
  const tableW = 100;
  const tableRight = tableLeft + tableW;
  const tarRightX = tableRight - 3;
  const colCat = tableLeft + 4;
  const colQty = tableLeft + 56;
  const stripeW = 3.2;
  /** Séparateurs verticaux (bordures fermées). */
  const vAfterCat = tableLeft + 52;
  const vBeforeTarif = tableLeft + 74;
  /** Centre de la colonne quantité (alignement des données). */
  const qtyColCenterX = (colQty + vBeforeTarif) / 2;
  const qtyColWidth = vBeforeTarif - colQty - 2;
  const rowH = 9;

  const chartX = tableLeft + tableW + 12;
  const chartMm = 56;
  /** Graphique un peu plus bas sous le titre de page / alignement tableau */
  const chartY = y + 14;
  const chartCenterX = chartX + chartMm / 2;

  function lignesPourGraphique(lignes: LigneBudgetPdf[]) {
    const out: { cle: LigneBudget["cle"]; libelle: string; montant: number }[] =
      [];
    for (const l of lignes) {
      if (!l.actif || l.montant <= 0) continue;
      if (l.forfaitPdfBloc?.length) {
        for (const row of l.forfaitPdfBloc) {
          if (row.montant <= 0) continue;
          out.push({
            cle: l.cle,
            libelle: row.libelle,
            montant: row.montant,
          });
        }
      } else {
        out.push({
          cle: l.cle,
          libelle: l.libelle,
          montant: l.montant,
        });
      }
    }
    return out;
  }

  const actifsChart = lignesPourGraphique(lignesPdf);
  const sumChart = actifsChart.reduce((a, l) => a + l.montant, 0);
  if (sumChart > 0) {
    const donut = createDonutDataUrl(
      actifsChart.map((l) => ({
        value: l.montant,
        color: rgbToHex(...PDF_CATEGORIE_COULEUR[l.cle]),
      })),
      280,
    );
    if (donut) {
      doc.addImage(donut, "PNG", chartX, chartY, chartMm, chartMm);
    }
    let ly = chartY + chartMm + 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    const swatchMm = 2.8;
    const swatchGap = 1.5;
    for (const l of actifsChart) {
      const [r, g, b] = PDF_CATEGORIE_COULEUR[l.cle];
      const legendLines = doc.splitTextToSize(
        textePdfSafe(l.libelle),
        chartMm + 14,
      );
      const first = (legendLines[0] as string) || "";
      const wFirst = doc.getTextWidth(first);
      const row0W = swatchMm + swatchGap + wFirst;
      const x0 = chartCenterX - row0W / 2;
      doc.setFillColor(r, g, b);
      doc.rect(x0, ly - 2.8, swatchMm, swatchMm, "F");
      setText(doc, [40, 40, 40]);
      doc.text(first, x0 + swatchMm + swatchGap, ly);
      ly += 3.6;
      for (let li = 1; li < legendLines.length; li++) {
        doc.text(legendLines[li] as string, chartCenterX, ly, {
          align: "center",
        });
        ly += 3.6;
      }
      ly += 1.2;
    }
  } else {
    doc.setFontSize(8.5);
    setText(doc, [120, 120, 120]);
    doc.text("Répartition : aucun montant", chartX, chartY + 20);
  }

  const yGridTop = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, [45, 45, 45]);
  doc.setFillColor(235, 235, 237);
  const headerH = 7.5;
  doc.rect(tableLeft, y, tableW, headerH, "F");
  doc.setDrawColor(72, 72, 78);
  doc.setLineWidth(0.28);
  doc.rect(tableLeft, y, tableW, headerH, "S");
  doc.text("CATÉGORIES", colCat, y + 5.2);
  doc.text("QUANTITÉ", qtyColCenterX, y + 5.2, { align: "center" });
  doc.text("TARIF HT", tarRightX, y + 5.2, { align: "right" });
  y += headerH;

  doc.setFont("helvetica", "normal");
  const lineStep = 3.85;
  for (const l of lignesPdf) {
    const catX = colCat + stripeW + 2;
    const subIndentMm = 2.2;
    const catWBase = vAfterCat - catX - 3;

    let hMain: number;
    if (l.actif && l.forfaitPdfBloc && l.forfaitPdfBloc.length > 0) {
      const catWSub = vAfterCat - (catX + subIndentMm) - 2;
      let totalLines = 1;
      for (const row of l.forfaitPdfBloc) {
        const wrapped = doc.splitTextToSize(
          textePdfSafe(row.libelle),
          Math.max(12, catWSub),
        );
        totalLines += Math.max(1, wrapped.length);
      }
      hMain = Math.max(rowH + 1.5, 5 + totalLines * lineStep);
    } else {
      const libLines = doc.splitTextToSize(
        textePdfSafe(l.libelle),
        catWBase,
      );
      hMain = Math.max(rowH + 1.5, 5 + libLines.length * lineStep);
    }

    const hCell = hMain;
    y = ensureSpace(doc, y, hCell + 4);
    const [r, g, b] = PDF_CATEGORIE_COULEUR[l.cle];
    doc.setFillColor(252, 252, 254);
    doc.rect(tableLeft, y, tableW, hCell, "F");
    doc.setFillColor(r, g, b);
    doc.rect(tableLeft, y, stripeW, hCell, "F");
    doc.setDrawColor(72, 72, 78);
    doc.rect(tableLeft, y, tableW, hCell, "S");
    doc.setFontSize(8.2);
    setText(doc, [22, 22, 28]);

    if (l.actif && l.forfaitPdfBloc && l.forfaitPdfBloc.length > 0) {
      const catWSub = vAfterCat - (catX + subIndentMm) - 2;
      let yyRow = y + 5;
      doc.setFont("helvetica", "bold");
      doc.text("FONCTION", catX, yyRow);
      yyRow += lineStep;
      doc.setFont("helvetica", "normal");
      for (const row of l.forfaitPdfBloc) {
        const wrapped = doc.splitTextToSize(
          textePdfSafe(row.libelle),
          Math.max(12, catWSub),
        );
        const startY = yyRow;
        for (const frag of wrapped) {
          doc.text(frag, catX + subIndentMm, yyRow);
          yyRow += lineStep;
        }
        setText(doc, [45, 45, 50]);
        doc.text(textePdfSafe(row.quantite), qtyColCenterX, startY, {
          align: "center",
          maxWidth: qtyColWidth,
        });
        doc.text(formatEuroPdf(row.montant), tarRightX, startY, {
          align: "right",
        });
        setText(doc, [22, 22, 28]);
      }
    } else {
      doc.setFont("helvetica", "bold");
      const libLines = doc.splitTextToSize(textePdfSafe(l.libelle), catWBase);
      let yyRow = y + 5;
      for (const line of libLines) {
        doc.text(line, catX, yyRow);
        yyRow += lineStep;
      }
      doc.setFont("helvetica", "normal");
      setText(doc, [l.actif ? 45 : 140, l.actif ? 45 : 140, l.actif ? 50 : 140]);
      const qtyStr = l.actif ? textePdfSafe(l.quantiteLibelle) : "—";
      const qtyTarY = y + hMain / 2 + 1.5;
      doc.text(qtyStr, qtyColCenterX, qtyTarY, {
        align: "center",
        maxWidth: qtyColWidth,
      });
      doc.text(
        l.actif ? formatEuroPdf(l.montant) : "Hors budget",
        tarRightX,
        qtyTarY,
        { align: "right" },
      );
    }
    y += hCell + 2;
  }

  y += 4;
  y = ensureSpace(doc, y, 40);
  doc.setDrawColor(72, 72, 78);
  doc.line(tableLeft, y, tableRight, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  setText(doc, [30, 30, 30]);
  doc.text("MONTANT LA PRESTATION HT", colCat, y);
  doc.text(formatEuroPdf(totaux.sousTotalHt), tarRightX, y, {
    align: "right",
  });
  y += rowH;
  doc.setFont("helvetica", "normal");
  doc.text(
    `Frais de gestion (${d.contenu.fraisGestionPourcent} %)`,
    colCat,
    y,
    { maxWidth: vBeforeTarif - colCat - 2 },
  );
  doc.text(formatEuroPdf(totaux.fraisGestion), tarRightX, y, {
    align: "right",
  });
  y += rowH + 2;
  const totalBarH = rowH + 2.5;
  doc.setFillColor(55, 55, 62);
  doc.rect(tableLeft, y - 0.5, tableW, totalBarH, "F");
  doc.setDrawColor(72, 72, 78);
  doc.rect(tableLeft, y - 0.5, tableW, totalBarH, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  setText(doc, [255, 255, 255]);
  doc.text("MONTANT TOTAL HT", colCat, y + 5);
  doc.text(formatEuroPdf(totaux.totalHt), tarRightX, y + 5, {
    align: "right",
  });
  const yGridBottom = y - 0.5 + totalBarH;

  doc.setDrawColor(55, 55, 62);
  doc.setLineWidth(0.35);
  doc.rect(tableLeft, yGridTop, tableW, yGridBottom - yGridTop, "S");
  doc.setLineWidth(0.22);
  doc.setDrawColor(88, 88, 96);
  doc.line(vAfterCat, yGridTop, vAfterCat, yGridBottom);
  doc.line(vBeforeTarif, yGridTop, vBeforeTarif, yGridBottom);

  y = yGridBottom + 22;

  const grilleW = 78;
  const grilleLeft = (W - grilleW) / 2;
  const gCol1 = grilleLeft + 2;
  const gCol2 = grilleLeft + 30;
  const gCol3 = grilleLeft + 52;
  const gRowH = 5.2;
  const grilleHeadH = 5.8;

  y = ensureSpace(doc, y, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setText(doc, [30, 30, 30]);
  doc.text("GRILLE TARIFAIRE", W / 2, y, { align: "center" });
  y += 8;

  const grille: [string, string, string][] = [
    [
      "Déplacement",
      "km",
      `${tarifs.tarifKm.toFixed(2).replace(".", ",")} €/km`,
    ],
    ["Exploitation", "heure", `${tarifs.tarifHeure.toFixed(2).replace(".", ",")} €`],
    ...(d.modeleDevis === "forfaitaire"
      ? ([
          [
            "Fonction",
            "forfait/jour",
            "—",
          ],
        ] as [string, string, string][])
      : []),
    [
      "Restauration",
      "jour",
      `${tarifs.prixRepasDefaut.toFixed(2).replace(".", ",")} €`,
    ],
    [
      "Petit-déjeuner",
      "unité",
      `${tarifs.prixPetitDejeunerDefaut.toFixed(2).replace(".", ",")} €`,
    ],
    [
      "Permanence",
      (() => {
        const u = d.contenu.permanence.unite;
        if (u === "heure") return "heure";
        if (u === "jour") return "jour";
        if (u === "semaine") return "semaine";
        return "mois";
      })(),
      `${tarifUnitairePermanence(d.contenu.permanence, tarifs)
        .toFixed(2)
        .replace(".", ",")} €`,
    ],
    [
      "Frais de gestion",
      `${d.contenu.fraisGestionPourcent} % du HT`,
      formatEuroPdf(totaux.fraisGestion),
    ],
  ];
  const grilleBodyH = grille.length * gRowH;
  const grilleBoxH = grilleHeadH + grilleBodyH;

  doc.setDrawColor(72, 72, 78);
  doc.setLineWidth(0.28);
  doc.rect(grilleLeft, y, grilleW, grilleBoxH, "S");
  doc.setFillColor(240, 240, 242);
  doc.rect(grilleLeft, y, grilleW, grilleHeadH, "F");
  doc.rect(grilleLeft, y, grilleW, grilleHeadH, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.3);
  setText(doc, [45, 45, 45]);
  doc.text("Catégorie", gCol1, y + 4.2);
  doc.text("Quotation", gCol2, y + 4.2);
  doc.text("Tarif", gCol3, y + 4.2);
  y += grilleHeadH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  for (const [cat, quot, tar] of grille) {
    doc.setDrawColor(200, 200, 206);
    doc.line(grilleLeft, y, grilleLeft + grilleW, y);
    setText(doc, [40, 40, 45]);
    doc.text(textePdfSafe(cat), gCol1, y + 4, { maxWidth: 25 });
    doc.text(textePdfSafe(quot), gCol2, y + 4, { maxWidth: 20 });
    doc.text(textePdfSafe(tar), gCol3, y + 4, { maxWidth: 24 });
    y += gRowH;
  }
  doc.line(grilleLeft, y, grilleLeft + grilleW, y);
  doc.line(gCol2 - 1.5, y - grilleBodyH, gCol2 - 1.5, y);
  doc.line(gCol3 - 1.5, y - grilleBodyH, gCol3 - 1.5, y);

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
  let y = M + 8 + topInsetMm;
  y = dessinerTitrePageEncadre(
    doc,
    "Document issu du logiciel de comptabilité",
    y,
    { fontSize: 11, boxWidthMm: 150 },
  );
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, [90, 90, 90]);
  const nom = d.pdfComptabiliteNom?.trim() || "Pièce jointe";
  doc.text(nom, W / 2, y, { align: "center" });
  setText(doc, [0, 0, 0]);
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
  opts: {
    logoDataUrl?: string;
    footerText: string;
    /** RVB 0–255 — fond du bandeau de pied (hors pages compta). */
    gardeFond: [number, number, number];
    /** RVB 0–255 — texte du pied sur le bandeau. */
    gardeTexte: [number, number, number];
    /** Indices de pages (0-based) sans pied ni bandeau : export comptable. */
    indicesSansPied?: Set<number>;
  },
) {
  const lines = opts.footerText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const skipFooter = opts.indicesSansPied ?? new Set<number>();
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

  const [gfR, gfG, gfB] = opts.gardeFond;
  const [gtR, gtG, gtB] = opts.gardeTexte;
  const fondPied = rgb(gfR / 255, gfG / 255, gfB / 255);
  const textePied = rgb(gtR / 255, gtG / 255, gtB / 255);

  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width: pw, height: ph } = page.getSize();

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

    if (lines.length === 0 || skipFooter.has(i)) continue;

    const fs = 6;
    const lineGapPt = 7;
    const bandHpt = Math.max(
      24,
      12 + lines.length * lineGapPt + 10,
    );
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pw,
      height: bandHpt,
      color: fondPied,
    });

    let yFromBottom = 12;
    for (const line of lines) {
      const tw = font.widthOfTextAtSize(line, fs);
      page.drawText(line, {
        x: Math.max(10, (pw - tw) / 2),
        y: yFromBottom,
        size: fs,
        font,
        color: textePied,
      });
      yFromBottom += lineGapPt;
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
  reserverPageSommaire(docCorps);
  corpsCentre(
    docCorps,
    "Description de la prestation",
    d.contenu.descriptionPrestation,
    { topInsetMm },
  );
  const pagesAvantTarif = docCorps.getNumberOfPages();
  const descDebut = 3;
  const descFin = pagesAvantTarif;

  pageTarificationDetaillee(docCorps, d, totaux, tarifs, topInsetMm);
  const pagesCorpsTotal = docCorps.getNumberOfPages();
  const tarifDebut = pagesAvantTarif + 1;
  const tarifFin = pagesCorpsTotal;

  const docFin = new jsPDF({ unit: "mm", format: "a4" });
  pageConclusion(docFin, d, topInsetMm);
  const nbPagesConclusion = docFin.getNumberOfPages();
  const bufFin = docFin.output("arraybuffer");

  const pdfComptaB64 = d.pdfComptabiliteBase64?.trim() ?? "";
  const hasCompta = Boolean(pdfComptaB64);
  let nbPagesAnnexeCompta = 0;
  if (hasCompta) {
    try {
      const raw = pdfComptaB64.replace(
        /^data:application\/pdf;base64,/,
        "",
      );
      const bin = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const ann = await PDFDocument.load(bin);
      nbPagesAnnexeCompta = ann.getPageCount();
    } catch {
      nbPagesAnnexeCompta = 0;
    }
  }
  const nbPagesBlocCompta = hasCompta ? 1 + nbPagesAnnexeCompta : 0;
  const conclusionDebut = pagesCorpsTotal + nbPagesBlocCompta + 1;
  const conclusionFin = conclusionDebut + nbPagesConclusion - 1;

  const entreesSommaire: { libelle: string; debut: number; fin: number }[] = [
    { libelle: "Page de garde", debut: 1, fin: 1 },
    {
      libelle: "Description de la prestation",
      debut: descDebut,
      fin: descFin,
    },
    {
      libelle: "Tarification détaillée",
      debut: tarifDebut,
      fin: tarifFin,
    },
  ];
  if (hasCompta) {
    entreesSommaire.push({
      libelle: "Devis comptable",
      debut: pagesCorpsTotal + 1,
      fin: pagesCorpsTotal + nbPagesBlocCompta,
    });
  }
  entreesSommaire.push({
    libelle: "Conclusion",
    debut: conclusionDebut,
    fin: conclusionFin,
  });

  remplirPageSommaire(docCorps, entreesSommaire, topInsetMm);
  const bufCorps = docCorps.output("arraybuffer");

  const merged = await PDFDocument.create();

  const corpsPdf = await PDFDocument.load(bufCorps);
  const corpsPages = await merged.copyPages(corpsPdf, corpsPdf.getPageIndices());
  corpsPages.forEach((p) => merged.addPage(p));

  if (hasCompta) {
    const docBandeau = new jsPDF({ unit: "mm", format: "a4" });
    pageBandeauAnnexeCompta(docBandeau, d, topInsetMm);
    const bufBandeau = docBandeau.output("arraybuffer");
    const bandeauPdf = await PDFDocument.load(bufBandeau);
    const bandeauPages = await merged.copyPages(
      bandeauPdf,
      bandeauPdf.getPageIndices(),
    );
    bandeauPages.forEach((p) => merged.addPage(p));
    if (nbPagesAnnexeCompta > 0) {
      try {
        const raw = pdfComptaB64.replace(
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
  }

  const finPdf = await PDFDocument.load(bufFin);
  const finPages = await merged.copyPages(finPdf, finPdf.getPageIndices());
  finPages.forEach((p) => merged.addPage(p));

  const nCorps = corpsPages.length;
  const indicesSansPied = new Set<number>();
  if (hasCompta && nbPagesBlocCompta > 0) {
    for (let p = 0; p < nbPagesBlocCompta; p++) {
      indicesSansPied.add(nCorps + p);
    }
  }

  await appliquerLogoEtPiedPageSurDocument(merged, {
    logoDataUrl: glob.logoPdfDataUrl,
    footerText: pied,
    gardeFond: d.theme.gardeFond,
    gardeTexte: d.theme.gardeTexte,
    indicesSansPied,
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
