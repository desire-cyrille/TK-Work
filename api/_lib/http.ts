import type { VercelRequest } from "@vercel/node";

export function readJsonBody(req: VercelRequest): unknown {
  const b = req.body;
  if (b == null) return null;
  if (typeof b === "object" && !Array.isArray(b)) return b;
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

export function cors(req: VercelRequest): Record<string, string> | null {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    };
  }
  return null;
}
