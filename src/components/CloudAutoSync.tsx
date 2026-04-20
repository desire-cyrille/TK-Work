import { useEffect, useRef } from "react";
import {
  cloudPush,
  collectEntriesForCloudPush,
} from "../lib/cloudSync";

const PUSH_DEBOUNCE_MS = 1_500;
const LAST_PUSHED_HASH_KEY = "tk-gestion-cloud-autosync-last-pushed-hash-v1";

/**
 * Synchronisation automatique multi-appareil.
 * - Push périodique sur activité (meilleure-effort)
 *
 * Objectif: éviter toute perte en navigation / appareil, sans provoquer de reload.
 *
 * Important: aucun "pull/apply" automatique ici, car appliquer une copie serveur
 * implique souvent un rechargement et peut écraser des saisies en cours.
 */
export function CloudAutoSync() {
  const inFlightPush = useRef(false);
  const lastPushedHash = useRef<string>("");
  const pushTimer = useRef<number | null>(null);

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
    inFlightPush.current = true;
    try {
      const entries = collectEntriesForCloudPush();
      // Protection: ne jamais écraser le serveur avec un état "vide" depuis un appareil vidé.
      if (Object.keys(entries).length === 0) return;
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
    // Gardé pour compat : certaines anciennes sessions ont pu écrire ces clés.
    // (Ne sert plus tant qu'on ne fait pas de pull automatique.)
    void readBoolSession;
    void writeBoolSession;

    // Push initial (si des données existent déjà).
    schedulePush();

    const onOnline = () => {
      schedulePush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        schedulePush();
      }
    };
    const onUserActivity = () => schedulePush();

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    const events = ["click", "keydown", "touchstart", "paste"] as const;
    for (const ev of events) document.addEventListener(ev, onUserActivity, true);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const ev of events) document.removeEventListener(ev, onUserActivity, true);
      if (pushTimer.current !== null) window.clearTimeout(pushTimer.current);
    };
  }, []);

  return null;
}

