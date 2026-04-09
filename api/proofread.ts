import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cors, readJsonBody } from "./_lib/http";

const LT_URL = "https://api.languagetool.org/v2/check";
const MAX_CHARS = 20_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const c = cors(req);
  if (c) {
    for (const [k, v] of Object.entries(c)) res.setHeader(k, v);
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const body = readJsonBody(req) as { text?: unknown } | null;
  const raw = typeof body?.text === "string" ? body.text : "";
  const text = raw.slice(0, MAX_CHARS);

  if (!text.trim()) {
    res.status(400).json({ error: "empty_text", message: "Texte vide." });
    return;
  }

  const params = new URLSearchParams();
  params.set("text", text);
  params.set("language", "fr");

  const apiKey =
    typeof process.env.LANGUAGETOOL_API_KEY === "string"
      ? process.env.LANGUAGETOOL_API_KEY.trim()
      : "";
  if (apiKey) {
    params.set("apiKey", apiKey);
  }

  try {
    const ltRes = await fetch(LT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "TKProGestionBiens/1.0 (proofread proxy)",
      },
      body: params.toString(),
    });

    if (!ltRes.ok) {
      const errTxt = await ltRes.text().catch(() => "");
      res.status(502).json({
        error: "languagetool_error",
        message: "Service de correction temporairement indisponible.",
        detail: errTxt.slice(0, 200),
      });
      return;
    }

    const data = (await ltRes.json()) as {
      matches?: {
        offset: number;
        length: number;
        message: string;
        shortMessage?: string;
        replacements?: { value: string }[];
        rule?: { id?: string; description?: string };
      }[];
    };

    const matches = (data.matches ?? []).map((m) => ({
      offset: m.offset,
      length: m.length,
      message: m.message,
      shortMessage: m.shortMessage,
      replacements: (m.replacements ?? []).map((r) => r.value).filter(Boolean),
      ruleId: m.rule?.id,
      ruleDescription: m.rule?.description,
    }));

    res.status(200).json({ matches, truncated: raw.length > MAX_CHARS });
  } catch {
    res.status(502).json({
      error: "network",
      message: "Impossible de joindre le service de correction.",
    });
  }
}
