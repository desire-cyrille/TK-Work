import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getPool } from "../_lib/db.js";
import { EMAIL_RE } from "../_lib/email.js";
import { readJsonBody, cors } from "../_lib/http.js";
import { signSessionToken } from "../_lib/jwt.js";

function publicSignupAllowed(): boolean {
  const v = process.env.ALLOW_PUBLIC_SIGNUP?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
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
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const body = readJsonBody(req) as { email?: unknown; password?: unknown } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  let token: string;
  try {
    if (!publicSignupAllowed()) {
      res.status(403).json({
        error:
          "L’inscription publique est désactivée. Contactez l’administrateur.",
      });
      return;
    }
    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "E-mail invalide." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({
        error: "Le mot de passe doit contenir au moins 8 caractères.",
      });
      return;
    }

    const pool = getPool();
    const dup = await pool.query(`SELECT id FROM users WHERE email = $1`, [
      email,
    ]);
    if (dup.rowCount && dup.rowCount > 0) {
      res.status(409).json({ error: "Un compte existe déjà avec cet e-mail." });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [userId, email, passwordHash],
    );

    token = await signSessionToken(userId, email, "USER", false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("JWT_SECRET")) {
      res.status(503).json({ error: "Serveur mal configuré (JWT_SECRET)." });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Inscription impossible pour le moment." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(201).json({
    token,
    email,
    role: "USER",
    mustChangePassword: false,
  });
}
