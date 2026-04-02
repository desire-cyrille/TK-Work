/**
 * Reconvertit une valeur lue depuis JSONB PostgreSQL en chaîne telle que stockée dans localStorage.
 * (Si le driver ou jsonb a matérialisé un JSON interne comme objet, il faut le resérialiser.)
 */
export function jsonbValueToLocalStorageString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return null;
    }
  }
  return null;
}
