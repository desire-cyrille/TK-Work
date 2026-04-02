/**
 * Crée ou promeut un compte administrateur (une fois en prod).
 * Usage :
 *   ADMIN_EMAIL=admin@local ADMIN_PASSWORD='votre-mot-de-passe' node scripts/bootstrap-admin.mjs
 * Requiert DATABASE_URL (fichier .env ou environnement).
 */
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const DATABASE_URL = process.env.DATABASE_URL?.trim();
const email = (process.env.ADMIN_EMAIL ?? "admin@local").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD?.trim() ?? "";

if (!DATABASE_URL) {
  console.error("DATABASE_URL manquant.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_PASSWORD doit faire au moins 8 caractères.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
const hash = bcrypt.hashSync(password, 10);

try {
  const found = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (found.rowCount && found.rowCount > 0) {
    await pool.query(
      `UPDATE users SET password_hash = $1, role = 'ADMIN'::"UserRole",
       must_change_password = false, "updatedAt" = NOW() WHERE email = $2`,
      [hash, email],
    );
    console.log(`Compte existant mis à jour : ${email} (ADMIN).`);
  } else {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, must_change_password, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN'::"UserRole", false, NOW(), NOW())`,
      [id, email, hash],
    );
    console.log(`Administrateur créé : ${email}`);
  }
} finally {
  await pool.end();
}
