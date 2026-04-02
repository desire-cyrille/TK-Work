import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  lockAcquire,
  lockHeartbeat,
  lockRelease,
} from "../lib/workspaceLockApi";

type Options = { enabled?: boolean };

/**
 * Verrou serveur pour une ressource (biens, devis:id, projet:id).
 * Sans authentification : pas de verrou, édition libre (comportement local).
 */
export function useWorkspaceLock(
  resourceKey: string | null,
  options?: Options,
) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled !== false;
  const [ready, setReady] = useState(
    () => !resourceKey || !isAuthenticated || !enabled,
  );
  const [canEdit, setCanEdit] = useState(true);
  const [lockedByLabel, setLockedByLabel] = useState<string | null>(null);
  const heldRef = useRef(false);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    keyRef.current = resourceKey;
  }, [resourceKey]);

  useEffect(() => {
    let cancelled = false;
    heldRef.current = false;

    if (!resourceKey || !enabled || !isAuthenticated) {
      setReady(true);
      setCanEdit(true);
      setLockedByLabel(null);
      return () => {};
    }

    setReady(false);
    setLockedByLabel(null);

    void (async () => {
      const r = await lockAcquire(resourceKey);
      if (cancelled) return;
      setReady(true);
      if (r.ok) {
        heldRef.current = true;
        setCanEdit(true);
        setLockedByLabel(null);
      } else {
        setCanEdit(false);
        setLockedByLabel(r.lockedByLabel);
      }
    })();

    return () => {
      cancelled = true;
      const k = keyRef.current;
      if (heldRef.current && k) {
        void lockRelease(k);
        heldRef.current = false;
      }
    };
  }, [resourceKey, enabled, isAuthenticated]);

  useEffect(() => {
    if (!resourceKey || !isAuthenticated || !enabled || !canEdit || !ready) {
      return;
    }
    const id = window.setInterval(() => {
      void lockHeartbeat(resourceKey);
    }, 45_000);
    return () => clearInterval(id);
  }, [resourceKey, isAuthenticated, enabled, canEdit, ready]);

  useEffect(() => {
    if (canEdit || !resourceKey || !isAuthenticated || !enabled || !ready) {
      return;
    }
    const id = window.setInterval(() => {
      void (async () => {
        const r = await lockAcquire(resourceKey);
        if (r.ok) {
          heldRef.current = true;
          setCanEdit(true);
          setLockedByLabel(null);
        }
      })();
    }, 20_000);
    return () => clearInterval(id);
  }, [canEdit, resourceKey, isAuthenticated, enabled, ready]);

  const isLockedOut = Boolean(
    ready && !canEdit && resourceKey && isAuthenticated,
  );

  return {
    ready,
    canEdit,
    lockedByLabel,
    isLockedOut,
  };
}
