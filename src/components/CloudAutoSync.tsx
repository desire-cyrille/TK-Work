import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  assessCloudPushRisk,
  cloudPush,
  hardNavigateToFonctionsAfterCloudPull,
  prepareEntriesForCloudPush,
  syncCloudSessionBootstrap,
} from "../lib/cloudSync";
import { getValidAuthToken } from "../lib/authToken";

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
  const { authReady, isAuthenticated } = useAuth();
  const inFlightPush = useRef(false);
  const lastPushedHash = useRef<string>("");
  const pushTimer = useRef<number | null>(null);
  const lastBootError = useRef<string>("");
  const bootstrapStarted = useRef(false);

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

  function hashEntries(entries: Record<string, string>): string {
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
    if (!getValidAuthToken()) return;
    inFlightPush.current = true;
    try {
      const entries = await prepareEntriesForCloudPush();
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

  function runBootstrap() {
    if (!getValidAuthToken()) return;
    void syncCloudSessionBootstrap().then((r) => {
      if (r.pullError || r.applyError || r.pushError) {
        writeLastSyncError(r.pullError ?? r.applyError ?? r.pushError ?? "");
      }
      if (r.shouldHardNavigate) {
        hardNavigateToFonctionsAfterCloudPull();
        return;
      }
      schedulePush();
    });
  }

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;

    lastPushedHash.current = readStringSession(LAST_PUSHED_HASH_KEY);
    lastBootError.current = readStringSession(LAST_CLOUD_SYNC_ERROR_KEY);

    if (!bootstrapStarted.current) {
      bootstrapStarted.current = true;
      runBootstrap();
    }

    const onOnline = () => {
      schedulePush();
      if (getValidAuthToken()) {
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
  }, [authReady, isAuthenticated]);

  return null;
}
