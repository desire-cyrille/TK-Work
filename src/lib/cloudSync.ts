import {
  applyTkGestionBackupV1,
  isTkGestionStorageKey,
  TK_GESTION_BACKUP_FORMAT,
  TK_GESTION_BACKUP_VERSION,
} from "./appDataBackup";
import {
  AUTH_EMAIL_KEY,
  AUTH_TOKEN_KEY,
  getAuthToken,
} from "./authToken";

const LEGACY_CLOUD_TOKEN = "tk_gestion_cloud_token";
const LEGACY_CLOUD_EMAIL = "tk_gestion_cloud_email";
const AUTOBACKUP_BEFORE_PULL_KEY = "tk-gestion-autobackup-before-cloudpull-v1";
const FLUSH_BEFORE_CLOUD_PUSH_EVENT = "tk-gestion-flush-before-cloud-push";
/** Dernière version serveur appliquée ou envoyée avec succès (référence unique = nuage). */
export const CLOUD_SERVER_VERSION_KEY = "tk-gestion-cloud-server-version-v1";

export type CloudSessionBootstrapResult = {
  shouldHardNavigate: boolean;
  pulled?: boolean;
  pushed?: boolean;
  pullError?: string;
  applyError?: string;
  pushError?: string;
};

let bootstrapInFlight: Promise<CloudSessionBootstrapResult> | null = null;

export function getRememberedCloudServerVersion(): number {
  try {
    const n = Number(localStorage.getItem(CLOUD_SERVER_VERSION_KEY) ?? "0");
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function rememberCloudServerVersion(version: number): void {
  if (!Number.isFinite(version) || version < 0) return;
  try {
    localStorage.setItem(CLOUD_SERVER_VERSION_KEY, String(Math.floor(version)));
  } catch {
    /* ignore */
  }
}

/** Données métier présentes (évite d’envoyer / considérer comme « vide » un état thème seul). */
export function hasSubstantiveLocalData(
  entries: Record<string, string>,
): boolean {
  const keys = Object.keys(entries);
  if (keys.length === 0) return false;

  const biensRaw = entries["tk-gestion-biens-v1"];
  if (biensRaw) {
    try {
      const b = JSON.parse(biensRaw) as {
        bailleurs?: unknown[];
        logements?: unknown[];
        locataires?: unknown[];
        contratsLocation?: unknown[];
      };
      if ((b.bailleurs?.length ?? 0) > 0) return true;
      if ((b.logements?.length ?? 0) > 0) return true;
      if ((b.locataires?.length ?? 0) > 0) return true;
      if ((b.contratsLocation?.length ?? 0) > 0) return true;
    } catch {
      /* ignore */
    }
  }

  for (const k of keys) {
    if (k.includes("devis") && (entries[k]?.length ?? 0) > 80) return true;
    if (k.includes("rapport-activite") && (entries[k]?.length ?? 0) > 120) {
      return true;
    }
  }

  const finRaw = entries["tk-gestion-finance-v1"];
  if (finRaw) {
    try {
      const f = JSON.parse(finRaw) as { moisParContrat?: Record<string, unknown> };
      if (Object.keys(f.moisParContrat ?? {}).length > 0) return true;
    } catch {
      /* ignore */
    }
  }

  const total = Object.values(entries).reduce((s, v) => s + v.length, 0);
  return total > 800;
}

function serverHasSubstantiveData(
  pull: { version: number; entries: Record<string, string> },
): boolean {
  return pull.version > 0 && Object.keys(pull.entries).length > 0;
}

function isAuthOrSessionKey(key: string): boolean {
  return (
    key === "tk_gestion_session" ||
    key === AUTH_TOKEN_KEY ||
    key === AUTH_EMAIL_KEY ||
    key === LEGACY_CLOUD_TOKEN ||
    key === LEGACY_CLOUD_EMAIL
  );
}

/** Données à envoyer au serveur (sans jeton ni session). */
export function collectEntriesForCloudPush(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !isTkGestionStorageKey(key)) continue;
    if (isAuthOrSessionKey(key)) continue;
    const v = localStorage.getItem(key);
    if (v !== null) entries[key] = v;
  }
  return entries;
}

function collectTkGestionEntriesWithoutAuth(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !isTkGestionStorageKey(key)) continue;
    if (isAuthOrSessionKey(key)) continue;
    const v = localStorage.getItem(key);
    if (v !== null) entries[key] = v;
  }
  return entries;
}

