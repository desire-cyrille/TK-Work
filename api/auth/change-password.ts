import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { cors, readJsonBody } from "../_lib/http.js";
import { requireUser } from "../_lib/requireUser.js";
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

  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  const body = readJsonBody(req) as {
    currentPassword?: unknown;
    newPassword?: unknown;
    confirmNewPassword?: unknown;
  } | null;
  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirm =
    typeof body?.confirmNewPassword === "string" ? body.confirmNewPassword : "";

  if (newPassword.length < 8) {
    res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    return;
  }
  if (newPassword !== confirm) {
    res.status(400).json({ error: "La confirmation ne correspond pas." });
    return;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, passwordHash: true, role: true, mustChangePassword: true },
    });
    if (!dbUser) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    // Si l'utilisateur n'est pas en mode "mot de passe provisoire", exiger l'ancien mot de passe.
    if (!dbUser.mustChangePassword) {
      if (!currentPassword) {
        res.status(400).json({ error: "Mot de passe actuel requis." });
        return;
      }
      const ok = bcrypt.compareSync(currentPassword, dbUser.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Mot de passe actuel incorrect." });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        passwordHash: bcrypt.hashSync(newPassword, 10),
        mustChangePassword: false,
      },
      select: { id: true, email: true, role: true, mustChangePassword: true },
    });

    const token = await signSessionToken(
      updated.id,
      updated.email,
      updated.role === "ADMIN" ? "ADMIN" : "USER",
      updated.mustChangePassword,
    );

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      token,
      email: updated.email,
      role: updated.role === "ADMIN" ? "ADMIN" : "USER",
      mustChangePassword: updated.mustChangePassword,
    });
  } catch (e) {
    if (handleJwtConfigError(e, res)) return;
    console.error(e);
    res.status(500).json({ error: "Changement de mot de passe impossible." });
  }
}
