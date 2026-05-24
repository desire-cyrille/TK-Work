/** Export / import global des données stockées en localStorage par l’application. */

import {
  clearTkGestionStorageCompletely,
  collectTkGestionStorageEntries,
  flushTkGestionStorageWrites,
  removeTkGestionStorageValue,
  writeTkGestionStorageValue,
} from "./tkGestionStorageBridge";

export const TK_GESTION_BACKUP_FORMAT = "tk-gestion-backup" as const;
export const TK_GESTION_BACKUP_VERSION = 1 as const;

/**
 * Préfixes des clés appartenant à TK Gestion (biens, finance, Airbnb, thème, session…).
 * L’export parcourt tout le localStorage et inclut chaque clé qui correspond, pour ne rien omettre
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
  "tk-gestion-devis-v1",
  "tk-gestion-devis-defaults-v1",
  "tk-gestion-devis-clients-v1",
  "tk-gestion-rapport-activite-projets-v2",
  "tk-gestion-rapport-activite-rapports-v2",
  "tk-gestion-rapport-activite-projets-v3",
  "tk-gestion-rapport-activite-rapports-v3",
  "tk-gestion-rapport-activite-idb-export-v1",
  "tk-gestion-theme-v1",
  "tk-gestion-theme-v2",
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
  return collectTkGestionStorageEntries();
}

export function buildTkGestionBackupV1(): TkGestionBackupV1 {
  return {
    format: TK_GESTION_BACKUP_FORMAT,
    version: TK_GESTION_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: collectTkGestionEntriesFromLocalStorage(),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoStampLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoStampLocalWithTime(d: Date): string {
  return `${isoStampLocal(d)}_${pad2(d.getHours())}-${pad2(d.getMinutes())}`;
}

export type DownloadBackupOptions = {
  /** Ex: "backup_TK_RENT" */
  prefix?: string;
  /** Ajoute _HH-mm pour éviter les collisions. */
  includeTime?: boolean;
};

/** @returns Nombre de clés localStorage non vides incluses dans le fichier. */
export function downloadTkGestionBackup(options?: DownloadBackupOptions): number {
  const data = buildTkGestionBackupV1();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  const d = new Date();
  const stamp = options?.includeTime ? isoStampLocalWithTime(d) : isoStampLocal(d);
  const prefix = (options?.prefix ?? "tk-gestion-sauvegarde").trim() || "tk-gestion-sauvegarde";
  a.download = `${prefix}-${stamp}.json`;
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

/** Cache / secours : ne pas réimporter depuis un fichier, supprimer avant restauration (quota Safari). */
export const EPHEMERAL_TK_GESTION_KEYS = [
  "tk-gestion-autobackup-before-cloudpull-v1",
  "tk-gestion-cloud-autosync-last-pushed-hash-v1",
  "tk-gestion-cloud-server-version-v1",
] as const;

export function purgeEphemeralTkGestionStorage(): void {
  for (const key of EPHEMERAL_TK_GESTION_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function filterEntriesForRestore(
  entries: Record<string, string>,
): Record<string, string> {
  const skip = new Set<string>(EPHEMERAL_TK_GESTION_KEYS);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    if (skip.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function clearAllTkGestionStorageKeysSync(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && isTkGestionStorageKey(key)) toRemove.push(key);
  }
  for (const key of toRemove) {
    removeTkGestionStorageValue(key);
  }
}

/**
 * Ordre de restauration : métadonnées légères d’abord, puis données métier.
 */
const RESTORE_KEY_PRIORITY: readonly string[] = [
  "tk_gestion_profile",
  "tk_gestion_session",
  "tk-gestion-theme-v1",
  "tk-gestion-theme-v2",
  "tk-gestion-biens-v1",
  "tk-gestion-finance-v1",
  "tk-gestion-airbnb-ventilation-v1",
  "tk-gestion-devis-v1",
  "tk-gestion-devis-defaults-v1",
  "tk-gestion-devis-clients-v1",
  "tk-gestion-rapport-activite-projets-v2",
  "tk-gestion-rapport-activite-rapports-v2",
  "tk-gestion-rapport-activite-projets-v3",
  "tk-gestion-rapport-activite-rapports-v3",
  "tk-gestion-rapport-activite-idb-export-v1",
];

export function sortRestoreKeys(
  keys: string[],
  entries?: Record<string, string>,
): string[] {
  const pri = new Map(RESTORE_KEY_PRIORITY.map((k, i) => [k, i]));
  return [...keys].sort((a, b) => {
    const ia = pri.get(a) ?? 10_000;
    const ib = pri.get(b) ?? 10_000;
    if (ia !== ib) return ia - ib;
    if (entries) {
      const la = entries[a]?.length ?? 0;
      const lb = entries[b]?.length ?? 0;
      if (la !== lb) return la - lb;
    }
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
  | { ok: true; partial?: boolean; skippedKeys?: string[] }
  | { ok: false; error: string };

function rollbackTkGestionSnapshot(snapshot: Record<string, string>): void {
  clearAllTkGestionStorageKeysSync();
  for (const [k, v] of Object.entries(snapshot)) {
    try {
      writeTkGestionStorageValue(k, v);
    } catch {
      /* rollback partiel si quota ; évite de boucler */
    }
  }
}

function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "QuotaExceededError";
}

function safariQuotaRestoreHint(mb: number): string {
  return [
    "Stockage Safari saturé (quota ~5 Mo par site).",
    mb >= 4.8
      ? `Votre sauvegarde fait ~${mb.toFixed(1)} Mo : même vide, Safari peut refuser le tout.`
      : "Libérez de l’espace (voir ci-dessous) puis réessayez.",
    "Réglages Safari → Confidentialité → Gérer les données de site web → supprimez l’ancienne entrée de ce site, ou ouvrez une fenêtre privée, reconnectez-vous, restaurez le fichier JSON.",
  ].join(" ");
}

/**
 * Efface toutes les clés TK Gestion puis réécrit la sauvegarde.
 * Les grosses valeurs basculent automatiquement en IndexedDB (Safari).
 */
export async function applyTkGestionBackupV1(
  data: TkGestionBackupV1,
): Promise<ApplyTkGestionBackupResult> {
  purgeEphemeralTkGestionStorage();
  const entries = filterEntriesForRestore(data.entries);
  const writeBytes = estimateTkGestionBackupWriteBytes({
    ...data,
    entries,
  });
  const mb = writeBytes / (1024 * 1024);

  const previousSnapshot = collectTkGestionEntriesFromLocalStorage();
  try {
    await clearTkGestionStorageCompletely();
    const ordered = sortRestoreKeys(Object.keys(entries), entries);
    const skippedKeys: string[] = [];
    for (const key of ordered) {
      if (!isTkGestionStorageKey(key)) continue;
      const value = entries[key];
      if (typeof value !== "string") continue;
      try {
        writeTkGestionStorageValue(key, value);
      } catch (e) {
        if (isQuotaError(e)) {
          skippedKeys.push(key);
          continue;
        }
        throw e;
      }
    }
    await flushTkGestionStorageWrites();
    if (skippedKeys.length > 0) {
      return {
        ok: true,
        partial: true,
        skippedKeys,
      };
    }
    return { ok: true };
  } catch (e) {
    rollbackTkGestionSnapshot(previousSnapshot);
    if (isQuotaError(e)) {
      return {
        ok: false,
        error: safariQuotaRestoreHint(mb),
      };
    }
    return {
      ok: false,
      error: `Échec de la restauration : ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
