/** Même règle que l’app : clés localStorage TK Gestion (sauf jeton nuage, traité à part). */
const SKIP_SERVER_KEYS = new Set([
  "tk_gestion_session",
  "tk_gestion_cloud_token",
  "tk_gestion_cloud_email",
  "tk_gestion_auth_token",
  "tk_gestion_auth_email",
]);

export function isAllowedSyncKey(key: string): boolean {
  return key.startsWith("tk-gestion-") || key.startsWith("tk_gestion_");
}

/**
 * Taille max du JSON « entries » par requête (remplacement ou fragment).
 * Aligné sur la limite de corps des fonctions Vercel (~4,5 Mo) : marge pour l’enveloppe JSON.
 * @see https://vercel.com/docs/functions/runtimes#request-body-size
 */
export const MAX_SYNC_CHUNK_BYTES = 3 * 1024 * 1024;

export function validateAndNormalizeEntries(
  raw: unknown,
  maxPayloadBytes: number = MAX_SYNC_CHUNK_BYTES,
): { ok: true; entries: Record<string, string> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "« entries » doit être un objet." };
  }
  const entries: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (SKIP_SERVER_KEYS.has(k)) continue;
    if (!isAllowedSyncKey(k)) {
      return { ok: false, error: `Clé non autorisée : ${k}` };
    }
    if (typeof v !== "string") {
      return { ok: false, error: `Valeur invalide pour ${k} (chaîne attendue).` };
    }
    entries[k] = v;
  }
  const json = JSON.stringify(entries);
  if (json.length > maxPayloadBytes) {
    return {
      ok: false,
      error: `Ce fragment dépasse la taille max (${Math.round(maxPayloadBytes / (1024 * 1024))} Mo). Réduisez les photos dans les rapports ou utilisez une sauvegarde fichier.`,
    };
  }
  return { ok: true, entries };
}
