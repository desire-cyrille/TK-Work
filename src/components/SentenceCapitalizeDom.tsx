import { useEffect } from "react";

/** Met en majuscule la première lettre du texte et après . ! ? ou fin de ligne. */
export function capitalizeSentenceStarts(value: string): string {
  return value.replace(
    /(^|[.!?]\s+|[\r\n]+)([\p{Ll}])/gu,
    (_match, prefix: string, letter: string) =>
      prefix + letter.toLocaleUpperCase("fr-FR"),
  );
}

const EXCLUDED_INPUT_TYPES = new Set([
  "password",
  "email",
  "url",
  "tel",
  "number",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "color",
  "range",
  "file",
  "hidden",
  "checkbox",
  "radio",
  "submit",
  "button",
  "image",
]);

function isTextLikeInput(el: HTMLInputElement): boolean {
  const t = el.type;
  if (EXCLUDED_INPUT_TYPES.has(t)) return false;
  return t === "text" || t === "search" || t === "";
}

function shouldApply(
  el: EventTarget | null,
): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return false;
  if (el.getAttribute("data-no-sentence-cap") !== null) return false;

  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly && !el.disabled;
  }
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && !el.disabled && isTextLikeInput(el);
  }
  return false;
}

/**
 * Applique la majuscule en début de phrase sur les champs texte / textarea.
 * Écoute en capture pour que la valeur corrigée soit lue par les onChange React.
 * Désactiver sur un champ : attribut data-no-sentence-cap
 */
export function SentenceCapitalizeDom() {
  useEffect(() => {
    const onInput = (e: Event) => {
      if (e instanceof InputEvent && e.isComposing) return;
      const target = e.target;
      if (!shouldApply(target)) return;

      const el = target;
      const prev = el.value;
      const next = capitalizeSentenceStarts(prev);
      if (next === prev) return;

      const start = el.selectionStart ?? prev.length;
      const end = el.selectionEnd ?? prev.length;
      el.value = next;
      const delta = next.length - prev.length;
      el.setSelectionRange(start + delta, end + delta);
    };

    document.addEventListener("input", onInput, true);
    return () => document.removeEventListener("input", onInput, true);
  }, []);

  return null;
}
