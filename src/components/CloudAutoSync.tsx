import { useEffect, useRef } from "react";
import {
  assessCloudPushRisk,
  cloudPush,
  hardNavigateToFonctionsAfterCloudPull,
  prepareEntriesForCloudPush,
  syncCloudSessionBootstrap,
} from "../lib/cloudSync";
import { getAuthToken } from "../lib/authToken";

const PUSH_DEBOUNCE_MS = 1_500;
const LAST_PUSHED_HASH_KEY = "tk-gestion-cloud-autosync-last-pushed-hash-v1";
const LAST_CLOUD_SYNC_ERROR_KEY = "tk-gestion-cloud-last-sync-error-v1";

/**
 * Synchronisation automatique multi-appareil.
 * - Push périodique sur activité (meilleure-effort)
 *
 * Objectif: éviter toute perte en navigation / appareil, sans provoquer de reload.
 *
 * Au démarrage (session connectée), alignement sur le nuage si une version plus récente existe.
 */
export function CloudAutoSync() {
  const inFlightPush = useRef(false);
  const lastPushedHash = useRef<string>("");
  const pushTimer = useRef<number | null>(null);
  const lastBootError = useRef<string>("");

  function readStringSession(key: string): string {
    try {
      return sessionStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  }

  function writeStringSession(key: string, value: string) {
    try {
      if (!value) return;
      sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  function writeLastSyncError(message: string) {
    const msg = message.trim();
    if (!msg) return;
    if (msg === lastBootError.current) return;
    lastBootError.current = msg;
    writeStringSession(LAST_CLOUD_SYNC_ERROR_KEY, msg);
    console.warn("Synchronisation nuage :", msg);
  }

  function readBoolSession(key: string): boolean {
    try {
      return sessionStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }

  function writeBoolSession(key: string, v: boolean) {
    try {
      sessionStorage.setItem(key, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function hashEntries(entries: Record<string, string>): string {
    // Hash léger (non cryptographique) pour éviter des push inutiles.
    const keys = Object.keys(entries).sort();
    let h = 0;
    for (const k of keys) {
      const v = entries[k] ?? "";
      const s = `${k}=${v.length}:${v.slice(0, 64)}`;
      for (let i = 0; i < s.length; i += 1) {
        h = (h * 31 + s.charCodeAt(i)) >>> 0;
      }
    }
    return String(h);
  }

  async function doPush() {
    if (inFlightPush.current) return;
    // Pas d'auto-sync sans connexion (évite de spammer /api/sync en 401).
    if (!getAuthToken()) return;
    inFlightPush.current = true;
    try {
      const entries = await prepareEntriesForCloudPush();
      // Protection: ne jamais écraser le serveur avec un état "vide" depuis un appareil vidé.
      if (Object.keys(entries).length === 0) return;
      const risk = assessCloudPushRisk(entries);
      if (risk.risky) {
        writeLastSyncError(
          `${risk.reason} (avant: ${risk.prev.keys} clés / ${risk.prev.bytes} o ; maintenant: ${risk.cur.keys} clés / ${risk.cur.bytes} o)`,
        );
        return;
      }
      const curHash = hashEntries(entries);
      if (curHash && curHash === lastPushedHash.current) return;
      const r = await cloudPush();
      if (r.ok) {
        lastPushedHash.current = curHash;
        writeStringSession(LAST_PUSHED_HASH_KEY, curHash);
      }
    } finally {
      inFlightPush.current = false;
    }
  }

  function schedulePush() {
    if (pushTimer.current !== null) return;
    pushTimer.current = window.setTimeout(() => {
      pushTimer.current = null;
      void doPush();
    }, PUSH_DEBOUNCE_MS);
  }

  useEffect(() => {
    lastPushedHash.current = readStringSession(LAST_PUSHED_HASH_KEY);
    lastBootError.current = readStringSession(LAST_CLOUD_SYNC_ERROR_KEY);
    // Gardé pour compat : certaines anciennes sessions ont pu écrire ces clés.
    // (Ne sert plus tant qu'on ne fait pas de pull automatique.)
    void readBoolSession;
    void writeBoolSession;

    // Important : au démarrage, faire d'abord l'alignement sur le serveur (pull/push),
    // puis seulement lancer les pushes périodiques. Sinon un appareil "vide" peut
    // écraser le serveur par erreur.
    if (getAuthToken()) {
      void syncCloudSessionBootstrap().then((r) => {
        if (r.pullError || r.applyError || r.pushError) {
          writeLastSyncError(r.pullError ?? r.applyError ?? r.pushError ?? "");
        }
        if (r.shouldHardNavigate) {
          hardNavigateToFonctionsAfterCloudPull();
          return;
        }
        // Push initial après bootstrap (si des données existent déjà).
        schedulePush();
      });
    } else {
      // Pas connecté : pas de nuage, pas d'auto-push.
      // (Le user travaille en local et synchronisera après connexion.)
    }

    const onOnline = () => {
      schedulePush();
      if (getAuthToken()) {
        void syncCloudSessionBootstrap().then((boot) => {
          if (boot.pullError || boot.applyError || boot.pushError) {
            writeLastSyncError(
              boot.pullError ?? boot.applyError ?? boot.pushError ?? "",
            );
          }
          if (boot.shouldHardNavigate) {
            hardNavigateToFonctionsAfterCloudPull();
          }
        });
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        schedulePush();
      } else {
        void doPush();
      }
    };
    const onPageHide = () => {
      void doPush();
    };
    const onUserActivity = () => schedulePush();

    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    const events = ["click", "keydown", "touchstart", "paste"] as const;
    for (const ev of events) document.addEventListener(ev, onUserActivity, true);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const ev of events) document.removeEventListener(ev, onUserActivity, true);
      if (pushTimer.current !== null) window.clearTimeout(pushTimer.current);
    };
  }, []);

  return null;
}

