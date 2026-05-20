import { useEffect, useRef } from "react";
import { downloadTkGestionBackup, type TkGestionBackupV1 } from "../lib/appDataBackup";
import { collectEntriesForCloudPush, hasSubstantiveLocalData } from "../lib/cloudSync";

const LAST_AUTO_BACKUP_AT_KEY = "tk-gestion-auto-backup-last-at-v1";
const LAST_AUTO_BACKUP_CACHE_KEY = "tk-gestion-auto-backup-last-cache-v1";
const TWICE_DAILY_MS = 12 * 60 * 60 * 1000;

function safeNow() {
  return Date.now();
}

function readLastAutoBackupAt(): number {
  try {
    const n = Number(localStorage.getItem(LAST_AUTO_BACKUP_AT_KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastAutoBackupAt(ts: number) {
  try {
    localStorage.setItem(LAST_AUTO_BACKUP_AT_KEY, String(Math.floor(ts)));
  } catch {
    /* ignore */
  }
}

function writeLastAutoBackupCache(data: TkGestionBackupV1) {
  try {
    localStorage.setItem(LAST_AUTO_BACKUP_CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * Lance un téléchargement d'un backup JSON 2×/jour.
 *
 * Note: les navigateurs peuvent bloquer les téléchargements automatiques selon
 * les réglages (surtout iOS). On garde aussi une copie JSON en localStorage en
 * secours.
 */
export function AutoBackupTwiceDaily() {
  const running = useRef(false);
  const timer = useRef<number | null>(null);

  async function maybeBackup(reason: "startup" | "visible" | "timer") {
    if (running.current) return;
    running.current = true;
    try {
      const last = readLastAutoBackupAt();
      const now = safeNow();
      if (last > 0 && now - last < TWICE_DAILY_MS) return;

      const entries = collectEntriesForCloudPush();
      if (!hasSubstantiveLocalData(entries)) return;

      // Cache secours (au cas où le téléchargement est bloqué).
      const payload: TkGestionBackupV1 = {
        format: "tk-gestion-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        entries: { ...entries },
      };
      writeLastAutoBackupCache(payload);

      // Tentative de téléchargement.
      downloadTkGestionBackup({ prefix: "backup_TK_RENT", includeTime: true });
      writeLastAutoBackupAt(now);
      console.info(`Backup automatique (${reason}) : téléchargé.`);
    } catch {
      /* ignore */
    } finally {
      running.current = false;
    }
  }

  useEffect(() => {
    void maybeBackup("startup");

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void maybeBackup("visible");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    timer.current = window.setInterval(() => {
      void maybeBackup("timer");
    }, 5 * 60 * 1000); // check toutes les 5 minutes

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current !== null) window.clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

