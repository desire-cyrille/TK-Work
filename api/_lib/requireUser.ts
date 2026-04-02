import type { VercelRequest } from "@vercel/node";
import { verifySessionToken } from "./jwt";

export async function requireUser(
  req: VercelRequest,
): Promise<{ userId: string; email: string } | null> {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) return null;
  const token = raw.slice(7).trim();
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
