/**
 * Pont localStorage ↔ IndexedDB pour Safari (quota localStorage ~5 Mo).
 * Les grosses valeurs sont gardées en IndexedDB ; localStorage ne contient qu’un marqueur léger.
 * Lecture synchrone via cache mémoire (hydraté au démarrage).
 */

const IDB_NAME = "tk-gestion-overflow-v1";
const IDB_STORE = "entries";
const IDB_MARKER = "__tk_idb__:";
/** Tente d’abord localStorage en dessous de ce seuil (caractères UTF-16). */
const INLINE_MAX_CHARS = 350_000;

const memoryCache = new Map<string, string>();
let bridgeInstalled = false;
const pendingWrites = new Set<Promise<void>>();

/** Accès natifs — ne jamais rappeler localStorage.getItem après patch (récursion). */
const nativeGetItem = localStorage.getItem.bind(localStorage);
const nativeSetItem = localStorage.setItem.bind(localStorage);
const nativeRemoveItem = localStorage.removeItem.bind(localStorage);
const nativeKey = localStorage.key.bind(localStorage);
const nativeLength = () => localStorage.length;

function trackWrite(p: Promise<void>): void {
  pendingWrites.add(p);
  void p.finally(() => {
    pendingWrites.delete(p);
  });
}

function isTkGestionStorageKey(key: string): boolean {
  return key.startsWith("tk-gestion-") || key.startsWith("tk_gestion_");
}

/** Jetons de session : toujours en localStorage natif (pas de pont IDB). */
const DIRECT_LOCAL_KEYS = new Set([
  "tk_gestion_auth_token",
  "tk_gestion_auth_email",
]);

function isOverflowKey(key: string): boolean {
  return (
    isTkGestionStorageKey(key) &&
    !key.includes("#") &&
    !DIRECT_LOCAL_KEYS.has(key)
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb_open_failed"));
  });
}

function idbGetAll(): Promise<Record<string, string>> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const store = tx.objectStore(IDB_STORE);
        const out: Record<string, string> = {};
        const req = store.openCursor();
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return;
          if (typeof cur.value === "string") out[String(cur.key)] = cur.value;
          cur.continue();
        };
        req.onerror = () => reject(req.error ?? new Error("idb_cursor_failed"));
        tx.oncomplete = () => {
          db.close();
          resolve(out);
        };
        tx.onerror = () => reject(tx.error ?? new Error("idb_tx_failed"));
      }),
  );
}

function idbPut(key: string, value: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error("idb_put_failed"));
      }),
  );
}

function idbRemove(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error("idb_del_failed"));
      }),
  );
}

function idbClear(): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error("idb_clear_failed"));
      }),
  );
}

function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "QuotaExceededError";
}

function readNative(key: string): string | null {
  return nativeGetItem(key);
}

function writeNative(key: string, value: string): void {
  nativeSetItem(key, value);
}

function removeNative(key: string): void {
  nativeRemoveItem(key);
}

export function getTkGestionStorageValue(key: string): string | null {
  if (!isOverflowKey(key)) return readNative(key);
  if (memoryCache.has(key)) return memoryCache.get(key)!;
  const raw = readNative(key);
  if (raw === null) return null;
  if (raw.startsWith(IDB_MARKER)) return memoryCache.get(key) ?? null;
  return raw;
}

/** Écrit une valeur (localStorage ou IndexedDB selon taille / quota). */
export function writeTkGestionStorageValue(key: string, value: string): void {
  if (!isOverflowKey(key)) {
    writeNative(key, value);
    return;
  }

  if (value.length <= INLINE_MAX_CHARS) {
    try {
      writeNative(key, value);
      memoryCache.delete(key);
      trackWrite(idbRemove(key));
      return;
    } catch (e) {
      if (!isQuotaError(e)) throw e;
    }
  }

  memoryCache.set(key, value);
  writeNative(key, `${IDB_MARKER}${key}`);
  trackWrite(idbPut(key, value));
}

export function removeTkGestionStorageValue(key: string): void {
  if (!isOverflowKey(key)) {
    removeNative(key);
    return;
  }
  memoryCache.delete(key);
  removeNative(key);
  trackWrite(idbRemove(key));
}

export function collectTkGestionStorageEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  const seen = new Set<string>();
  for (let i = 0; i < nativeLength(); i += 1) {
    const key = nativeKey(i);
    if (!key || !isTkGestionStorageKey(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const v = getTkGestionStorageValue(key);
    if (v !== null) entries[key] = v;
  }
  for (const key of memoryCache.keys()) {
    if (seen.has(key)) continue;
    const v = memoryCache.get(key);
    if (v !== undefined) entries[key] = v;
  }
  return entries;
}

export async function flushTkGestionStorageWrites(): Promise<void> {
  await Promise.all([...pendingWrites]);
}

export async function clearTkGestionStorageCompletely(): Promise<void> {
  memoryCache.clear();
  const toRemove: string[] = [];
  for (let i = 0; i < nativeLength(); i += 1) {
    const key = nativeKey(i);
    if (key && isTkGestionStorageKey(key)) toRemove.push(key);
  }
  for (const key of toRemove) removeNative(key);
  await idbClear();
}

export async function hydrateTkGestionOverflowFromIdb(): Promise<void> {
  try {
    const all = await idbGetAll();
    for (const [key, value] of Object.entries(all)) {
      if (!isOverflowKey(key)) continue;
      memoryCache.set(key, value);
      const marker = readNative(key);
      if (marker !== `${IDB_MARKER}${key}`) {
        try {
          writeNative(key, `${IDB_MARKER}${key}`);
        } catch {
          /* quota : la valeur reste en cache mémoire + IDB */
        }
      }
    }
    for (let i = 0; i < nativeLength(); i += 1) {
      const key = nativeKey(i);
      if (!key || !isOverflowKey(key)) continue;
      const raw = readNative(key);
      if (raw?.startsWith(IDB_MARKER) && !memoryCache.has(key)) {
        const fromIdb = all[key];
        if (typeof fromIdb === "string") memoryCache.set(key, fromIdb);
      }
    }
  } catch {
    /* IndexedDB indisponible (mode privé strict, etc.) */
  }
}

export function installTkGestionStorageBridge(): void {
  if (bridgeInstalled) return;
  bridgeInstalled = true;

  localStorage.getItem = (key: string): string | null => {
    if (!isOverflowKey(key)) return nativeGetItem(key);
    return getTkGestionStorageValue(key);
  };

  localStorage.setItem = (key: string, value: string): void => {
    if (!isOverflowKey(key)) {
      nativeSetItem(key, value);
      return;
    }
    writeTkGestionStorageValue(key, value);
  };

  localStorage.removeItem = (key: string): void => {
    if (!isOverflowKey(key)) {
      nativeRemoveItem(key);
      return;
    }
    removeTkGestionStorageValue(key);
  };
}

export function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(ua);
}
