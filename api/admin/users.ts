import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getPool } from "../_lib/db";
import { readJsonBody, cors } from "../_lib/http";
import { requireUser } from "../_lib/requireUser";
import type { SessionClaims } from "../_lib/jwt";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type UserRow = {
  id: string;
  email: string;
  role: string;
  must_change_password: boolean;
  createdAt: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ac = cors(req);
  if (ac) {
    for (const [k, v] of Object.entries(ac)) res.setHeader(k, v);
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const session = await requireUser(req);
    if (!session) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    const pool = getPool();
    const roleCheck = await pool.query<{ role: string }>(
      `SELECT role::text AS role FROM users WHERE id = $1`,
      [session.userId],
    );
    if (roleCheck.rows[0]?.role !== "ADMIN") {
      res.status(403).json({ error: "Droits administrateur requis." });
      return;
    }

    const admin: SessionClaims = session;

    if (req.method === "GET") {
      const rows = await pool.query<UserRow>(
        `SELECT id, email, role::text AS role, must_change_password,
                "createdAt"::text AS "createdAt"
         FROM users ORDER BY email ASC`,
      );
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        users: rows.rows.map((r) => ({
          id: r.id,
          email: r.email,
          role: r.role === "ADMIN" ? "ADMIN" : "USER",
          mustChangePassword: r.must_change_password,
          createdAt: r.createdAt,
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
      const email =
        typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      const provisionalPassword =
        typeof body?.provisionalPassword === "string"
          ? body.provisionalPassword
          : "";
      const roleRaw = body?.role;
      const role =
        roleRaw === "ADMIN" ? "ADMIN" : ("USER" as const);

      if (!email || !EMAIL_RE.test(email)) {
        res.status(400).json({ error: "E-mail invalide." });
        return;
      }
      if (provisionalPassword.length < 8) {
        res.status(400).json({
          error:
            "Le mot de passe provisoire doit contenir au moins 8 caractères.",
        });
        return;
      }

      const dup = await pool.query(`SELECT id FROM users WHERE email = $1`, [
        email,
      ]);
      if (dup.rowCount && dup.rowCount > 0) {
        res.status(409).json({ error: "Un compte existe déjà avec cet e-mail." });
        return;
      }

      const userId = randomUUID();
      const hash = bcrypt.hashSync(provisionalPassword, 10);
      await pool.query(
        `INSERT INTO users (id, email, password_hash, role, must_change_password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4::"UserRole", true, NOW(), NOW())`,
        [userId, email, hash, role],
      );

      res.setHeader("Cache-Control", "no-store");
      res.status(201).json({
        id: userId,
        email,
        role,
        mustChangePassword: true,
      });
      return;
    }

    if (req.method === "PATCH") {
      const body = readJsonBody(req) as {
        id?: unknown;
        email?: unknown;
        role?: unknown;
        provisionalPassword?: unknown;
      } | null;
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) {
        res.status(400).json({ error: "Identifiant utilisateur requis." });
        return;
      }

      const row = await pool.query<{ role: string }>(
        `SELECT role::text AS role FROM users WHERE id = $1`,
        [id],
      );
      const existing = row.rows[0];
      if (!existing) {
        res.status(404).json({ error: "Utilisateur introuvable." });
        return;
      }

      let nextEmail: string | null = null;
      if (body?.email !== undefined) {
        const em =
          typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!em || !EMAIL_RE.test(em)) {
          res.status(400).json({ error: "E-mail invalide." });
          return;
        }
        nextEmail = em;
      }

      let nextRole: "USER" | "ADMIN" | null = null;
      if (body?.role !== undefined) {
        nextRole = body.role === "ADMIN" ? "ADMIN" : "USER";
      }

      let newPwd: string | null = null;
      if (body?.provisionalPassword !== undefined) {
        const pp =
          typeof body.provisionalPassword === "string"
            ? body.provisionalPassword
            : "";
        if (pp.length < 8) {
          res.status(400).json({
            error:
              "Le mot de passe provisoire doit contenir au moins 8 caractères.",
          });
          return;
        }
        newPwd = pp;
      }

      if (
        id === admin.userId &&
        nextRole === "USER" &&
        existing.role === "ADMIN"
      ) {
        const admins = await pool.query(
          `SELECT COUNT(*)::int AS n FROM users WHERE role = 'ADMIN'`,
        );
        if ((admins.rows[0]?.n ?? 0) <= 1) {
          res.status(400).json({
            error: "Impossible de retirer le dernier administrateur.",
          });
          return;
        }
      }

      if (nextEmail) {
        const clash = await pool.query(`SELECT id FROM users WHERE email = $1`, [
          nextEmail,
        ]);
        const other = clash.rows[0];
        if (other && other.id !== id) {
          res.status(409).json({ error: "Cet e-mail est déjà utilisé." });
          return;
        }
      }

      const sets: string[] = [`"updatedAt" = NOW()`];
      const args: unknown[] = [];
      let i = 1;

      if (nextEmail) {
        sets.push(`email = $${i}`);
        args.push(nextEmail);
        i += 1;
      }
      if (nextRole) {
        sets.push(`role = $${i}::"UserRole"`);
        args.push(nextRole);
        i += 1;
      }
      if (newPwd) {
        sets.push(`password_hash = $${i}`);
        args.push(bcrypt.hashSync(newPwd, 10));
        i += 1;
        sets.push(`must_change_password = true`);
      }

      if (args.length === 0 && !sets.some((s) => s.includes("must_change"))) {
        res.status(400).json({ error: "Aucune modification demandée." });
        return;
      }

      args.push(id);
      await pool.query(
        `UPDATE users SET ${sets.join(", ")} WHERE id = $${i}`,
        args,
      );

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      const rawId =
        typeof req.query.id === "string"
          ? req.query.id.trim()
          : Array.isArray(req.query.id)
            ? req.query.id[0]?.trim() ?? ""
            : "";
      if (!rawId) {
        res.status(400).json({ error: "Paramètre id requis." });
        return;
      }
      if (rawId === admin.userId) {
        res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
        return;
      }

      const u = await pool.query<{ role: string }>(
        `SELECT role::text AS role FROM users WHERE id = $1`,
        [rawId],
      );
      const victim = u.rows[0];
      if (!victim) {
        res.status(404).json({ error: "Utilisateur introuvable." });
        return;
      }
      if (victim.role === "ADMIN") {
        const admins = await pool.query(
          `SELECT COUNT(*)::int AS n FROM users WHERE role = 'ADMIN'`,
        );
        if ((admins.rows[0]?.n ?? 0) <= 1) {
          res.status(400).json({
            error: "Impossible de supprimer le dernier administrateur.",
          });
          return;
        }
      }

      await pool.query(`DELETE FROM users WHERE id = $1`, [rawId]);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Méthode non autorisée." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("JWT_SECRET")) {
      res.status(503).json({ error: "Serveur mal configuré (JWT_SECRET)." });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Opération impossible pour le moment." });
  }
}
