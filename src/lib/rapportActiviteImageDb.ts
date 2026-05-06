const DB_NAME = "tk-gestion-rapport-activite";
const DB_VERSION = 1;
const STORE = "images";

const REF_PREFIX = "idbimg:";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb_open_failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb_tx_failed"));
    tx.onabort = () => reject(tx.error ?? new Error("idb_tx_aborted"));
  });
}

export function isImageRef(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(REF_PREFIX);
}

export function makeImageRef(id: string): string {
  return `${REF_PREFIX}${id}`;
}

export function imageRefId(ref: string): string {
  return ref.startsWith(REF_PREFIX) ? ref.slice(REF_PREFIX.length) : ref;
}

export async function putImageDataUrl(dataUrl: string): Promise<string> {
  const id = crypto.randomUUID();
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(dataUrl, id);
  await txDone(tx);
  db.close();
  return makeImageRef(id);
}

export async function getImageDataUrl(refOrId: string): Promise<string | null> {
  const id = imageRefId(refOrId);
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).get(id);
  const out = await new Promise<string | null>((resolve, reject) => {
    req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
    req.onerror = () => reject(req.error ?? new Error("idb_get_failed"));
  });
  await txDone(tx);
  db.close();
  return out;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const nav = navigator as unknown as {
      storage?: { persist?: () => Promise<boolean> };
    };
    const persist = nav.storage?.persist;
    if (!persist) return false;
    return await persist();
  } catch {
    return false;
  }
}

