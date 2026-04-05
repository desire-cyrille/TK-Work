import type { ThemeSettings } from "./themeSettingsStorage";

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
      ? { r, g, b }
      : null;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
      ? { r, g, b }
      : null;
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function darkenRgb(
  rgb: { r: number; g: number; b: number },
  factor: number,
): { r: number; g: number; b: number } {
  return {
    r: rgb.r * factor,
    g: rgb.g * factor,
    b: rgb.b * factor,
  };
}

const FALLBACK_PRIMARY = "#e53935";

/** Écrit les variables CSS sur :root pour le menu, les onglets, la zone droite et l’accent global */
export function applyThemeToDocument(s: ThemeSettings) {
  const r = document.documentElement;

  if (s.sidebarBg.trim()) {
    r.style.setProperty("--app-sidebar-bg", s.sidebarBg.trim());
  } else {
    r.style.removeProperty("--app-sidebar-bg");
  }

  if (s.navInactiveBg.trim()) {
    r.style.setProperty("--app-nav-inactive", s.navInactiveBg.trim());
  } else {
    r.style.removeProperty("--app-nav-inactive");
  }

  const primaryRgb =
    parseHexRgb(s.accentPrimary.trim()) ?? parseHexRgb(FALLBACK_PRIMARY)!;
  const secTrim = s.accentSecondary.trim();
  const secondaryRgb = secTrim.length
    ? parseHexRgb(secTrim) ?? darkenRgb(primaryRgb, 0.78)
    : darkenRgb(primaryRgb, 0.78);
  const primary = rgbToHex(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  const secondary = rgbToHex(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);
  const grad = `linear-gradient(105deg, ${primary} 0%, ${secondary} 100%)`;

  r.style.setProperty("--tk-red", primary);
  r.style.setProperty("--tk-red-dark", secondary);
  r.style.setProperty("--brand-orange", primary);
  r.style.setProperty("--brand-pink", secondary);
  r.style.setProperty("--gradient-brand", grad);
  r.style.setProperty(
    "--shadow-cta",
    `0 4px 18px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.28)`,
  );
  r.style.setProperty(
    "--sp-primary-light",
    `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`,
  );
  r.style.setProperty("--accent", primary);
  r.style.setProperty("--focus-ring", primary);
  r.style.setProperty("--sidebar-accent-line", primary);
  r.style.setProperty(
    "--accent-shadow-bar",
    `-4px 0 20px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.35)`,
  );

  if (s.navActiveMode === "gradient") {
    r.style.setProperty("--app-nav-active", grad);
  } else {
    r.style.setProperty(
      "--app-nav-active",
      s.navActiveSolid.trim() || primary,
    );
  }

  if (s.workspaceMode === "image" && s.workspaceImage.trim()) {
    const url = s.workspaceImage.trim().replace(/"/g, '\\"');
    r.style.setProperty("--app-workspace-image", `url("${url}")`);
    r.style.setProperty("--app-workspace-bg", "transparent");
    r.style.setProperty(
      "--app-main-bg",
      s.workspaceColor.trim() || "#f4f4f6"
    );
  } else {
    r.style.removeProperty("--app-workspace-image");
    const c = s.workspaceColor.trim() || "#f4f4f6";
    r.style.setProperty("--app-workspace-bg", c);
    r.style.setProperty("--app-main-bg", c);
  }
}
