import type { Logement } from "../types/domain";

export function formatAdresseComplete(l: Logement): string {
  const ligne1 = [l.adresse, l.complementAdresse].filter(Boolean).join(", ");
  const ligne2 = [l.codePostal, l.ville].filter(Boolean).join(" ");
  if (ligne1 && ligne2) return `${ligne1} — ${ligne2}`;
  return ligne1 || ligne2 || l.adresse;
}

export function formatLogementMeta(l: Logement): string {
  const parts: string[] = [];
  if (l.surfaceM2.trim()) parts.push(`${l.surfaceM2.trim()} m²`);
  if (l.nombrePieces.trim())
    parts.push(
      `${l.nombrePieces.trim()} pièce${l.nombrePieces.trim() === "1" ? "" : "s"}`
    );
  if (l.etage.trim()) parts.push(`étage : ${l.etage.trim()}`);
  if (l.meuble === "oui") parts.push("meublé");
  if (l.meuble === "non") parts.push("non meublé");
  if (l.copropriete === "oui") parts.push("copropriété");
  return parts.join(" · ");
}
