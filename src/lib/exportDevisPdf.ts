import { PDFDocument } from "pdf-lib";
import { jsPDF } from "jspdf";
import { formatEuro } from "./money";
import type { Devis } from "./devisStorage";
import type { LigneBudget } from "./devisCalcul";

type TotauxBudget = {
  lignes: LigneBudget[];
  sousTotalHt: number;
  fraisGestion: number;
  totalHt: number;
};

const W = 210;
const H = 297;
const M = 18;
const TEXT_W = W - 2 * M;

function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function pageGarde(doc: jsPDF, d: Devis) {
  const { theme, contenu } = d;
  setFill(doc, theme.gardeFond);
  doc.rect(0, 0, W, H, "F");
  setText(doc, theme.gardeTexte);

  let y = H * 0.38;
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
  y += 20;
  doc.setFontSize(11);
  const clientLine = d.clientEstSociete
    ? d.clientSociete?.trim() || d.client.trim()
    : d.client.trim();
  if (clientLine) {
    doc.text(clientLine, W / 2, y, { align: "center" });
    y += 6;
  }
  doc.text(d.titre.trim() || "Devis", W / 2, y, { align: "center" });
  y += 14;
  doc.setFontSize(9);
  const gen = `Généré le ${new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}`;
  doc.text(gen, W / 2, H - 22, { align: "center" });
  setText(doc, [0, 0, 0]);
}

function corpsCentre(
  doc: jsPDF,
  titre: string,
  texte: string,
  options?: { nouvellePage?: boolean },
) {
  if (options?.nouvellePage !== false) {
    doc.addPage();
  }
  let y = M + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(doc, [40, 40, 40]);
  for (const line of doc.splitTextToSize(titre, TEXT_W)) {
    doc.text(line, W / 2, y, { align: "center" });
    y += 7;
  }
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setText(doc, [30, 30, 30]);
  const body = texte.trim() || "—";
  for (const line of doc.splitTextToSize(body, TEXT_W)) {
    if (y > H - M - 8) {
      doc.addPage();
      y = M + 6;
    }
    doc.text(line, W / 2, y, { align: "center" });
    y += 5.2;
  }
  setText(doc, [0, 0, 0]);
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > H - M) {
    doc.addPage();
    return M + 6;
  }
  return y;
}