function saveAutoBackupBeforePull(): void {
  try {
    const entries = collectTkGestionEntriesWithoutAuth();
    if (Object.keys(entries).length === 0) return;
    const payload = {
      format: TK_GESTION_BACKUP_FORMAT,
      version: TK_GESTION_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      entries,
    };
    localStorage.setItem(AUTOBACKUP_BEFORE_PULL_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** Applique une copie serveur en conservant connexion et jeton sur cet appareil. */
export function applyCloudPullEntries(entries: Record<string, string>) {
  // Sauvegarde locale automatique (dernier recours) avant tout écrasement.
  saveAutoBackupBeforePull();

  const sessionKeep = localStorage.getItem("tk_gestion_session");
  const tokenKeep = localStorage.getItem(AUTH_TOKEN_KEY);
  const emailKeep = localStorage.getItem(AUTH_EMAIL_KEY);
  const legacyTok = localStorage.getItem(LEGACY_CLOUD_TOKEN);
  const legacyEm = localStorage.getItem(LEGACY_CLOUD_EMAIL);
  const safe: Record<string, string> = { ...entries };
  delete safe["tk_gestion_session"];
  delete safe[AUTH_TOKEN_KEY];
  delete safe[AUTH_EMAIL_KEY];
  delete safe[LEGACY_CLOUD_TOKEN];
  delete safe[LEGACY_CLOUD_EMAIL];
  const data = {
    format: TK_GESTION_BACKUP_FORMAT,
    version: TK_GESTION_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: safe,
  };
  const r = applyTkGestionBackupV1(data);
  if (sessionKeep !== null) {
    try {
      localStorage.setItem("tk_gestion_session", sessionKeep);
    } catch {
      /* ignore */
    }
  }
  if (tokenKeep != null) {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, tokenKeep);
    } catch {
      /* ignore */
    }
  }
  if (emailKeep != null) {
    try {
      localStorage.setItem(AUTH_EMAIL_KEY, emailKeep);
    } catch {
      /* ignore */
    }
  }
  if (legacyTok != null) {
    try {
      localStorage.setItem(LEGACY_CLOUD_TOKEN, legacyTok);
    } catch {
      /* ignore */
    }
  }
  if (legacyEm != null) {
    try {
      localStorage.setItem(LEGACY_CLOUD_EMAIL, legacyEm);
    } catch {
      /* ignore */
    }
  }
  return r;
}

type ApiErr = { error?: string };

async function readJson(res: Response): Promise<unknown> {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return { raw: t };
  }
}

export async function cloudPull(): Promise<
  | {
      ok: true;
      entries: Record<string, string>;
      updatedAt: string | null;
      version: number;
    }
  | { ok: false; error: string }
> {
  const token = getAuthToken();
  const r = await fetch("/api/sync/pull", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  const data = (await readJson(r)) as ApiErr & {
    entries?: Record<string, string>;
    updatedAt?: string | null;
    version?: number;
  };
  if (!r.ok) {
    return { ok: false, error: data?.error ?? `Erreur ${r.status}` };
  }
  const entries =
    data.entries && typeof data.entries === "object" && !Array.isArray(data.entries)
      ? data.entries
      : {};
  const version = typeof data.version === "number" ? data.version : 0;
  return {
    ok: true,
    entries,
    version,
    updatedAt:
      typeof data.updatedAt === "string" || data.updatedAt === null
        ? data.updatedAt
        : null,
  };
}

/** Aligné sur api/_lib/syncPayload.ts (plafond corps HTTP Vercel ~4,5 Mo). */
const CLOUD_ENTRIES_MAX_JSON_BYTES = 3 * 1024 * 1024;

function chunkEntriesByJsonSize(
  entries: Record<string, string>,
  maxBytes: number,
): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  let cur: Record<string, string> = {};

  function size(obj: Record<string, string>) {
    return JSON.stringify(obj).length;
  }

  for (const [k, v] of Object.entries(entries)) {
    const next = { ...cur, [k]: v };
    if (size(next) <= maxBytes) {
      cur = next;
      continue;
    }
    if (Object.keys(cur).length > 0) {
      out.push(cur);
      cur = {};
    }
    cur = { [k]: v };
    if (size(cur) > maxBytes) {
      out.push(cur);
      cur = {};
    }
  }
  if (Object.keys(cur).length > 0) out.push(cur);
  return out;
}

export async function cloudPush(): Promise<
  { ok: true; version: number } | { ok: false; error: string }
