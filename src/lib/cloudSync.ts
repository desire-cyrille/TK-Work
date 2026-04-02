import {
  applyTkGestionBackupV1,
  isTkGestionStorageKey,
  TK_GESTION_BACKUP_FORMAT,
  TK_GESTION_BACKUP_VERSION,
} from "./appDataBackup";

export const CLOUD_TOKEN_KEY = "tk_gestion_cloud_token";
export const CLOUD_EMAIL_KEY = "tk_gestion_cloud_email";

export function getCloudToken(): string | null {
  try {
    return localStorage.getItem(CLOUD_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getCloudEmail(): string | null {
  try {
    return localStorage.getItem(CLOUD_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function setCloudSession(token: string, email: string) {
  localStorage.setItem(CLOUD_TOKEN_KEY, token);
  localStorage.setItem(CLOUD_EMAIL_KEY, email.trim().toLowerCase());
}

export function clearCloudSession() {
  localStorage.removeItem(CLOUD_TOKEN_KEY);
  localStorage.removeItem(CLOUD_EMAIL_KEY);
}

/** Données à envoyer au nuage (sans la session navigateur). */
export function collectEntriesForCloudPush(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !isTkGestionStorageKey(key)) continue;
    if (key === "tk_gestion_session") continue;
    if (key === CLOUD_TOKEN_KEY || key === CLOUD_EMAIL_KEY) continue;
    const v = localStorage.getItem(key);
    if (v !== null) entries[key] = v;
  }
  return entries;
}

/** Applique une copie nuage en gardant la session de connexion locale actuelle. */
export function applyCloudPullEntries(entries: Record<string, string>) {
  const sessionKeep = localStorage.getItem("tk_gestion_session");
  const tokenKeep = localStorage.getItem(CLOUD_TOKEN_KEY);
  const emailKeep = localStorage.getItem(CLOUD_EMAIL_KEY);
  const safe: Record<string, string> = { ...entries };
  delete safe["tk_gestion_session"];
  delete safe[CLOUD_TOKEN_KEY];
  delete safe[CLOUD_EMAIL_KEY];
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
      localStorage.setItem(CLOUD_TOKEN_KEY, tokenKeep);
    } catch {
      /* ignore */
    }
  }
  if (emailKeep != null) {
    try {
      localStorage.setItem(CLOUD_EMAIL_KEY, emailKeep);
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

export async function cloudSignup(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const data = (await readJson(r)) as ApiErr & { token?: string; email?: string };
  if (!r.ok) {
    return { ok: false, error: data?.error ?? `Erreur ${r.status}` };
  }
  if (typeof data?.token !== "string" || typeof data?.email !== "string") {
    return { ok: false, error: "Réponse serveur inattendue." };
  }
  setCloudSession(data.token, data.email);
  return { ok: true };
}

export async function cloudSignin(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const data = (await readJson(r)) as ApiErr & { token?: string; email?: string };
  if (!r.ok) {
    return { ok: false, error: data?.error ?? `Erreur ${r.status}` };
  }
  if (typeof data?.token !== "string" || typeof data?.email !== "string") {
    return { ok: false, error: "Réponse serveur inattendue." };
  }
  setCloudSession(data.token, data.email);
  return { ok: true };
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
  const token = getCloudToken();
  if (!token) {
    return { ok: false, error: "Non connecté au nuage." };
  }
  const r = await fetch("/api/sync/pull", {
    headers: { Authorization: `Bearer ${token}` },
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

/**
 * Découpe les entrées en plusieurs objets dont le JSON ne dépasse pas maxBytes,
 * pour enchaîner reset + merge côté API.
 */
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
  const token = getCloudToken();
  if (!token) {
    return { ok: false, error: "Non connecté au nuage." };
  }
  const entries = collectEntriesForCloudPush();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  } as const;

  async function pushBody(
    body: unknown,
  ): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
    const r = await fetch("/api/sync/push", {
      method: "POST",
      headers: { ...headers },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await readJson(r)) as ApiErr;
    if (!r.ok) {
      return {
        ok: false,
        error: data?.error ?? `Erreur ${r.status}`,
        status: r.status,
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
    return {
      ok: false,
      error: reset.error,
    };
  }

  for (const chunk of chunks) {
    if (Object.keys(chunk).length === 0) continue;
    const part = await pushBody({ entries: chunk, merge: true });
    if (!part.ok) {
      return {
        ok: false,
        error: `${part.error} Envoi partiel sur le serveur — refaites « Envoyer vers le nuage » depuis ce poste.`,
      };
    }
  }

  return { ok: true };
}
