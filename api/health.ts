import type { VercelRequest, VercelResponse } from "@vercel/node";
import pg from "pg";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    res.status(503).json({
      ok: false,
      db: false,
      error: "DATABASE_URL manquant (variables Vercel / .env).",
    });
    return;
  }

  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await pool.query("SELECT 1");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, db: true });
  } catch (e) {
    console.error(e);
    res.status(503).json({
      ok: false,
      db: false,
      error: e instanceof Error ? e.message : "unknown_error",
    });
  } finally {
    await pool.end();
  }
}
