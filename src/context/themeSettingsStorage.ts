export const THEME_STORAGE_KEY = "tk-gestion-theme-v2";

/** Nom affiché en pied de page des PDF (quittances, avis, baux…) si non renseigné dans les réglages. */
export const DEFAULT_EMETTEUR_DOCUMENTS_PDF = "TK PRO SYNERGIE";

export type ThemeSettings = {
  brandName: string;
  /**
   * Mention « Document généré par … » sur les exports PDF.
   * @default DEFAULT_EMETTEUR_DOCUMENTS_PDF
   */
  emetteurDocumentsPdf: string;
  /**
   * Image PNG ou JPEG en data URL (`data:image/...;base64,...`) pour l’en-tête des PDF.
   * Vide = pas de logo.
   */
  logoDocumentsPdf: string;
  /** Vide = dégradé bleu nuit par défaut */
  sidebarBg: string;
  /** Vide = translucide par défaut */
  navInactiveBg: string;
  /**
   * Couleur d’accent : bandeaux PageFrame, onglets modules, dégradés `--gradient-brand`, focus.
   * @default #e53935
   */
  accentPrimary: string;
  /**
   * 2ᵉ couleur du dégradé global ; vide = dérivée automatiquement (plus foncée) à partir de `accentPrimary`.
   */
  accentSecondary: string;
  navActiveMode: "gradient" | "solid";
  navActiveSolid: string;
  workspaceMode: "color" | "image";
  workspaceColor: string;
  workspaceImage: string;
};

/** Taille max recommandée du fichier logo avant encodage base64 (stockage localStorage). */
export const LOGO_DOCUMENTS_MAX_FILE_BYTES = 400_000;

export const DEFAULT_THEME: ThemeSettings = {
  brandName: "TK Pro Gestion",
  emetteurDocumentsPdf: DEFAULT_EMETTEUR_DOCUMENTS_PDF,
  logoDocumentsPdf: "",
  sidebarBg: "#ffffff",
  navInactiveBg: "rgba(0, 0, 0, 0.04)",
  accentPrimary: "#e53935",
  accentSecondary: "#c62828",
  navActiveMode: "solid",
  navActiveSolid: "#e53935",
  workspaceMode: "color",
  workspaceColor: "#f4f4f6",
  workspaceImage: "",
};

export function loadThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
      const merged = { ...DEFAULT_THEME, ...parsed };
      if (!(merged.emetteurDocumentsPdf ?? "").trim()) {
        merged.emetteurDocumentsPdf = DEFAULT_EMETTEUR_DOCUMENTS_PDF;
      }
      if (merged.logoDocumentsPdf == null) {
        merged.logoDocumentsPdf = "";
      }
      if (typeof merged.accentPrimary !== "string" || !merged.accentPrimary.trim()) {
        merged.accentPrimary = DEFAULT_THEME.accentPrimary;
      }
      if (merged.accentSecondary == null || typeof merged.accentSecondary !== "string") {
        merged.accentSecondary = DEFAULT_THEME.accentSecondary;
      }
      return merged;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_THEME };
}

export function saveThemeSettings(s: ThemeSettings) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(s));
}
