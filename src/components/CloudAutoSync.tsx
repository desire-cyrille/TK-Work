import { useEffect, useRef } from "react";
import {
  applyCloudPullEntries,
  cloudPull,
  cloudPush,
  collectEntriesForCloudPush,
} from "../lib/cloudSync";

const PULL_INTERVAL_MS = 30_000;
const PUSH_DEBOUNCE_MS = 1_500;
const APPLIED_PULL_VERSION_KEY = "tk-gestion-cloud-autosync-applied-version-v1";
const LAST_PUSHED_HASH_KEY = "tk-gestion-cloud-autosync-last-pushed-hash-v1";
const HAS_PULLED_ONCE_KEY = "tk-gestion-cloud-autosync-has-pulled-once-v1";

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
  const lastAppliedPullVersionRef = useRef<number>(0);
  const hasPulledOnceRef = useRef<boolean>(false);

  function readLastAppliedPullVersion(): number {
    try {
      const raw = sessionStorage.getItem(APPLIED_PULL_VERSION_KEY);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  function writeLastAppliedPullVersion(v: number) {
    try {
      if (!Number.isFinite(v) || v <= 0) return;
      sessionStorage.setItem(APPLIED_PULL_VERSION_KEY, String(v));
    } catch {
      /* ignore */
    }
  }

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

  function isLocalWorkspaceEmpty(): boolean {
    const entries = collectEntriesForCloudPush();
    return Object.keys(entries).length === 0;
  }

  async function doPull() {
    if (inFlightPull.current) return;
    inFlightPull.current = true;
    try {
      // Ne jamais écraser des changements locaux non envoyés.
      const currentHash = hashEntries(collectEntriesForCloudPush());
      const lastHash = lastPushedHash.current || readStringSession(LAST_PUSHED_HASH_KEY);
      if (currentHash && lastHash && currentHash !== lastHash) {
        // On a des changements locaux: on pousse d'abord.
        schedulePush();
        return;
      }

      const r = await cloudPull();
      if (!r.ok) return;
      if (r.version === 0 || Object.keys(r.entries).length === 0) return;
      const lastApplied =
        lastAppliedPullVersionRef.current || readLastAppliedPullVersion();
      // Empêche les boucles de rechargement: ne réapplique pas une version déjà appliquée.
      if (r.version <= lastApplied) return;

      // Après le premier démarrage, on ne fait pas de pull auto si l'appareil a déjà des données.
      // Cela évite de remplacer un appareil "source de vérité" par une copie serveur plus ancienne.
      const hasPulledOnce = hasPulledOnceRef.current || readBoolSession(HAS_PULLED_ONCE_KEY);
      if (!hasPulledOnce && !isLocalWorkspaceEmpty()) {
        hasPulledOnceRef.current = true;
        writeBoolSession(HAS_PULLED_ONCE_KEY, true);
        return;
      }

      const applied = applyCloudPullEntries(r.entries);
      if (!applied.ok) return;
      lastAppliedPullVersionRef.current = r.version;
      writeLastAppliedPullVersion(r.version);
      hasPulledOnceRef.current = true;
      writeBoolSession(HAS_PULLED_ONCE_KEY, true);
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
    // Charge la dernière version déjà appliquée dans cette session.
    lastAppliedPullVersionRef.current = readLastAppliedPullVersion();
    lastPushedHash.current = readStringSession(LAST_PUSHED_HASH_KEY);
    hasPulledOnceRef.current = readBoolSession(HAS_PULLED_ONCE_KEY);

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

