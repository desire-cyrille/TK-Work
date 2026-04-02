import type { VercelRequest } from "@vercel/node";
import type { SessionClaims } from "./jwt";
import { verifySessionToken } from "./jwt";

export async function requireUser(
  req: VercelRequest,
): Promise<SessionClaims | null> {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) return null;
  const token = raw.slice(7).trim();
  if (!token) return null;
  try {
    const claims = await verifySessionToken(token);
    return claims;
  } catch {
    return null;
  }
}
