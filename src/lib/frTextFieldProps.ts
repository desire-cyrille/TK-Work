/**
 * À étaler sur les `<textarea>` pour activer la correction orthographique native
 * du navigateur en français (soulignements, clic droit / long appui selon l’OS).
 */
export const FR_TEXTAREA_PROPS = {
  spellCheck: true,
  lang: "fr",
} as const;
