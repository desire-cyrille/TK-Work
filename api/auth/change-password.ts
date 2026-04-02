import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { getPool } from "../_lib/db";
import { readJsonBody, cors } from "../_lib/http";
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
      currentPassword?: unknown;
      newPassword?: unknown;
    } | null;
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword.trim() : "";

    if (!currentPassword) {
      res.status(400).json({ error: "Mot de passe actuel requis." });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({
        error: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
      });
      return;
    }

    const pool = getPool();
    const row = await pool.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [user.userId],
    );
    const u = row.rows[0];
    if (!u || !bcrypt.compareSync(currentPassword, u.password_hash)) {
      res.status(401).json({ error: "Mot de passe actuel incorrect." });
      return;
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1, "updatedAt" = NOW() WHERE id = $2`,
      [hash, user.userId],
    );

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("JWT_SECRET")) {
      res.status(503).json({ error: "Serveur mal configuré (JWT_SECRET)." });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Impossible de mettre à jour le mot de passe." });
  }
}
