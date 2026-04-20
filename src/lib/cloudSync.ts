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

/** Applique une copie serveur en conservant connexion et jeton sur cet appareil. */
export function applyCloudPullEntries(entries: Record<string, string>) {
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
  { ok: true } | { ok: false; error: string }
> {
  const token = getAuthToken();
  const entries = collectEntriesForCloudPush();
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  async function pushBody(
    body: unknown,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const r = await fetch("/api/sync/push", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await readJson(r)) as ApiErr;
    if (!r.ok) {
      return {
        ok: false,
        error: data?.error ?? `Erreur ${r.status}`,
      };
    }
    return { ok: true };
  }

  const innerLen = JSON.stringify(entries).length;
  if (innerLen <= CLOUD_ENTRIES_MAX_JSON_BYTES) {
    const r = await pushBody({ entries });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true };
  }

  const chunks = chunkEntriesByJsonSize(entries, CLOUD_ENTRIES_MAX_JSON_BYTES);
  const reset = await pushBody({ reset: true });
  if (!reset.ok) {
    return { ok: false, error: reset.error };
  }

  for (const chunk of chunks) {
    if (Object.keys(chunk).length === 0) continue;
    const part = await pushBody({ entries: chunk, merge: true });
    if (!part.ok) {
      return {
        ok: false,
        error: `${part.error} Envoi partiel sur le serveur — refaites « Envoyer vers le serveur » depuis cet appareil.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Après connexion ou inscription : remplace les données locales par la copie serveur si elle existe.
 * Indique si un rechargement complet est nécessaire pour rafraîchir l’application.
 */
export async function syncCloudPullAfterLogin(): Promise<{
  shouldHardNavigate: boolean;
  pullError?: string;
  applyError?: string;
}> {
  const r = await cloudPull();
  if (!r.ok) {
    return { shouldHardNavigate: false, pullError: r.error };
  }
  if (r.version === 0 || Object.keys(r.entries).length === 0) {
    return { shouldHardNavigate: false };
  }
  const applied = applyCloudPullEntries(r.entries);
  if (!applied.ok) {
    return { shouldHardNavigate: false, applyError: applied.error };
  }
  return { shouldHardNavigate: true };
}

/** Rechargement vers la page Fonctions après application d’une copie nuage (état React obsolète). */
export function hardNavigateToFonctionsAfterCloudPull(): void {
  const base = import.meta.env.BASE_URL;
  const prefix = typeof base === "string" ? base.replace(/\/$/, "") : "";
  const path = prefix ? `${prefix}/fonctions` : "/fonctions";
  window.location.assign(path);
}
