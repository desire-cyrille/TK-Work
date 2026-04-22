import { jsPDF } from "jspdf";
import type { RapportActiviteProjet } from "./rapportActiviteTypes";
import type { RapportBrouillonState } from "./rapportActiviteTypes";

const W = 210;
const M = 14;

function fmtType(t: RapportBrouillonState["typeRapport"]): string {
  switch (t) {
    case "quotidien":
      return "Quotidien";
    case "mensuel":
      return "Mensuel";
    case "fin_mission":
      return "Fin de mission";
    default:
      return "Simple";
  }
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  if (dataUrl.startsWith("data:image/jpeg")) return "JPEG";
  return "PNG";
}

function tryAddImage(
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (!dataUrl || !dataUrl.startsWith("data:") || dataUrl.length < 80) {
    return false;
  }
  try {
    doc.addImage(dataUrl, imageFormat(dataUrl), x, y, w, h, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

function drawFooter(doc: jsPDF, text: string, pageH: number) {
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 90);
  const lines = doc.splitTextToSize(text.trim() || " ", W - 2 * M) as string[];
  doc.text(lines, M, pageH - 12);
}

function drawEtatCarre(doc: jsPDF, x: number, y: number, etat: string) {
  const colors: Record<string, [number, number, number]> = {
    vert: [46, 125, 50],
    bleu: [25, 118, 210],
    orange: [245, 124, 0],
    noir: [33, 33, 33],
  };
  const order: (keyof typeof colors)[] = ["vert", "bleu", "orange", "noir"];
  let cx = x;
  for (const key of order) {
    const on = etat === key;
    const [r, g, b] = colors[key]!;
    doc.setFillColor(r, g, b);
    doc.setDrawColor(on ? 0 : 200);
    doc.setLineWidth(on ? 0.6 : 0.2);
    doc.rect(cx, y, 3.2, 3.2, on ? "FD" : "S");
    cx += 4;
  }
}

export function genererRapportActivitePdfBlob(
  projet: RapportActiviteProjet,
  b: RapportBrouillonState,
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const genLe = new Date().toLocaleString("fr-FR");

  /* — Page de garde — */
  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, W, pageH, "F");
  tryAddImage(doc, b.visuels.logoPrincipal, M, M, 42, 18);
  tryAddImage(doc, b.visuels.logoClient, W - M - 42, M, 42, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 40);
  doc.text(projet.clientNom?.trim() || projet.titre, M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(fmtType(b.typeRapport), M, 50);
  doc.setFontSize(13);
  doc.text(b.titreDocument || "Rapport d’activité", M, 60);
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 80);
  doc.text(`Période / date du rapport : ${b.dateRapport}`, M, 68);
  doc.text(`Document généré le ${genLe}`, M, 74);
  const coverH = 95;
  const coverY = 82;
  const coverW = W - 2 * M;
  if (!tryAddImage(doc, b.visuels.couverture, M, coverY, coverW, coverH)) {
    doc.setDrawColor(200);
    doc.rect(M, coverY, coverW, coverH);
    doc.text("Couverture (image)", M + 4, coverY + 8);
  }
  drawFooter(doc, projet.piedPagePdf, pageH);

  /* — Une page par site — */
  for (const site of projet.sites) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, pageH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(30, 30, 40);
    doc.text(site.nom, M, M + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let y = M + 16;
    const contenu = b.parSite[site.id];
    const photosSite = b.visuels.photosParSite[site.id] ?? [];
    for (let i = 0; i < Math.min(photosSite.length, 3); i += 1) {
      if (tryAddImage(doc, photosSite[i], M + i * 58, y, 52, 34)) {
        /* ok */
      }
    }
    if (photosSite.length) y += 40;
    for (const d of projet.domaines) {
      const bloc = contenu?.domainesTexte[d.id];
      const txt = (bloc?.texte ?? "").trim();
      if (!txt && !(bloc?.photos?.length)) continue;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 60);
      doc.text(d.label, M, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(txt || " ", W - 2 * M) as string[];
      doc.text(lines, M, y);
      y += lines.length * 4.2 + 2;
      for (const ph of bloc?.photos ?? []) {
        if (y > pageH - 40) {
          doc.addPage();
          y = M + 6;
        }
        if (tryAddImage(doc, ph, M, y, 70, 45)) y += 48;
      }
      y += 4;
      if (y > pageH - 30) {
        doc.addPage();
        y = M + 6;
      }
    }
    /* Tableau */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Tableau de suivi", M, y);
    y += 8;
    doc.setFontSize(8);
    const cols = projet.colonnesTableau;
    const colW = (W - 2 * M) / Math.max(cols.length, 1);
    let x0 = M;
    for (const c of cols) {
      doc.setFont("helvetica", "bold");
      doc.text(c.label.slice(0, 18), x0 + 1, y);
      x0 += colW;
    }
    y += 5;
    for (const ligne of contenu?.tableauLignes ?? []) {
      if (y > pageH - 20) {
        doc.addPage();
        y = M + 6;
      }
      x0 = M;
      for (const c of cols) {
        doc.setFont("helvetica", "normal");
        let cell = "";
        if (c.id === "domaine") {
          cell =
            projet.domaines.find((d) => d.id === ligne.domaineId)?.label ?? "";
        } else if (c.id === "sujet") cell = ligne.sujet;
        else if (c.id === "responsable") cell = ligne.responsable;
        else if (c.id === "etat") {
          drawEtatCarre(doc, x0 + 1, y - 2.5, ligne.etat);
          x0 += colW;
          continue;
        } else if (c.id === "observation") cell = ligne.observation;
        else if (c.id === "relances") cell = ligne.relances;
        else cell = ligne.extra[c.id] ?? "";
        const lines = doc.splitTextToSize(
          String(cell).slice(0, 400),
          colW - 2,
        ) as string[];
        doc.text(lines, x0 + 1, y);
        x0 += colW;
      }
      y += 12;
    }
    drawFooter(doc, projet.piedPagePdf, pageH);
  }

  /* — Synthèse — */
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Synthèse globale", M, M + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  const synLines = doc.splitTextToSize(
    b.syntheseGlobale.trim() || "—",
    W - 2 * M,
  ) as string[];
  doc.text(synLines, M, M + 18);
  drawFooter(doc, projet.piedPagePdf, pageH);

  /* — Dernière page — */
  doc.addPage();
  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, W, pageH, "F");
  tryAddImage(doc, b.visuels.couverture, M, M, W - 2 * M, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const msgLines = doc.splitTextToSize(
    projet.dernierePageMessage.trim() ||
      "Merci de votre confiance.",
    W - 2 * M,
  ) as string[];
  doc.text(msgLines, M, 118);
  drawFooter(doc, projet.piedPagePdf, pageH);

  return doc.output("blob");
}

export function telechargerRapportActivitePdf(
  projet: RapportActiviteProjet,
  b: RapportBrouillonState,
  nomFichier?: string,
): void {
  const blob = genererRapportActivitePdfBlob(projet, b);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    nomFichier?.replace(/[^\w\-]+/g, "_").slice(0, 80) ||
    `rapport-activite-${projet.id.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
