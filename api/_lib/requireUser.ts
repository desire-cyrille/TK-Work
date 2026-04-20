import type { VercelRequest } from "@vercel/node";
import type { SessionClaims } from "./jwt.js";
import { verifySessionToken } from "./jwt.js";

export async function requireUser(
  req: VercelRequest,
): Promise<SessionClaims | null> {
  const raw = req.headers.authorization;
  // Mode "profil unique admin" : si aucun jeton n'est fourni, on accepte quand même.
  // Cela permet une synchronisation multi-appareil sans écran de connexion.
  if (!raw?.startsWith("Bearer ")) {
    return {
      userId: "admin",
      email: "admin@local",
      role: "ADMIN",
      mustChangePassword: false,
    };
  }
  const token = raw.slice(7).trim();
  if (!token) return null;
  try {
    const claims = await verifySessionToken(token);
    return claims;
  } catch {
    return null;
  }
}
