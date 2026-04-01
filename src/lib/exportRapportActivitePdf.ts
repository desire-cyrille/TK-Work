import { jsPDF } from "jspdf";

export function telechargerRapportActivitePdf(input: {
  titre: string;
  typeLibelle: string;
  contexteMetier?: string;
  periodeLibelle: string;
  genereLeLibelle: string;
  enteteContexte?: string[];
  domainesActivite?: { titre: string; corps: string }[];
  observations: string;
  piedNote: string;
  nomFichierPrefix: string;
}): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marge = 15;
  const maxW = 180;
  let y = 18;

  function avancer(h: number) {
    y += h;
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  for (const chunk of doc.splitTextToSize(input.titre, maxW)) {
    doc.text(chunk, marge, y);
    avancer(7);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  for (const part of doc.splitTextToSize(input.typeLibelle, maxW)) {
    doc.text(part, marge, y);
    avancer(5);
  }
  doc.setTextColor(0);
  doc.text(`Période / focus : ${input.periodeLibelle}`, marge, y);
  avancer(6);
  if (input.contexteMetier?.trim()) {
    doc.setFontSize(9);
    doc.setTextColor(90);
    for (const part of doc.splitTextToSize(input.contexteMetier.trim(), maxW)) {
      doc.text(part, marge, y);
      avancer(4.5);
    }
    doc.setTextColor(0);
    doc.setFontSize(10);
  }
  doc.text(input.genereLeLibelle, marge, y);
  avancer(6);

  if (input.enteteContexte && input.enteteContexte.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Mission et client", marge, y);
    avancer(6);
    doc.setFont("helvetica", "normal");
    for (const line of input.enteteContexte) {
      for (const part of doc.splitTextToSize(line, maxW)) {
        doc.text(part, marge, y);
        avancer(5);
      }
    }
    avancer(4);
  }

  const domaines = input.domainesActivite?.filter((d) => d.corps.trim()) ?? [];
  if (domaines.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Activité par domaine — mission parking", marge, y);
    avancer(7);
    doc.setFontSize(10);
    for (const bloc of domaines) {
      doc.setFont("helvetica", "bold");
      for (const part of doc.splitTextToSize(bloc.titre, maxW)) {
        doc.text(part, marge, y);
        avancer(5);
      }
      doc.setFont("helvetica", "normal");
      for (const part of doc.splitTextToSize(bloc.corps.trim(), maxW)) {
        doc.text(part, marge, y);
        avancer(5);
      }
      avancer(2);
    }
  }

  const obs = input.observations.trim();
  if (obs) {
    avancer(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Synthèse et notes complémentaires", marge, y);
    avancer(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const part of doc.splitTextToSize(obs, maxW)) {
      doc.text(part, marge, y);
      avancer(5);
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  for (const part of doc.splitTextToSize(input.piedNote, maxW)) {
    if (y > 275) {
      doc.addPage();
      y = 18;
    }
    doc.text(part, marge, y);
    y += 4;
  }

  const safe = input.titre
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 50);
  doc.save(`${input.nomFichierPrefix}${safe || "export"}.pdf`);
}
