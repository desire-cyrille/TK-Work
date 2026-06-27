import { jsPDF } from "jspdf";
import {
  domaineSiteNonVide,
  ligneTableauSuiviVisible,
  type RapportActiviteProjet,
  type RapportBrouillonState,
} from "./rapportActiviteTypes";
import { ensureImageRefDataUrl } from "./rapportActiviteImageDbCloud";

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
  if (/^data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
  return "PNG";
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_decode_failed"));
    img.src = dataUrl;
  });
}

/** Ré-encode via canvas si jsPDF ne lit pas la data URL telle quelle. */
async function normalizeForJsPdf(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  try {
    const img = await loadImageElement(dataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    if (!/^data:image\/png/i.test(dataUrl)) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL(
      /^data:image\/png/i.test(dataUrl) ? "image/png" : "image/jpeg",
      0.92,
    );
  } catch {
    return dataUrl;
  }
}

async function resolveImageDataUrl(
  refOrDataUrl: string | undefined,
): Promise<string | undefined> {
  if (!refOrDataUrl?.trim()) return undefined;
  const raw = refOrDataUrl.trim();
  if (raw.startsWith("data:image/")) return normalizeForJsPdf(raw);
  const resolved = await ensureImageRefDataUrl(raw);
  if (!resolved?.startsWith("data:image/")) return undefined;
  return normalizeForJsPdf(resolved);
}

/** Dessine l’image dans le rectangle en conservant le ratio (type « contain »). */
function addImageContain(
  doc: jsPDF,
  dataUrl: string | undefined,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): boolean {
  if (!dataUrl || !dataUrl.startsWith("data:") || dataUrl.length < 80) {
    return false;
  }
  try {
    const fmt = imageFormat(dataUrl);
    const props = doc.getImageProperties(dataUrl);
    const iw = Math.max(1, props.width);
    const ih = Math.max(1, props.height);
    const ratio = iw / ih;
    let dw = boxW;
    let dh = dw / ratio;
    if (dh > boxH) {
      dh = boxH;
      dw = dh * ratio;
    }
    const x = boxX + (boxW - dw) / 2;
    const y = boxY + (boxH - dh) / 2;
    doc.addImage(dataUrl, fmt, x, y, dw, dh, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

async function addImageContainResolved(
  doc: jsPDF,
  refOrDataUrl: string | undefined,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): Promise<boolean> {
  const dataUrl = await resolveImageDataUrl(refOrDataUrl);
  return addImageContain(doc, dataUrl, boxX, boxY, boxW, boxH);
}

function drawFooter(doc: jsPDF, text: string, pageH: number) {
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 90);
  const lines = doc.splitTextToSize(text.trim() || " ", W - 2 * M) as string[];
  const centerX = W / 2;
  const lineH = 3.6;
  const baseY = pageH - 10 - (lines.length - 1) * lineH;
  for (let i = 0; i < lines.length; i += 1) {
    doc.text(lines[i]!, centerX, baseY + i * lineH, { align: "center" });
  }
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function genererRapportActivitePdfBlob(
  projet: RapportActiviteProjet,
  b: RapportBrouillonState,
): Promise<Blob> {
  return genererRapportActivitePdfBlobAsync(projet, b);
}

export async function genererRapportActivitePdfBlobAsync(
  projet: RapportActiviteProjet,
  b: RapportBrouillonState,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const genLe = new Date().toLocaleString("fr-FR");

  /* — Page de garde — */
  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, W, pageH, "F");

  const logoPrincipalBoxW = 44;
  const logoPrincipalBoxH = 18;
  await addImageContainResolved(
    doc,
    b.visuels.logoPrincipal,
    M,
    M,
    logoPrincipalBoxW,
    logoPrincipalBoxH,
  );

  const logoClientBoxW = 28;
  const logoClientBoxH = 10;
  const logoClientX = W - M - logoClientBoxW;
  await addImageContainResolved(
    doc,
    b.visuels.logoClient,
    logoClientX,
    M,
    logoClientBoxW,
    logoClientBoxH,
  );

  // Bloc texte centré (au-dessus de la photo).
  const headerTopY = M + Math.max(logoPrincipalBoxH, logoClientBoxH) + 6;
  const centerX = W / 2;

  const nomClient = projet.clientNom?.trim() || "";
  let yMeta = headerTopY;

  if (nomClient) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 40);
    const clientLines = doc.splitTextToSize(nomClient, W - 2 * M) as string[];
    for (const line of clientLines.slice(0, 2)) {
      doc.text(line, centerX, yMeta, { align: "center" });
      yMeta += 5.4;
    }
    yMeta += 1;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 55);
  doc.text(fmtType(b.typeRapport), centerX, yMeta, { align: "center" });
  yMeta += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 40);
  const titreLines = doc.splitTextToSize(
    b.titreDocument || "Rapport d’activité",
    W - 2 * M,
  ) as string[];
  for (const line of titreLines.slice(0, 2)) {
    doc.text(line, centerX, yMeta, { align: "center" });
    yMeta += 6;
  }
  yMeta += 1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 80);
  doc.text(`Période / date du rapport : ${b.dateRapport}`, centerX, yMeta, {
    align: "center",
  });
  yMeta += 4.8;
  doc.text(`Document généré le ${genLe}`, centerX, yMeta, { align: "center" });
  yMeta += 6;

  // Photo de couverture centrée sur la page (hauteur ≤ espace disponible, évite les box à hauteur fixe trop grandes).
  const coverW = W - 2 * M;
  const coverBottom = pageH - 24;
  const coverTop = Math.min(Math.max(yMeta + 4, 68), Math.max(coverBottom - 40, 68));
  const available = Math.max(0, coverBottom - coverTop);
  const coverH = Math.min(140, available);
  const coverY = coverTop + (available - coverH) / 2;
  if (
    coverH >= 12 &&
    !(await addImageContainResolved(
      doc,
      b.visuels.couverture,
      M,
      coverY,
      coverW,
      coverH,
    ))
  ) {
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
      if (
        await addImageContainResolved(
          doc,
          photosSite[i],
          M + i * 58,
          y,
          52,
          34,
        )
      ) {
        /* ok */
      }
    }
    if (photosSite.length) y += 40;
    for (const d of projet.domaines) {
      if (!domaineSiteNonVide(contenu, d.id)) continue;
      const bloc = contenu?.domainesTexte[d.id];
      const infos =
        bloc?.infos && Array.isArray(bloc.infos) && bloc.infos.length
          ? bloc.infos.map((x) => String(x ?? "")).filter((x) => x.trim().length > 0)
          : (bloc?.texte ?? "").trim()
            ? String(bloc?.texte ?? "").trim().split(/\n\s*\n+/g)
            : [];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 60);
      doc.text(d.label, M, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      if (infos.length) {
        for (const info of infos) {
          const txt = String(info ?? "").trim();
          if (!txt) continue;
          const lines = doc.splitTextToSize(`• ${txt}`, W - 2 * M) as string[];
          doc.text(lines, M, y);
          y += lines.length * 4.2 + 1.5;
          if (y > pageH - 30) {
            doc.addPage();
            y = M + 6;
          }
        }
      } else y += 1;
      for (const ph of bloc?.photos ?? []) {
        if (y > pageH - 40) {
          doc.addPage();
          y = M + 6;
        }
        if (await addImageContainResolved(doc, ph, M, y, 70, 45)) y += 48;
      }
      y += 4;
      if (y > pageH - 30) {
        doc.addPage();
        y = M + 6;
      }
    }
    /* Tableau (lignes sans domaine ni suivi utile : masquées) */
    const lignesTab = (contenu?.tableauLignes ?? []).filter((ligne) =>
      contenu ? ligneTableauSuiviVisible(contenu, ligne) : false,
    );
    if (lignesTab.length > 0) {
      // Si l’espace restant est trop faible, mettre le tableau sur une page dédiée.
      if (y > pageH - 90) {
        doc.addPage();
        y = M + 6;
      } else if (y > pageH * 0.6 && lignesTab.length >= 6) {
        doc.addPage();
        y = M + 6;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Tableau de suivi", M, y);
      y += 8;
      doc.setFontSize(8);
      const cols = projet.colonnesTableau;
      const colW = (W - 2 * M) / Math.max(cols.length, 1);
      const padX = 1.2;
      const padY = 1.2;
      const lineH = 3.6;
      const headerH = 7.5;

      function drawHeader() {
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        doc.setFillColor(245, 245, 248);
        doc.rect(M, y, W - 2 * M, headerH, "F");
        let x0 = M;
        for (const c of cols) {
          doc.rect(x0, y, colW, headerH, "S");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 30, 40);
          const lab = doc.splitTextToSize(String(c.label).slice(0, 60), colW - 2 * padX) as string[];
          doc.text(lab.slice(0, 2), x0 + padX, y + padY + 2.6);
          x0 += colW;
        }
        y += headerH;
      }

      function pageBreakIfNeeded(nextH: number) {
        if (y + nextH <= pageH - 16) return;
        doc.addPage();
        y = M + 6;
        drawHeader();
      }

      drawHeader();

      for (const ligne of lignesTab) {
        // Préparer le contenu de chaque cellule pour calculer la hauteur.
        const cellLinesByCol: (string[] | null)[] = [];
        for (const c of cols) {
          if (c.id === "etat") {
            cellLinesByCol.push(null);
            continue;
          }
          let cell = "";
          if (c.id === "domaine") {
            cell = projet.domaines.find((d) => d.id === ligne.domaineId)?.label ?? "";
          } else if (c.id === "sujet") cell = ligne.sujet;
          else if (c.id === "responsable") cell = ligne.responsable;
          else if (c.id === "observation") cell = ligne.observation;
          else if (c.id === "relances") cell = ligne.relances;
          else cell = ligne.extra[c.id] ?? "";
          const lines = doc.splitTextToSize(String(cell).slice(0, 2000), colW - 2 * padX) as string[];
          cellLinesByCol.push(lines.length ? lines : [" "]);
        }

        const maxLines = clamp(
          Math.max(
            1,
            ...cellLinesByCol.map((x) => (x ? x.length : 1)),
          ),
          1,
          12,
        );
        const rowH = Math.max(8, padY * 2 + maxLines * lineH);
        pageBreakIfNeeded(rowH);

        let x0 = M;
        doc.setDrawColor(200);
        doc.setLineWidth(0.2);
        doc.setTextColor(20, 20, 25);
        doc.setFont("helvetica", "normal");

        for (let ci = 0; ci < cols.length; ci += 1) {
          const c = cols[ci]!;
          doc.rect(x0, y, colW, rowH, "S");
          if (c.id === "etat") {
            drawEtatCarre(doc, x0 + padX, y + 2.2, ligne.etat);
          } else {
            const lines = cellLinesByCol[ci] ?? [" "];
            const shown = (lines ?? []).slice(0, 12);
            doc.text(shown, x0 + padX, y + padY + 2.6);
          }
          x0 += colW;
        }
        y += rowH;
      }
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

  const lastCenterX = W / 2;
  const footerReserve = 22;
  const coverBoxW = W - 2 * M;
  const coverBoxH = 95;

  const msg =
    projet.dernierePageMessage.trim() || "Merci de votre confiance.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 55);
  const msgLines = doc.splitTextToSize(msg, coverBoxW) as string[];
  const msgLineH = 5.8;
  const msgBlockH = msgLines.length * msgLineH;
  const gapAfterCover = 12;
  const blockH = coverBoxH + gapAfterCover + msgBlockH;
  const lastCoverY = Math.max(M, (pageH - footerReserve - blockH) / 2);

  const hasLastCover = await addImageContainResolved(
    doc,
    b.visuels.couverture,
    M,
    lastCoverY,
    coverBoxW,
    coverBoxH,
  );

  let msgY = lastCoverY + coverBoxH + gapAfterCover;
  if (!hasLastCover) {
    msgY = Math.max(M + 16, (pageH - footerReserve - msgBlockH) / 2);
  }
  for (const line of msgLines) {
    doc.text(line, lastCenterX, msgY, { align: "center" });
    msgY += msgLineH;
  }
  drawFooter(doc, projet.piedPagePdf, pageH);

  return doc.output("blob");
}

export function telechargerRapportActivitePdf(
  projet: RapportActiviteProjet,
  b: RapportBrouillonState,
  nomFichier?: string,
): Promise<void> {
  return telechargerRapportActivitePdfAsync(projet, b, nomFichier);
}

export async function telechargerRapportActivitePdfAsync(
  projet: RapportActiviteProjet,
  b: RapportBrouillonState,
  nomFichier?: string,
): Promise<void> {
  const blob = await genererRapportActivitePdfBlobAsync(projet, b);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    nomFichier?.replace(/[^\w\-]+/g, "_").slice(0, 80) ||
    `rapport-activite-${projet.id.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
