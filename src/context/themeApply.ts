import type { ThemeSettings } from "./themeSettingsStorage";

const BRAND_GRADIENT = "linear-gradient(to right, #ff4b2b, #ff416c)";

/** Écrit les variables CSS sur :root pour le menu, les onglets et la zone droite */
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

  if (s.navActiveMode === "gradient") {
    r.style.setProperty("--app-nav-active", BRAND_GRADIENT);
  } else {
    r.style.setProperty(
      "--app-nav-active",
      s.navActiveSolid.trim() || "#ff416c"
    );
  }

  if (s.workspaceMode === "image" && s.workspaceImage.trim()) {
    const url = s.workspaceImage.trim().replace(/"/g, '\\"');
    r.style.setProperty("--app-workspace-image", `url("${url}")`);
    r.style.setProperty("--app-workspace-bg", "transparent");
    r.style.setProperty(
      "--app-main-bg",
      s.workspaceColor.trim() || "#1a1a1a"
    );
  } else {
    r.style.removeProperty("--app-workspace-image");
    const c = s.workspaceColor.trim() || "#1a1a1a";
    r.style.setProperty("--app-workspace-bg", c);
    r.style.setProperty("--app-main-bg", c);
  }
}
