import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_lib/db";
import { jsonbValueToLocalStorageString } from "../_lib/jsonbStorageValue";
import { cors } from "../_lib/http";
import { requireUser } from "../_lib/requireUser";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ac = cors(req);
  if (ac) {
    for (const [k, v] of Object.entries(ac)) res.setHeader(k, v);
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  try {
    const user = await requireUser(req);
    if (!user) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    const pool = getPool();
    const row = await pool.query<{
      payload: Record<string, unknown>;
      version: number;
      updatedAt: Date;
    }>(
      `SELECT payload, version, "updatedAt" FROM user_snapshots WHERE user_id = $1`,
      [user.userId],
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

    const raw = snap.payload;
    const entries: Record<string, string> = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("JWT_SECRET")) {
      res.status(503).json({ error: "Serveur mal configuré (JWT_SECRET)." });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Lecture nuage impossible." });
  }
}
