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
  "tk-gestion-devis-v1",
  "tk-gestion-devis-defaults-v1",
  "tk-gestion-devis-clients-v1",
  "tk-gestion-theme-v1",
  "tk_gestion_session",
  "tk_gestion_profile",
  "tk_gestion_auth_token",
  "tk_gestion_auth_email",
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
 * Ordre de restauration : métadonnées légères d’abord, puis projets rapports **avant** la chaîne
 * (souvent très volumineuse à cause des photos), pour limiter l’état incohérent si le quota lâche en cours de route.
 */
const RESTORE_KEY_PRIORITY: readonly string[] = [
  "tk_gestion_profile",
  "tk_gestion_session",
  "tk-gestion-theme-v1",
  "tk-gestion-biens-v1",
  "tk-gestion-finance-v1",
  "tk-gestion-airbnb-ventilation-v1",
  "tk-gestion-devis-v1",
  "tk-gestion-devis-defaults-v1",
  "tk-gestion-devis-clients-v1",
  "tk-gestion-rapports-projets-v1",
  "tk-gestion-rapports-chain-v1",
];

export function sortRestoreKeys(keys: string[]): string[] {
  const pri = new Map(RESTORE_KEY_PRIORITY.map((k, i) => [k, i]));
  return [...keys].sort((a, b) => {
    const ia = pri.get(a) ?? 10_000;
    const ib = pri.get(b) ?? 10_000;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });
}

/** Taille indicative des chaînes à écrire (limite navigateur souvent ~5 Mo / origine). */
export function estimateTkGestionBackupWriteBytes(data: TkGestionBackupV1): number {
  let n = 0;
  for (const [k, v] of Object.entries(data.entries)) {
    n += k.length + v.length;
  }
  return n;
}

export type ApplyTkGestionBackupResult =
  | { ok: true }
  | { ok: false; error: string };

function rollbackTkGestionSnapshot(snapshot: Record<string, string>): void {
  clearAllTkGestionStorageKeys();
  for (const [k, v] of Object.entries(snapshot)) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* rollback partiel si quota ; évite de boucler */
    }
  }
}

/**
 * Efface toutes les clés TK Gestion puis réécrit la sauvegarde.
 * En cas d’erreur (ex. quota localStorage), l’état précédent est restauré autant que possible.
 */
export function applyTkGestionBackupV1(
  data: TkGestionBackupV1,
): ApplyTkGestionBackupResult {
  const previousSnapshot = collectTkGestionEntriesFromLocalStorage();
  try {
    clearAllTkGestionStorageKeys();
    const ordered = sortRestoreKeys(Object.keys(data.entries));
    for (const key of ordered) {
      if (!isTkGestionStorageKey(key)) continue;
      const value = data.entries[key];
      if (typeof value !== "string") continue;
      localStorage.setItem(key, value);
    }
    return { ok: true };
  } catch (e) {
    rollbackTkGestionSnapshot(previousSnapshot);
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      return {
        ok: false,
        error:
          "Stockage du navigateur plein (quota dépassé). Les rapports avec beaucoup de photos en dépassent souvent la limite (~5 Mo par site). Essayez avec Chrome sur ordinateur, ou allégez les images dans les rapports puis refaites une sauvegarde depuis le poste local.",
      };
    }
    return {
      ok: false,
      error: `Échec de la restauration : ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
