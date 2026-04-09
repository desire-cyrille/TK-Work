export type ProofreadMatch = {
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements: string[];
  ruleId?: string;
  ruleDescription?: string;
};

export type ProofreadResult =
  | { ok: true; matches: ProofreadMatch[]; truncated?: boolean }
  | { ok: false; message: string };

export async function requestProofread(text: string): Promise<ProofreadResult> {
  try {
    const r = await fetch("/api/proofread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const j = (await r.json()) as {
      error?: string;
      message?: string;
      matches?: ProofreadMatch[];
      truncated?: boolean;
    };

    if (!r.ok) {
      return {
        ok: false,
        message:
          typeof j.message === "string" && j.message.trim()
            ? j.message
            : "Vérification impossible pour le moment.",
      };
    }

    return {
      ok: true,
      matches: Array.isArray(j.matches) ? j.matches : [],
      truncated: Boolean(j.truncated),
    };
  } catch {
    return { ok: false, message: "Erreur réseau." };
  }
}
