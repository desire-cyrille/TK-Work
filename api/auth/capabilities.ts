import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cors } from "../_lib/http.js";

function publicSignupAllowed(): boolean {
  const v = process.env.ALLOW_PUBLIC_SIGNUP?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

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
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ publicSignup: publicSignupAllowed() });
}
