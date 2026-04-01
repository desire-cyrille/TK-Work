import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyThemeToDocument } from "./themeApply";
import {
  DEFAULT_THEME,
  loadThemeSettings,
  saveThemeSettings,
  type ThemeSettings,
} from "./themeSettingsStorage";

type ThemeSettingsContextValue = {
  settings: ThemeSettings;
  setSettings: (s: ThemeSettings) => void;
  updateSettings: (patch: Partial<ThemeSettings>) => void;
  resetSettings: () => void;
};

const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(
  null
);

export function ThemeSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<ThemeSettings>(() =>
    loadThemeSettings()
  );

  useEffect(() => {
    saveThemeSettings(settings);
    applyThemeToDocument(settings);
  }, [settings]);

  const setSettings = useCallback((s: ThemeSettings) => {
    setSettingsState(s);
  }, []);

  const updateSettings = useCallback((patch: Partial<ThemeSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState({ ...DEFAULT_THEME });
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      updateSettings,
      resetSettings,
    }),
    [settings, setSettings, updateSettings, resetSettings]
  );

  return (
    <ThemeSettingsContext.Provider value={value}>
      {children}
    </ThemeSettingsContext.Provider>
  );
}

export function useThemeSettings() {
  const ctx = useContext(ThemeSettingsContext);
  if (!ctx) {
    throw new Error(
      "useThemeSettings must be used within ThemeSettingsProvider"
    );
  }
  return ctx;
}
