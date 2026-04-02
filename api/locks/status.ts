import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_lib/db.js";
import { cors } from "../_lib/http.js";
import { requireUser } from "../_lib/requireUser.js";
import {
  getWorkspaceLockStatus,
  isValidResourceKey,
} from "../_lib/workspaceLocks.js";

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
    const session = await requireUser(req);
    if (!session) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    const raw = req.query?.resourceKey;
    const resourceKey = typeof raw === "string" ? raw.trim() : "";
    if (!resourceKey || !isValidResourceKey(resourceKey)) {
      res.status(400).json({ error: "Clé de ressource invalide." });
      return;
    }

    const pool = getPool();
    const st = await getWorkspaceLockStatus(pool, resourceKey, session.userId);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(st);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("JWT_SECRET")) {
      res.status(503).json({ error: "Serveur mal configuré (JWT_SECRET)." });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Statut du verrou indisponible." });
  }
}
