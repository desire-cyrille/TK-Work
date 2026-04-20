import { useEffect, useRef } from "react";
import {
  applyCloudPullEntries,
  cloudPull,
  cloudPush,
  collectEntriesForCloudPush,
} from "../lib/cloudSync";

const PULL_INTERVAL_MS = 30_000;
const PUSH_DEBOUNCE_MS = 1_500;

/**
 * Synchronisation automatique multi-appareil.
 * - Pull au démarrage + périodique (si l'appareil est en ligne)
 * - Push périodique sur activité (meilleure-effort)
 *
 * Objectif: éviter toute perte en navigation / appareil, sans action manuelle.
 */
export function CloudAutoSync() {
  const inFlightPull = useRef(false);
  const inFlightPush = useRef(false);
  const lastPushedHash = useRef<string>("");
  const pushTimer = useRef<number | null>(null);

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

  async function doPull() {
    if (inFlightPull.current) return;
    inFlightPull.current = true;
    try {
      const r = await cloudPull();
      if (!r.ok) return;
      if (r.version === 0 || Object.keys(r.entries).length === 0) return;
      const applied = applyCloudPullEntries(r.entries);
      if (!applied.ok) return;
      // L'état React courant est obsolète après restauration du localStorage.
      window.location.reload();
    } finally {
      inFlightPull.current = false;
    }
  }

  async function doPush() {
    if (inFlightPush.current) return;
    inFlightPush.current = true;
    try {
      const entries = collectEntriesForCloudPush();
      const curHash = hashEntries(entries);
      if (curHash && curHash === lastPushedHash.current) return;
      const r = await cloudPush();
      if (r.ok) lastPushedHash.current = curHash;
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
    // Pull initial dès que possible.
    if (navigator.onLine) void doPull();
    // Push initial (si des données existent déjà).
    schedulePush();

    const onOnline = () => {
      void doPull();
      schedulePush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void doPull();
        schedulePush();
      }
    };
    const onUserActivity = () => schedulePush();

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    const events = ["click", "keydown", "touchstart", "paste"] as const;
    for (const ev of events) document.addEventListener(ev, onUserActivity, true);

    const pullInterval = window.setInterval(() => {
      if (navigator.onLine) void doPull();
    }, PULL_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const ev of events) document.removeEventListener(ev, onUserActivity, true);
      window.clearInterval(pullInterval);
      if (pushTimer.current !== null) window.clearTimeout(pushTimer.current);
    };
  }, []);

  return null;
}

