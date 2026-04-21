import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cors } from "../_lib/http.js";

function boolFromEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (!v) return fallback;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return fallback;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ac = cors(req);
  if (ac) for (const [k, v] of Object.entries(ac)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  // Permet de masquer l'inscription publique si souhaité (prod).
  const publicSignup = boolFromEnv("PUBLIC_SIGNUP", true);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ publicSignup });
}
