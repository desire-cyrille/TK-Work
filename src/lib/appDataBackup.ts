/** Export / import global des données stockées en localStorage par l’application. */

export const TK_GESTION_BACKUP_FORMAT = "tk-gestion-backup" as const;
export const TK_GESTION_BACKUP_VERSION = 1 as const;

/**
 * Préfixes des clés appartenant à TK Gestion (biens, finance, Airbnb, rapports, thème, session…).
 * L’export parcourt tout le localStorage et inclut chaque clé qui correspond, pour ne rien omettre
 * (ex. rapports : `tk-gestion-rapports-projets-v1`, `tk-gestion-rapports-chain-v1`).
 */
export function isTkGestionStorageKey(key: string): boolean {
  return key.startsWith("tk-gestion-") || key.startsWith("tk_gestion_");
}

/**
 * Liste documentaire des modules connus (non exhaustive : l’export utilise {@link isTkGestionStorageKey}).
 */
export const TK_GESTION_MANAGED_STORAGE_KEYS = [
  "tk-gestion-biens-v1",
  "tk-gestion-finance-v1",
  "tk-gestion-airbnb-ventilation-v1",
  "tk-gestion-rapports-projets-v1",
  "tk-gestion-rapports-chain-v1",
  "tk-gestion-theme-v1",
  "tk_gestion_session",
  "tk_gestion_profile",
] as const;

export type TkGestionManagedStorageKey =
  (typeof TK_GESTION_MANAGED_STORAGE_KEYS)[number];

export type TkGestionBackupV1 = {
  format: typeof TK_GESTION_BACKUP_FORMAT;
  version: typeof TK_GESTION_BACKUP_VERSION;
  exportedAt: string;
  /** Clés localStorage → valeurs brutes (toutes les entrées TK Gestion présentes au moment de l’export). */
  entries: Record<string, string>;
};

function collectTkGestionEntriesFromLocalStorage(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !isTkGestionStorageKey(key)) continue;
    const v = localStorage.getItem(key);
    if (v !== null) entries[key] = v;
  }
  return entries;
}

export function buildTkGestionBackupV1(): TkGestionBackupV1 {
  return {
    format: TK_GESTION_BACKUP_FORMAT,
    version: TK_GESTION_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: collectTkGestionEntriesFromLocalStorage(),
  };
}

/** @returns Nombre de clés localStorage non vides incluses dans le fichier. */
export function downloadTkGestionBackup(): number {
  const data = buildTkGestionBackupV1();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  a.download = `tk-gestion-sauvegarde-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return Object.keys(data.entries).length;
}

export function parseTkGestionBackupJson(
  text: string,
): { ok: true; data: TkGestionBackupV1 } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "Fichier JSON invalide." };
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Le fichier ne contient pas un objet JSON." };
  }
  const o = raw as Record<string, unknown>;
  if (o.format !== TK_GESTION_BACKUP_FORMAT) {
    return {
      ok: false,
      error:
        "Ce fichier n’est pas une sauvegarde TK Gestion (format attendu manquant).",
    };
  }
  if (o.version !== 1) {
    return {
      ok: false,
      error: `Version de sauvegarde non prise en charge (reçu : ${String(o.version)}).`,
    };
  }
  if (typeof o.exportedAt !== "string" || !o.exportedAt.trim()) {
    return { ok: false, error: "Sauvegarde incomplète (date d’export)." };
  }
  const ent = o.entries;
  if (!ent || typeof ent !== "object" || Array.isArray(ent)) {
    return { ok: false, error: "Sauvegarde incomplète (section « entries »)." };
  }
  const entries: Record<string, string> = {};
  for (const [k, v] of Object.entries(ent)) {
    if (!isTkGestionStorageKey(k)) {
      return {
        ok: false,
        error: `Clé non reconnue dans la sauvegarde : « ${k} ».`,
      };
    }
    if (typeof v !== "string") {
      return {
        ok: false,
        error: `Valeur invalide pour la clé « ${k} » (chaîne attendue).`,
      };
    }
    entries[k] = v;
  }
  return {
    ok: true,
    data: {
      format: TK_GESTION_BACKUP_FORMAT,
      version: TK_GESTION_BACKUP_VERSION,
      exportedAt: o.exportedAt.trim(),
      entries,
    },
  };
}

function clearAllTkGestionStorageKeys(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && isTkGestionStorageKey(key)) toRemove.push(key);
  }
  for (const key of toRemove) {
    localStorage.removeItem(key);
  }
}

/**
 * Efface toutes les clés TK Gestion du navigateur puis réécrit celles présentes dans la sauvegarde.
 * Après appel, un rechargement de la page est nécessaire pour rafraîchir les contextes React.
 */
export function applyTkGestionBackupV1(data: TkGestionBackupV1): void {
  clearAllTkGestionStorageKeys();
  for (const [key, value] of Object.entries(data.entries)) {
    if (!isTkGestionStorageKey(key)) continue;
    localStorage.setItem(key, value);
  }
}
