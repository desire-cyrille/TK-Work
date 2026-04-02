import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL manquant");
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 2 });
  }
  return pool;
}
