import {
  applyTkGestionBackupV1,
  isTkGestionStorageKey,
  TK_GESTION_BACKUP_FORMAT,
  TK_GESTION_BACKUP_VERSION,
} from "./appDataBackup";
import {
  AUTH_EMAIL_KEY,
  AUTH_TOKEN_KEY,
  getValidAuthToken,
} from "./authToken";

const LEGACY_CLOUD_TOKEN = "tk_gestion_cloud_token";
const LEGACY_CLOUD_EMAIL = "tk_gestion_cloud_email";
const AUTOBACKUP_BEFORE_PULL_KEY = "tk-gestion-autobackup-before-cloudpull-v1";
export const FLUSH_BEFORE_CLOUD_PUSH_EVENT = "tk-gestion-flush-before-cloud-push";
const CLOUD_BOOTSTRAP_APPLIED_VERSION_SESSION_KEY =
  "tk-gestion-cloud-bootstrap-applied-version-v1";
const CLOUD_BOOTSTRAP_APPLIED_VERSION_LS_KEY =
  "tk-gestion-cloud-bootstrap-applied-version-ls-v1";
const CLOUD_HARD_NAV_RELOAD_ONCE_KEY =
  "tk-gestion-cloud-hard-nav-reload-once-v1";

function getBootstrapAppliedVersion(): number {
  let ss = 0;
  let ls = 0;
  try {
    ss = Number(
      sessionStorage.getItem(CLOUD_BOOTSTRAP_APPLIED_VERSION_SESSION_KEY) ??
        "0",
    );
  } catch {
    /* ignore */
  }
  try {
    ls = Number(
      localStorage.getItem(CLOUD_BOOTSTRAP_APPLIED_VERSION_LS_KEY) ?? "0",
    );
  } catch {
    /* ignore */
  }
  const n = Math.max(ss, ls);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function rememberBootstrapAppliedVersion(version: number): void {
  if (!Number.isFinite(version) || version <= 0) return;
  const s = String(Math.floor(version));
  try {
    sessionStorage.setItem(CLOUD_BOOTSTRAP_APPLIED_VERSION_SESSION_KEY, s);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(CLOUD_BOOTSTRAP_APPLIED_VERSION_LS_KEY, s);
  } catch {
    /* ignore */
  }
}

function isConnexionPath(): boolean {
  try {
    return /\/connexion\/?$/.test(window.location.pathname);
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const LAST_SUCCESSFUL_CLOUD_PUSH_BYTES_KEY =
  "tk-gestion-cloud-last-successful-push-bytes-v1";
const LAST_SUCCESSFUL_CLOUD_PUSH_KEYS_KEY =
  "tk-gestion-cloud-last-successful-push-keys-v1";

type CloudPushMetrics = { bytes: number; keys: number };

function safeNumberFromStorage(key: string): number {
  try {
    const n = Number(localStorage.getItem(key) ?? "0");
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function rememberLastSuccessfulPushMetrics(m: CloudPushMetrics): void {
  try {
    localStorage.setItem(
      LAST_SUCCESSFUL_CLOUD_PUSH_BYTES_KEY,
      String(Math.max(0, Math.floor(m.bytes))),
    );
    localStorage.setItem(
      LAST_SUCCESSFUL_CLOUD_PUSH_KEYS_KEY,
      String(Math.max(0, Math.floor(m.keys))),
    );
  } catch {
    /* ignore */
  }
}

export function getLastSuccessfulPushMetrics(): CloudPushMetrics {
  return {
    bytes: safeNumberFromStorage(LAST_SUCCESSFUL_CLOUD_PUSH_BYTES_KEY),
    keys: safeNumberFromStorage(LAST_SUCCESSFUL_CLOUD_PUSH_KEYS_KEY),
  };
}

export type CloudPushRisk =
  | { risky: false }
  | {
      risky: true;
      reason: string;
      prev: CloudPushMetrics;
      cur: CloudPushMetrics;
    };

/**
 * Protection anti-effacement : si l'état local est beaucoup plus petit que le
 * dernier push réussi, bloquer l'auto-sync (et demander confirmation en manuel).
 */
export function assessCloudPushRisk(entries: Record<string, string>): CloudPushRisk {
  const prev = getLastSuccessfulPushMetrics();
  const cur: CloudPushMetrics = {
    bytes: JSON.stringify(entries).length,
    keys: Object.keys(entries).length,
  };
  if (prev.bytes <= 0 || prev.keys <= 0) return { risky: false };
  if (cur.bytes <= 0 || cur.keys <= 0) {
    return {
      risky: true,
      reason:
        "État local vide — risque d’écraser le serveur. Faites « Récupérer » si besoin.",
      prev,
      cur,
    };
  }

  // Seuils conservateurs : on bloque seulement si c’est vraiment un effondrement.
  const bytesRatio = cur.bytes / prev.bytes;
  const keysRatio = cur.keys / prev.keys;
  const tooSmall = bytesRatio < 0.6 && keysRatio < 0.7;
  if (!tooSmall) return { risky: false };
  return {
    risky: true,
    reason:
      "État local nettement plus petit que la dernière synchro réussie — auto-sync bloqué pour éviter un écrasement.",
    prev,
    cur,
  };
}
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
export async function applyCloudPullEntries(entries: Record<string, string>) {
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
  const r = await applyTkGestionBackupV1(data);
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

/** Après un pull : réinjecte les photos rapport (IndexedDB) depuis la copie nuage. */
export async function finalizeCloudPullOnDevice(): Promise<void> {
  const { importRapportImagesFromCloudStorageKey } = await import(
    "./rapportActiviteImageDbCloud"
  );
  await importRapportImagesFromCloudStorageKey();
}

/**
 * Flush des brouillons ouverts, export des images rapport, puis collecte localStorage
 * pour envoi vers Neon (workspace_snapshots).
 */
export async function prepareEntriesForCloudPush(): Promise<
  Record<string, string>
> {
  try {
    window.dispatchEvent(new Event(FLUSH_BEFORE_CLOUD_PUSH_EVENT));
  } catch {
    /* ignore */
  }
  await delay(100);
  const { exportRapportImagesToCloudStorageKey } = await import(
    "./rapportActiviteImageDbCloud"
  );
  await exportRapportImagesToCloudStorageKey();
  return collectEntriesForCloudPush();
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
  const token = getValidAuthToken();
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
  const token = getValidAuthToken();
  const entries = await prepareEntriesForCloudPush();
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
    // Sécurité : ne jamais "remplacer" le serveur depuis un appareil partiel.
    // L'envoi automatique et l'envoi manuel utilisent une fusion (merge) par défaut.
    const r = await pushBody({ entries, merge: true });
    if (!r.ok) return { ok: false, error: r.error };
    lastVersion = r.version;
  } else {
    const chunks = chunkEntriesByJsonSize(entries, CLOUD_ENTRIES_MAX_JSON_BYTES);
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
  rememberLastSuccessfulPushMetrics({
    bytes: innerLen,
    keys: Object.keys(entries).length,
  });
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

  // Évite les boucles de rechargement (Windows / sessionStorage volatile).
  const alreadyApplied = getBootstrapAppliedVersion();
  if (alreadyApplied > 0 && alreadyApplied === pull.version) {
    rememberCloudServerVersion(pull.version);
    return { shouldHardNavigate: false };
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
    const applied = await applyCloudPullEntries(pull.entries);
    if (!applied.ok) {
      return { shouldHardNavigate: false, applyError: applied.error };
    }
    await finalizeCloudPullOnDevice();
    rememberCloudServerVersion(pull.version);
    rememberBootstrapAppliedVersion(pull.version);
    const shouldHardNavigate = !isConnexionPath();
    return { shouldHardNavigate, pulled: true };
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
  if (!getValidAuthToken()) {
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
  const current = window.location.pathname.replace(/\/$/, "") || "/";
  const target = path.replace(/\/$/, "") || "/fonctions";

  if (current === target || current.endsWith("/fonctions")) {
    try {
      if (sessionStorage.getItem(CLOUD_HARD_NAV_RELOAD_ONCE_KEY) === "1") {
        return;
      }
      sessionStorage.setItem(CLOUD_HARD_NAV_RELOAD_ONCE_KEY, "1");
    } catch {
      /* ignore */
    }
    window.location.reload();
    return;
  }

  window.location.assign(path);
}
