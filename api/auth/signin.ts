import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { getPool } from "../_lib/db.js";
import { readJsonBody, cors } from "../_lib/http.js";
import { signSessionToken } from "../_lib/jwt.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

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

  const body = readJsonBody(req) as { email?: unknown; password?: unknown } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "E-mail invalide." });
    return;
  }
  if (!password) {
    res.status(400).json({ error: "Mot de passe requis." });
    return;
  }

  try {
    const pool = getPool();
    const row = await pool.query<{
      id: string;
      password_hash: string;
      role: string;
      must_change_password: boolean;
    }>(
      `SELECT id, password_hash, role::text AS role, must_change_password
       FROM users WHERE email = $1`,
      [email],
    );
    const u = row.rows[0];
    if (!u || !bcrypt.compareSync(password, u.password_hash)) {
      res.status(401).json({ error: "E-mail ou mot de passe incorrect." });
      return;
    }
    const role = u.role === "ADMIN" ? "ADMIN" : ("USER" as const);
    const token = await signSessionToken(
      u.id,
      email,
      role,
      u.must_change_password,
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      token,
      email,
      role,
      mustChangePassword: u.must_change_password,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("JWT_SECRET")) {
      res.status(503).json({ error: "Serveur mal configuré (JWT_SECRET)." });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Connexion impossible pour le moment." });
  }
}
