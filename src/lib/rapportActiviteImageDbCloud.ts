/**
 * Export / import IndexedDB (photos rapport) vers une clé localStorage
 * incluse dans la synchronisation nuage (Neon via workspace_snapshots).
 */

import {
  getImageDataUrl,
  imageRefId,
  isImageRef,
  putImageDataUrlAtId,
} from "./rapportActiviteImageDb";

export const RAPPORT_IDB_CLOUD_STORAGE_KEY =
  "tk-gestion-rapport-activite-idb-export-v1";

const DB_NAME = "tk-gestion-rapport-activite";
const STORE = "images";

type IdbCloudExportV1 = {
  format: "tk-gestion-rapport-idb-export";
  version: 1;
  exportedAt: string;
  images: Record<string, string>;
};

function openDbForScan(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb_open_failed"));
  });
}

/** Parcourt le store images et sérialise pour le nuage. */
export async function exportRapportImagesToCloudStorageKey(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const images: Record<string, string> = {};
  try {
    const db = await openDbForScan();
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const allKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const r = store.getAllKeys();
      r.onsuccess = () => resolve(r.result ?? []);
      r.onerror = () => reject(r.error ?? new Error("idb_keys_failed"));
    });
    for (const key of allKeys) {
      const id = String(key);
      const dataUrl = await new Promise<string | null>((resolve, reject) => {
        const g = store.get(key);
        g.onsuccess = () =>
          resolve(typeof g.result === "string" ? g.result : null);
        g.onerror = () => reject(g.error ?? new Error("idb_get_failed"));
      });
      if (dataUrl && dataUrl.startsWith("data:")) images[id] = dataUrl;
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    return 0;
  }
  const payload: IdbCloudExportV1 = {
    format: "tk-gestion-rapport-idb-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    images,
  };
  try {
    localStorage.setItem(
      RAPPORT_IDB_CLOUD_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    return 0;
  }
  return Object.keys(images).length;
}

export async function importRapportImagesFromCloudStorageKey(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RAPPORT_IDB_CLOUD_STORAGE_KEY);
  } catch {
    return 0;
  }
  if (!raw) return 0;
  let parsed: IdbCloudExportV1;
  try {
    parsed = JSON.parse(raw) as IdbCloudExportV1;
  } catch {
    return 0;
  }
  if (parsed.format !== "tk-gestion-rapport-idb-export" || parsed.version !== 1) {
    return 0;
  }
  let n = 0;
  for (const [id, dataUrl] of Object.entries(parsed.images ?? {})) {
    if (!dataUrl.startsWith("data:")) continue;
    try {
      const db = await openDbForScan();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      n += 1;
    } catch {
      /* ignore single image */
    }
  }
  return n;
}

/** Résout les refs idbimg: après un pull (réinsère si l’id manque). */
export async function ensureImageRefDataUrl(ref: string): Promise<string | null> {
  if (ref.startsWith("data:")) return ref;
  if (!isImageRef(ref)) return null;
  const existing = await getImageDataUrl(ref);
  if (existing) return existing;
  const id = imageRefId(ref);
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RAPPORT_IDB_CLOUD_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IdbCloudExportV1;
    const dataUrl = parsed.images?.[id];
    if (!dataUrl?.startsWith("data:")) return null;
    await putImageDataUrlAtId(id, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

const FLUSH_BEFORE_CLOUD_PUSH_EVENT = "tk-gestion-flush-before-cloud-push";

export function registerRapportImageCloudFlushListener(): void {
  if (typeof window === "undefined") return;
  window.addEventListener(FLUSH_BEFORE_CLOUD_PUSH_EVENT, () => {
    void exportRapportImagesToCloudStorageKey();
  });
}
