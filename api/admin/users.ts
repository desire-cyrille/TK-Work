import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { EMAIL_RE } from "../_lib/email.js";
import { cors, readJsonBody } from "../_lib/http.js";
import { requireUser } from "../_lib/requireUser.js";
import { prisma } from "../_lib/prisma.js";

function jsonError(res: VercelResponse, status: number, error: string) {
  res.status(status).json({ error });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ac = cors(req);
  if (ac) for (const [k, v] of Object.entries(ac)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const viewer = await requireUser(req);
  if (!viewer) {
    jsonError(res, 401, "Non authentifié.");
    return;
  }
  if (viewer.role !== "ADMIN") {
    jsonError(res, 403, "Accès refusé.");
    return;
  }

  if (req.method === "GET") {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      users: users.map((u) => ({
        ...u,
        role: u.role === "ADMIN" ? "ADMIN" : "USER",
        createdAt: u.createdAt.toISOString(),
      })),
    });
    return;
  }

  if (req.method === "POST") {
    const body = readJsonBody(req) as {
      email?: unknown;
      provisionalPassword?: unknown;
      role?: unknown;
    } | null;
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const email = emailRaw.trim().toLowerCase();
    const pwd =
      typeof body?.provisionalPassword === "string" ? body.provisionalPassword : "";
    const roleRaw = typeof body?.role === "string" ? body.role : "USER";
    const role = roleRaw === "ADMIN" ? "ADMIN" : "USER";

    if (!email || !EMAIL_RE.test(email)) {
      jsonError(res, 400, "E-mail invalide.");
      return;
    }
    if (pwd.length < 8) {
      jsonError(res, 400, "Mot de passe provisoire trop court (8 caractères min.).");
      return;
    }

    try {
      await prisma.user.create({
        data: {
          email,
          passwordHash: bcrypt.hashSync(pwd, 10),
          role,
          mustChangePassword: true,
        },
      });
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("email")) {
        jsonError(res, 409, "Un compte existe déjà avec cet e-mail.");
        return;
      }
      console.error(e);
      jsonError(res, 500, "Création impossible.");
    }
    return;
  }

  if (req.method === "PATCH") {
    const body = readJsonBody(req) as {
      id?: unknown;
      provisionalPassword?: unknown;
      role?: unknown;
    } | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      jsonError(res, 400, "ID manquant.");
      return;
    }

    const upd: { passwordHash?: string; mustChangePassword?: boolean; role?: "USER" | "ADMIN" } =
      {};
    if (typeof body?.provisionalPassword === "string") {
      const pwd = body.provisionalPassword;
      if (pwd.length < 8) {
        jsonError(res, 400, "8 caractères minimum.");
        return;
      }
      upd.passwordHash = bcrypt.hashSync(pwd, 10);
      upd.mustChangePassword = true;
    }
    if (typeof body?.role === "string") {
      upd.role = body.role === "ADMIN" ? "ADMIN" : "USER";
    }
    if (Object.keys(upd).length === 0) {
      jsonError(res, 400, "Aucun champ à mettre à jour.");
      return;
    }

    try {
      await prisma.user.update({ where: { id }, data: upd });
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error(e);
      jsonError(res, 500, "Mise à jour impossible.");
    }
    return;
  }

  if (req.method === "DELETE") {
    const idRaw = req.query?.id;
    const id = typeof idRaw === "string" ? idRaw.trim() : "";
    if (!id) {
      jsonError(res, 400, "ID manquant.");
      return;
    }
    try {
      await prisma.user.delete({ where: { id } });
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error(e);
      jsonError(res, 500, "Suppression impossible.");
    }
    return;
  }

  jsonError(res, 405, "Méthode non autorisée.");
}