function pageBudget(
  doc: jsPDF,
  d: Devis,
  totaux: TotauxBudget,
  accent: [number, number, number],
) {
  doc.addPage();
  let y = M + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(35, 35, 35);
  doc.text("Synthèse budgétaire", W / 2, y, { align: "center" });
  y += 12;

  const rowH = 7;
  const colLib = M;
  const colMt = W - M - 42;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Domaine", colLib, y);
  doc.text("Montant HT", colMt, y, { align: "right" });
  y += rowH;
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, W - M, y);
  y += 4;

  for (const l of totaux.lignes) {
    y = ensureSpace(doc, y, rowH + 3);
    if (!l.actif) {
      doc.setTextColor(160, 160, 160);
    } else {
      doc.setTextColor(45, 45, 45);
    }
    const label = l.actif ? l.libelle : `${l.libelle} (hors budget)`;
    const labelLines = doc.splitTextToSize(label, 88);
    const rowTop = y;
    doc.text(labelLines[0], colLib, y);
    doc.text(
      l.actif ? formatEuro(l.montant) : "—",
      colMt,
      rowTop,
      { align: "right" },
    );
    y += 4.5;
    for (let li = 1; li < labelLines.length; li += 1) {
      y = ensureSpace(doc, y, 5);
      doc.text(labelLines[li], colLib, y);
      y += 4.5;
    }
    y += 2;
  }

  y = ensureSpace(doc, y, 28);
  doc.setDrawColor(180, 180, 180);
  doc.line(M, y, W - M, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(45, 45, 45);
  doc.text("Sous-total HT", colLib, y);
  doc.text(formatEuro(totaux.sousTotalHt), colMt, y, { align: "right" });
  y += rowH;
  doc.setFont("helvetica", "normal");
  doc.text(
    `Frais de gestion (${d.contenu.fraisGestionPourcent} %)`,
    colLib,
    y,
  );
  doc.text(formatEuro(totaux.fraisGestion), colMt, y, { align: "right" });
  y += rowH + 2;
  doc.setFont("helvetica", "bold");
  setText(doc, accent);
  doc.text("Total HT", colLib, y);
  doc.text(formatEuro(totaux.totalHt), colMt, y, { align: "right" });
  setText(doc, [0, 0, 0]);

  y += 14;
  y = ensureSpace(doc, y, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(45, 45, 45);
  doc.text("Répartition (domaines inclus)", W / 2, y, { align: "center" });
  y += 10;

  const actifs = totaux.lignes.filter((l) => l.actif && l.montant > 0);
  const sum = actifs.reduce((a, l) => a + l.montant, 0);
  const barW = W - 2 * M;
  const colors: [number, number, number][] = [
    accent,
    [80, 140, 200],
    [120, 180, 140],
    [200, 150, 80],
    [160, 100, 180],
  ];
  if (sum <= 0 || actifs.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Aucun montant domaine à représenter.", W / 2, y + 6, {
      align: "center",
    });
  } else {
    let x0 = M;
    const barH = 8;
    for (let i = 0; i < actifs.length; i += 1) {
      const l = actifs[i];
      const w = (l.montant / sum) * barW;
      const c = colors[i % colors.length];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(x0, y, w, barH, "F");
      x0 += w;
    }
    doc.setDrawColor(180, 180, 180);
    doc.rect(M, y, barW, barH, "S");
    y += barH + 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (let i = 0; i < actifs.length; i += 1) {
      y = ensureSpace(doc, y, 6);
      const l = actifs[i];
      const c = colors[i % colors.length];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(M, y - 3, 3, 3, "F");
      doc.setTextColor(50, 50, 50);
      const pct = Math.round((l.montant / sum) * 100);
      doc.text(`${l.libelle} — ${pct} % (${formatEuro(l.montant)})`, M + 6, y);
      y += 5;
    }
  }
}

function pageConclusion(doc: jsPDF, d: Devis) {
  corpsCentre(doc, "Conclusion", d.contenu.texteConclusion, {
    nouvellePage: false,
  });
}

function pageBandeauAnnexeCompta(doc: jsPDF, d: Devis) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text("Document issu du logiciel de comptabilité", W / 2, M + 8, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const nom = d.pdfComptabiliteNom?.trim() || "Pièce jointe";
  doc.text(nom, W / 2, M + 16, { align: "center" });
  doc.setTextColor(60, 60, 60);
  doc.text(
    "Les pages suivantes reprennent l’export PDF de votre logiciel de comptabilité.",
    W / 2,
    M + 28,
    { align: "center", maxWidth: TEXT_W },
  );
}

export async function genererDevisPdfBlob(
  d: Devis,
  totaux: TotauxBudget,
): Promise<Blob> {
  const accent = d.theme.accent;

  const docCorps = new jsPDF({ unit: "mm", format: "a4" });
  pageGarde(docCorps, d);
  corpsCentre(
    docCorps,
    "Description de la prestation",
    d.contenu.descriptionPrestation,
  );
  pageBudget(docCorps, d, totaux, accent);
  const bufCorps = docCorps.output("arraybuffer");

  const docFin = new jsPDF({ unit: "mm", format: "a4" });
  pageConclusion(docFin, d);
  const bufFin = docFin.output("arraybuffer");

  const merged = await PDFDocument.create();

  const corpsPdf = await PDFDocument.load(bufCorps);
  const corpsPages = await merged.copyPages(corpsPdf, corpsPdf.getPageIndices());
  corpsPages.forEach((p) => merged.addPage(p));

  if (d.pdfComptabiliteBase64?.trim()) {
    const docBandeau = new jsPDF({ unit: "mm", format: "a4" });
    pageBandeauAnnexeCompta(docBandeau, d);
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

  const out = await merged.save();
  return new Blob([out], { type: "application/pdf" });
}

export function nomFichierPdfDevis(d: Devis): string {
  const slug = (d.titre || "devis")
    .replace(/[^\w\d\-]+/g, "_")
    .slice(0, 60);
  return `devis_${slug}_${d.id.slice(0, 8)}.pdf`;
}
