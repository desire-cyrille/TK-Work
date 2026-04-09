import { useEffect, useState } from "react";
import {
  type ProofreadMatch,
  requestProofread,
} from "../lib/proofreadClient";
import { FR_TEXTAREA_PROPS } from "../lib/frTextFieldProps";
import styles from "./TextProofreadDialog.module.css";

function snippetAround(text: string, offset: number, length: number): string {
  const pad = 24;
  const start = Math.max(0, offset - pad);
  const end = Math.min(text.length, offset + length + pad);
  const left = start > 0 ? "…" : "";
  const right = end < text.length ? "…" : "";
  const mid = text.slice(offset, offset + length);
  const before = text.slice(start, offset);
  const after = text.slice(offset + length, end);
  return `${left}${before}【${mid}】${after}${right}`;
}

function applyReplacement(
  text: string,
  offset: number,
  length: number,
  replacement: string,
): string {
  return text.slice(0, offset) + replacement + text.slice(offset + length);
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function TextProofreadDialog({ open, onClose }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ProofreadMatch[] | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMatches(null);
    setTruncated(false);
  }, [open]);

  if (!open) return null;

  async function runCheck() {
    setLoading(true);
    setError(null);
    setMatches(null);
    setTruncated(false);
    const res = await requestProofread(text);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMatches(res.matches);
    setTruncated(Boolean(res.truncated));
  }

  function applyOne(m: ProofreadMatch, replacement: string) {
    setText((t) => applyReplacement(t, m.offset, m.length, replacement));
    setMatches(null);
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proofread-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <div>
            <h2 id="proofread-dialog-title" className={styles.title}>
              Orthographe & grammaire
            </h2>
            <p className={styles.sub}>
              Collez un texte (contrat, rapport, devis…), vérifiez-le puis
              copiez-le dans votre formulaire. Correction fournie par{" "}
              <a
                href="https://languagetool.org"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#5eead4" }}
              >
                LanguageTool
              </a>{" "}
              (limite ~20&nbsp;000 caractères).
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Fermer"
          >
            Fermer
          </button>
        </div>
        <div className={styles.body}>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Collez votre texte ici…"
            {...FR_TEXTAREA_PROPS}
          />
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void runCheck()}
              disabled={loading || !text.trim()}
            >
              {loading ? "Vérification…" : "Lancer la vérification"}
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  setText(t);
                } catch {
                  setError(
                    "Accès au presse-papiers refusé — collez manuellement (Ctrl+V).",
                  );
                }
              }}
            >
              Coller depuis le presse-papiers
            </button>
          </div>
          {error ? <p className={styles.err}>{error}</p> : null}
          {truncated ? (
            <p className={styles.trunc}>
              Texte tronqué à 20&nbsp;000 caractères pour l’analyse.
            </p>
          ) : null}
          {matches && matches.length === 0 ? (
            <p className={styles.emptyOk}>
              Aucune alerte détectée pour ce passage (relisez tout de même avant
              envoi).
            </p>
          ) : null}
          {matches && matches.length > 0 ? (
            <>
              <p className={styles.matchesTitle}>
                Suggestions ({matches.length}) — cliquez pour corriger le texte
                ci-dessus, puis relancez la vérification si besoin
              </p>
              <ul className={styles.matchList}>
                {matches.map((m, i) => (
                  <li key={`${m.offset}-${m.length}-${i}`} className={styles.matchCard}>
                    <p className={styles.matchSnippet}>
                      {snippetAround(text, m.offset, m.length)}
                    </p>
                    <p className={styles.matchMsg}>{m.message}</p>
                    {m.replacements.length > 0 ? (
                      <div className={styles.suggestions}>
                        {m.replacements.slice(0, 6).map((rep) => (
                          <button
                            key={rep}
                            type="button"
                            className={styles.sugBtn}
                            onClick={() => applyOne(m, rep)}
                          >
                            {rep || "∅"}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
