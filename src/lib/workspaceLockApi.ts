import { getAuthToken } from "./authToken";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function lockAcquire(
  resourceKey: string,
): Promise<
  | { ok: true }
  | { ok: false; lockedByLabel: string; error: string }
> {
  const token = getAuthToken();
  if (!token) return { ok: true };

  const r = await fetch("/api/locks/acquire", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ resourceKey }),
    cache: "no-store",
  });
  const data = (await r.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    lockedByLabel?: string;
  };
  if (r.ok && data.ok !== false) return { ok: true };
  return {
    ok: false,
    lockedByLabel: data.lockedByLabel ?? "un autre utilisateur",
    error:
      data.error ??
      (r.status === 401
        ? "Session expirée. Reconnectez-vous."
        : "Document déjà en cours d’utilisation."),
  };
}

export async function lockRelease(resourceKey: string): Promise<void> {
  const token = getAuthToken();
  if (!token) return;
  try {
    await fetch("/api/locks/release", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ resourceKey }),
      cache: "no-store",
    });
  } catch {
    /* ignore */
  }
}

export async function lockHeartbeat(resourceKey: string): Promise<void> {
  const token = getAuthToken();
  if (!token) return;
  try {
    await fetch("/api/locks/heartbeat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ resourceKey }),
      cache: "no-store",
    });
  } catch {
    /* ignore */
  }
}

/**
 * Verrouillage court : acquire → fn → release. Sans jeton, exécute fn seulement.
 */
export async function withResourceLock(
  resourceKey: string,
  fn: () => void | Promise<void>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = getAuthToken();
  if (!token) {
    await fn();
    return { ok: true };
  }
  const ac = await lockAcquire(resourceKey);
  if (!ac.ok) {
    return {
      ok: false,
      error: ac.error,
    };
  }
  try {
    await fn();
    return { ok: true };
  } finally {
    await lockRelease(resourceKey);
  }
}
