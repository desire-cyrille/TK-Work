import type { Pool } from "pg";

export const WORKSPACE_SNAPSHOT_ID = "default";

export async function ensureWorkspaceSnapshotRow(pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO workspace_snapshots (id, payload, version, "updatedAt")
     VALUES ($1, '{}'::jsonb, 1, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [WORKSPACE_SNAPSHOT_ID],
  );
}
