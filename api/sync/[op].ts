import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_lib/db.js";
import { jsonbValueToLocalStorageString } from "../_lib/jsonbStorageValue.js";
import { readJsonBody, cors } from "../_lib/http.js";
import { requireUser } from "../_lib/requireUser.js";
import { validateAndNormalizeEntries } from "../_lib/syncPayload.js";
import {
  ensureWorkspaceSnapshotRow,
  WORKSPACE_SNAPSHOT_ID,
} from "../_lib/workspaceSnapshot.js";

function handleJwtConfigError(e: unknown, res: VercelResponse): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("JWT_SECRET")) {
    res.status(503).json({ error: "Serveur mal configuré (JWT_SECRET)." });
    return true;
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ac = cors(req);
  if (ac) {
    for (const [k, v] of Object.entries(ac)) res.setHeader(k, v);
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const raw = req.query?.op;
  const op = typeof raw === "string" ? raw.toLowerCase() : "";

  try {
    if (op === "pull") {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Méthode non autorisée." });
        return;
      }
      const user = await requireUser(req);
      if (!user) {
        res.status(401).json({ error: "Non authentifié." });
        return;
      }
      const pool = getPool();
      await ensureWorkspaceSnapshotRow(pool);
      const row = await pool.query<{
        payload: Record<string, unknown>;
        version: number;
        updatedAt: Date;
      }>(
        `SELECT payload, version, "updatedAt" FROM workspace_snapshots WHERE id = $1`,
        [WORKSPACE_SNAPSHOT_ID],
      );
      const snap = row.rows[0];
      if (!snap) {
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json({
          entries: {},
          version: 0,
          updatedAt: null,
        });
        return;
      }
      const rawPayload = snap.payload;
      const entries: Record<string, string> = {};
      if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
        for (const [k, v] of Object.entries(rawPayload)) {
          const s = jsonbValueToLocalStorageString(v);
          if (s !== null) entries[k] = s;
        }
      }
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        entries,
        version: snap.version,
        updatedAt: snap.updatedAt.toISOString(),
      });
      return;
    }

    if (op === "push") {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Méthode non autorisée." });
        return;
      }
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
        const updRow = upd.rows[0];
        if (!updRow) {
          res.status(404).json({ error: "Espace nuage introuvable." });
          return;
        }
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json({
          phase: "reset",
          version: updRow.version,
          updatedAt: updRow.updatedAt.toISOString(),
        });
        return;
      }

      const merge = body?.merge === true;
      const normalized = validateAndNormalizeEntries(body?.entries);
      if (!normalized.ok) {
        res.status(400).json({ error: normalized.error });
        return;
      }
      if (!merge && Object.keys(normalized.entries).length === 0) {
        res.status(400).json({
          error:
            "Refus de remplacer les données serveur par un contenu vide. (Protection anti-effacement) Utilisez reset:true si vous voulez vraiment tout effacer.",
        });
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
      const updRow = upd.rows[0];
      if (!updRow) {
        res.status(404).json({ error: "Espace nuage introuvable." });
        return;
      }

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        phase: merge ? "merge" : "replace",
        version: updRow.version,
        updatedAt: updRow.updatedAt.toISOString(),
      });
      return;
    }

    res.status(404).json({ error: "Opération de synchronisation inconnue." });
  } catch (e) {
    if (handleJwtConfigError(e, res)) return;
    console.error(e);
    res
      .status(500)
      .json({
        error:
          op === "pull"
            ? "Lecture nuage impossible."
            : "Envoi vers le nuage impossible.",
      });
  }
}