> {
  const token = getAuthToken();
  // Avant de lire localStorage, laisser les écrans en cours (rapport, devis, etc.)
  // forcer l’écriture immédiate de leurs brouillons (anti perte sur clic rapide).
  try {
    window.dispatchEvent(new Event(FLUSH_BEFORE_CLOUD_PUSH_EVENT));
  } catch {
    /* ignore */
  }
  const entries = collectEntriesForCloudPush();
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  async function pushBody(
    body: unknown,
  ): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
    const r = await fetch("/api/sync/push", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await readJson(r)) as ApiErr & { version?: number };
    if (!r.ok) {
      return {
        ok: false,
        error: data?.error ?? `Erreur ${r.status}`,
      };
    }
    const version = typeof data.version === "number" ? data.version : 0;
    return { ok: true, version };
  }

  if (Object.keys(entries).length === 0) {
    return { ok: false, error: "Aucune donnée locale à envoyer." };
  }

  let lastVersion = 0;
  const innerLen = JSON.stringify(entries).length;
  if (innerLen <= CLOUD_ENTRIES_MAX_JSON_BYTES) {
    const r = await pushBody({ entries });
    if (!r.ok) return { ok: false, error: r.error };
    lastVersion = r.version;
  } else {
    const chunks = chunkEntriesByJsonSize(entries, CLOUD_ENTRIES_MAX_JSON_BYTES);
    const reset = await pushBody({ reset: true });
    if (!reset.ok) {
      return { ok: false, error: reset.error };
    }
    lastVersion = reset.version;

    for (const chunk of chunks) {
      if (Object.keys(chunk).length === 0) continue;
      const part = await pushBody({ entries: chunk, merge: true });
      if (!part.ok) {
        return {
          ok: false,
          error: `${part.error} Envoi partiel sur le serveur — refaites « Envoyer vers le serveur » depuis cet appareil.`,
        };
      }
      lastVersion = part.version;
    }
  }

  if (lastVersion > 0) rememberCloudServerVersion(lastVersion);
  return { ok: true, version: lastVersion };
}

/**
 * Aligne cet appareil sur le nuage (source de vérité) :
 * - serveur avec données → télécharge si plus récent ou si le local est vide ;
 * - serveur vide + local rempli → envoi automatique vers le serveur.
 */
async function runCloudSessionBootstrap(): Promise<CloudSessionBootstrapResult> {
  const pull = await cloudPull();
  if (!pull.ok) {
    return { shouldHardNavigate: false, pullError: pull.error };
  }

  const localEntries = collectEntriesForCloudPush();
  const localSubstantive = hasSubstantiveLocalData(localEntries);
  const remoteSubstantive = serverHasSubstantiveData(pull);
  const remembered = getRememberedCloudServerVersion();

  if (remoteSubstantive) {
    const serverNewer = pull.version > remembered;
    const shouldApply = serverNewer || !localSubstantive;
    if (!shouldApply) {
      if (remembered === 0) rememberCloudServerVersion(pull.version);
      return { shouldHardNavigate: false };
    }
    const applied = applyCloudPullEntries(pull.entries);
    if (!applied.ok) {
      return { shouldHardNavigate: false, applyError: applied.error };
    }
    rememberCloudServerVersion(pull.version);
    return { shouldHardNavigate: true, pulled: true };
  }

  if (localSubstantive) {
    const pushed = await cloudPush();
    if (!pushed.ok) {
      return { shouldHardNavigate: false, pushError: pushed.error };
    }
    if (pushed.version > 0) {
      rememberCloudServerVersion(pushed.version);
    } else {
      const after = await cloudPull();
      if (after.ok && after.version > 0) {
        rememberCloudServerVersion(after.version);
      }
    }
    return { shouldHardNavigate: false, pushed: true };
  }

  return { shouldHardNavigate: false };
}

/** Aligne l’appareil sur le nuage (idempotent ; un seul appel simultané). */
export function syncCloudSessionBootstrap(): Promise<CloudSessionBootstrapResult> {
  if (!getAuthToken()) {
    return Promise.resolve({ shouldHardNavigate: false });
  }
  if (bootstrapInFlight) return bootstrapInFlight;
  bootstrapInFlight = runCloudSessionBootstrap().finally(() => {
    bootstrapInFlight = null;
  });
  return bootstrapInFlight;
}

/**
 * Après connexion ou inscription : alignement automatique sur le nuage.
 */
export async function syncCloudPullAfterLogin(): Promise<{
  shouldHardNavigate: boolean;
  pullError?: string;
  applyError?: string;
}> {
  const r = await syncCloudSessionBootstrap();
  return {
    shouldHardNavigate: r.shouldHardNavigate,
    pullError: r.pullError,
    applyError: r.applyError,
  };
}

/** Rechargement vers la page Fonctions après application d’une copie nuage (état React obsolète). */
export function hardNavigateToFonctionsAfterCloudPull(): void {
  const base = import.meta.env.BASE_URL;
  const prefix = typeof base === "string" ? base.replace(/\/$/, "") : "";
  const path = prefix ? `${prefix}/fonctions` : "/fonctions";
  window.location.assign(path);
}
