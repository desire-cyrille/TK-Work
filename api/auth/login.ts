import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { EMAIL_RE } from "../_lib/email.js";
import { cors, readJsonBody } from "../_lib/http.js";
import { signSessionToken } from "../_lib/jwt.js";
import { prisma } from "../_lib/prisma.js";

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
  if (ac) for (const [k, v] of Object.entries(ac)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const body = readJsonBody(req) as { email?: unknown; password?: unknown } | null;
  const emailRaw = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const email = emailRaw.trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "E-mail invalide." });
    return;
  }
  if (!password) {
    res.status(400).json({ error: "Mot de passe manquant." });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        mustChangePassword: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    const ok = bcrypt.compareSync(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    const token = await signSessionToken(
      user.id,
      user.email,
      user.role === "ADMIN" ? "ADMIN" : "USER",
      user.mustChangePassword,
    );

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      token,
      email: user.email,
      role: user.role === "ADMIN" ? "ADMIN" : "USER",
      mustChangePassword: user.mustChangePassword,
    });
  } catch (e) {
    if (handleJwtConfigError(e, res)) return;
    console.error(e);
    res.status(500).json({ error: "Connexion impossible." });
  }
}

