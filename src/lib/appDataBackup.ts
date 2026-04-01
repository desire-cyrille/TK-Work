/** Export / import global des données stockées en localStorage par l’application. */

export const TK_GESTION_BACKUP_FORMAT = "tk-gestion-backup" as const;
export const TK_GESTION_BACKUP_VERSION = 1 as const;

/**
 * Liste des clés connues (biens, finance, Airbnb, rapports, thème, session).
 * Toute nouvelle persistance locale devrait être ajoutée ici pour être incluse dans les sauvegardes.
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
  entries: Partial<Record<TkGestionManagedStorageKey, string>>;
};

function isManagedKey(k: string): k is TkGestionManagedStorageKey {
  return (TK_GESTION_MANAGED_STORAGE_KEYS as readonly string[]).includes(k);
}

export function buildTkGestionBackupV1(): TkGestionBackupV1 {
  const entries: Partial<Record<TkGestionManagedStorageKey, string>> = {};
  for (const key of TK_GESTION_MANAGED_STORAGE_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) entries[key] = v;
  }
  return {
    format: TK_GESTION_BACKUP_FORMAT,
    version: TK_GESTION_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
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
  const entries: Partial<Record<TkGestionManagedStorageKey, string>> = {};
  for (const [k, v] of Object.entries(ent)) {
    if (!isManagedKey(k)) continue;
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

/**
 * Efface toutes les clés gérées puis réécrit celles présentes dans la sauvegarde.
 * Après appel, un rechargement de la page est nécessaire pour rafraîchir les contextes React.
 */
export function applyTkGestionBackupV1(data: TkGestionBackupV1): void {
  for (const key of TK_GESTION_MANAGED_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  for (const key of TK_GESTION_MANAGED_STORAGE_KEYS) {
    const v = data.entries[key];
    if (typeof v === "string") localStorage.setItem(key, v);
  }
}
