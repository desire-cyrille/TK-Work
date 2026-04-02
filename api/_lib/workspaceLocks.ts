import type { Pool } from "pg";

/** Après ce délai sans heartbeat, le verrou est considéré comme libre. */
export const LOCK_STALE_MS = 120_000;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidResourceKey(k: string): boolean {
  const t = k.trim();
  if (t === "biens") return true;
  const i = t.indexOf(":");
  if (i <= 0) return false;
  const kind = t.slice(0, i).toLowerCase();
  const id = t.slice(i + 1);
  if (kind !== "devis" && kind !== "projet") return false;
  return UUID.test(id);
}

export function displayLabelFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? email;
  const chunk = local.split(/[._-]/)[0] ?? local;
  if (!chunk) return email;
  return chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase();
}

type LockRow = {
  resource_key: string;
  holder_user_id: string;
  holder_email: string;
  holder_label: string;
  updated_at: Date;
};

function isStale(row: LockRow): boolean {
  return Date.now() - new Date(row.updated_at).getTime() > LOCK_STALE_MS;
}

async function holderRole(
  pool: Pool,
  holderUserId: string,
): Promise<"USER" | "ADMIN" | null> {
  const r = await pool.query<{ role: string }>(
    `SELECT role::text AS role FROM users WHERE id = $1`,
    [holderUserId],
  );
  const role = r.rows[0]?.role;
  if (!role) return null;
  return role === "ADMIN" ? "ADMIN" : "USER";
}

export type AcquireResult =
  | { ok: true }
  | {
      ok: false;
      lockedByLabel: string;
      lockedByEmail: string;
    };

export async function acquireWorkspaceLock(
  pool: Pool,
  resourceKey: string,
  userId: string,
  email: string,
  label: string,
  role: "USER" | "ADMIN",
): Promise<AcquireResult> {
  const sel = await pool.query<LockRow>(
    `SELECT resource_key, holder_user_id, holder_email, holder_label, updated_at
     FROM workspace_locks WHERE resource_key = $1`,
    [resourceKey],
  );
  const row = sel.rows[0];

  if (!row || isStale(row)) {
    if (row && isStale(row)) {
      await pool.query(`DELETE FROM workspace_locks WHERE resource_key = $1`, [
        resourceKey,
      ]);
    }
    await pool.query(
      `INSERT INTO workspace_locks (resource_key, holder_user_id, holder_email, holder_label, updated_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [resourceKey, userId, email, label],
    );
    return { ok: true };
  }

  if (row.holder_user_id === userId) {
    await pool.query(
      `UPDATE workspace_locks SET updated_at = NOW() WHERE resource_key = $1 AND holder_user_id = $2`,
      [resourceKey, userId],
    );
    return { ok: true };
  }

  const hRole = await holderRole(pool, row.holder_user_id);
  if (hRole === null) {
    await pool.query(`DELETE FROM workspace_locks WHERE resource_key = $1`, [
      resourceKey,
    ]);
    await pool.query(
      `INSERT INTO workspace_locks (resource_key, holder_user_id, holder_email, holder_label, updated_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [resourceKey, userId, email, label],
    );
    return { ok: true };
  }

  if (role === "ADMIN") {
    await pool.query(
      `UPDATE workspace_locks
       SET holder_user_id = $2, holder_email = $3, holder_label = $4, updated_at = NOW()
       WHERE resource_key = $1`,
      [resourceKey, userId, email, label],
    );
    return { ok: true };
  }

  if (hRole === "ADMIN") {
    return {
      ok: false,
      lockedByLabel: row.holder_label || row.holder_email,
      lockedByEmail: row.holder_email,
    };
  }

  return {
    ok: false,
    lockedByLabel: row.holder_label || row.holder_email,
    lockedByEmail: row.holder_email,
  };
}

export async function heartbeatWorkspaceLock(
  pool: Pool,
  resourceKey: string,
  userId: string,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE workspace_locks SET updated_at = NOW()
     WHERE resource_key = $1 AND holder_user_id = $2`,
    [resourceKey, userId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function releaseWorkspaceLock(
  pool: Pool,
  resourceKey: string,
  userId: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM workspace_locks WHERE resource_key = $1 AND holder_user_id = $2`,
    [resourceKey, userId],
  );
}

export type LockStatus = {
  held: boolean;
  fresh: boolean;
  holderLabel: string | null;
  holderEmail: string | null;
  youHold: boolean;
};

export async function getWorkspaceLockStatus(
  pool: Pool,
  resourceKey: string,
  viewerUserId?: string,
): Promise<LockStatus> {
  const sel = await pool.query<LockRow>(
    `SELECT resource_key, holder_user_id, holder_email, holder_label, updated_at
     FROM workspace_locks WHERE resource_key = $1`,
    [resourceKey],
  );
  const row = sel.rows[0];
  if (!row) {
    return {
      held: false,
      fresh: false,
      holderLabel: null,
      holderEmail: null,
      youHold: false,
    };
  }
  const fresh = !isStale(row);
  const youHold =
    !!viewerUserId && fresh && row.holder_user_id === viewerUserId;
  return {
    held: true,
    fresh,
    holderLabel: row.holder_label || row.holder_email,
    holderEmail: row.holder_email,
    youHold,
  };
}
