import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_lib/db";
import { readJsonBody, cors } from "../_lib/http";
import { requireUser } from "../_lib/requireUser";
import { validateAndNormalizeEntries } from "../_lib/syncPayload";
import {
  ensureWorkspaceSnapshotRow,
  WORKSPACE_SNAPSHOT_ID,
} from "../_lib/workspaceSnapshot";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ac = cors(req);
  if (ac) {
    for (const [k, v] of Object.entries(ac)) res.setHeader(k, v);
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  try {
    const user = await requireUser(req);
    if (!user) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    const body = readJsonBody(req) as {
      reset?: unknown;
      merge?: unknown;
      entries?: unknown;
    } | null;

    const pool = getPool();
    await ensureWorkspaceSnapshotRow(pool);

    if (body?.reset === true) {
      const upd = await pool.query<{ version: number; updatedAt: Date }>(
        `UPDATE workspace_snapshots
         SET payload = '{}'::jsonb, version = version + 1, "updatedAt" = NOW()
         WHERE id = $1
         RETURNING version, "updatedAt"`,
        [WORKSPACE_SNAPSHOT_ID],
      );
      const row = upd.rows[0];
      if (!row) {
        res.status(404).json({ error: "Espace nuage introuvable." });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        phase: "reset",
        version: row.version,
        updatedAt: row.updatedAt.toISOString(),
      });
      return;
    }

    const merge = body?.merge === true;
    const normalized = validateAndNormalizeEntries(body?.entries);
    if (!normalized.ok) {
      res.status(400).json({ error: normalized.error });
      return;
    }

    const json = JSON.stringify(normalized.entries);
    const sql = merge
      ? `UPDATE workspace_snapshots
         SET payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb,
             version = version + 1,
             "updatedAt" = NOW()
         WHERE id = $1
         RETURNING version, "updatedAt"`
      : `UPDATE workspace_snapshots
         SET payload = $2::jsonb, version = version + 1, "updatedAt" = NOW()
         WHERE id = $1
         RETURNING version, "updatedAt"`;

    const upd = await pool.query<{ version: number; updatedAt: Date }>(sql, [
      WORKSPACE_SNAPSHOT_ID,
      json,
    ]);
    const row = upd.rows[0];
    if (!row) {
      res.status(404).json({ error: "Espace nuage introuvable." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      phase: merge ? "merge" : "replace",
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("JWT_SECRET")) {
      res.status(503).json({ error: "Serveur mal configuré (JWT_SECRET)." });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Envoi vers le nuage impossible." });
  }
}
