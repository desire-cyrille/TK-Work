import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_lib/db.js";
import { readJsonBody, cors } from "../_lib/http.js";
import { requireUser } from "../_lib/requireUser.js";
import {
  acquireWorkspaceLock,
  displayLabelFromEmail,
  getWorkspaceLockStatus,
  heartbeatWorkspaceLock,
  isValidResourceKey,
  releaseWorkspaceLock,
} from "../_lib/workspaceLocks.js";

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

  const raw = req.query?.action;
  const action = typeof raw === "string" ? raw.toLowerCase() : "";

  try {
    if (action === "acquire") {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Méthode non autorisée." });
        return;
      }
      const session = await requireUser(req);
      if (!session) {
        res.status(401).json({ error: "Non authentifié." });
        return;
      }
      const body = readJsonBody(req) as { resourceKey?: unknown } | null;
      const resourceKey =
        typeof body?.resourceKey === "string" ? body.resourceKey.trim() : "";
      if (!resourceKey || !isValidResourceKey(resourceKey)) {
        res.status(400).json({ error: "Clé de ressource invalide." });
        return;
      }
      const pool = getPool();
      const label = displayLabelFromEmail(session.email);
      const r = await acquireWorkspaceLock(
        pool,
        resourceKey,
        session.userId,
        session.email,
        label,
        session.role,
      );
      res.setHeader("Cache-Control", "no-store");
      if (r.ok) {
        res.status(200).json({ ok: true });
        return;
      }
      res.status(409).json({
        ok: false,
        lockedByLabel: r.lockedByLabel,
        lockedByEmail: r.lockedByEmail,
        error: `Document déjà en cours d’utilisation (${r.lockedByLabel}).`,
      });
      return;
    }

    if (action === "release") {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Méthode non autorisée." });
        return;
      }
      const session = await requireUser(req);
      if (!session) {
        res.status(401).json({ error: "Non authentifié." });
        return;
      }
      const body = readJsonBody(req) as { resourceKey?: unknown } | null;
      const resourceKey =
        typeof body?.resourceKey === "string" ? body.resourceKey.trim() : "";
      if (!resourceKey || !isValidResourceKey(resourceKey)) {
        res.status(400).json({ error: "Clé de ressource invalide." });
        return;
      }
      const pool = getPool();
      await releaseWorkspaceLock(pool, resourceKey, session.userId);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true });
      return;
    }

    if (action === "heartbeat") {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Méthode non autorisée." });
        return;
      }
      const session = await requireUser(req);
      if (!session) {
        res.status(401).json({ error: "Non authentifié." });
        return;
      }
      const body = readJsonBody(req) as { resourceKey?: unknown } | null;
      const resourceKey =
        typeof body?.resourceKey === "string" ? body.resourceKey.trim() : "";
      if (!resourceKey || !isValidResourceKey(resourceKey)) {
        res.status(400).json({ error: "Clé de ressource invalide." });
        return;
      }
      const pool = getPool();
      const touched = await heartbeatWorkspaceLock(
        pool,
        resourceKey,
        session.userId,
      );
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true, touched });
      return;
    }

    if (action === "status") {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Méthode non autorisée." });
        return;
      }
      const session = await requireUser(req);
      if (!session) {
        res.status(401).json({ error: "Non authentifié." });
        return;
      }
      const rk = req.query?.resourceKey;
      const resourceKey = typeof rk === "string" ? rk.trim() : "";
      if (!resourceKey || !isValidResourceKey(resourceKey)) {
        res.status(400).json({ error: "Clé de ressource invalide." });
        return;
      }
      const pool = getPool();
      const st = await getWorkspaceLockStatus(pool, resourceKey, session.userId);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(st);
      return;
    }

    res.status(404).json({ error: "Action de verrou inconnue." });
  } catch (e) {
    if (handleJwtConfigError(e, res)) return;
    console.error(e);
    const fallback =
      action === "release"
        ? "Libération du verrou impossible."
        : action === "heartbeat"
          ? "Heartbeat impossible."
          : action === "status"
            ? "Statut du verrou indisponible."
            : "Verrou indisponible.";
    res.status(500).json({ error: fallback });
  }
}
