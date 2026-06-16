import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cors } from "../_lib/http.js";
import { requireUser } from "../_lib/requireUser.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ac = cors(req);
  if (ac) {
    for (const [k, v] of Object.entries(ac)) res.setHeader(k, v);
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  try {
    const user = await requireUser(req);
    if (!user) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch {
    res.status(500).json({ error: "Session inaccessible." });
  }
}
