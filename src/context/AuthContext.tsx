import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearAuthSession,
  setAuthSession,
} from "../lib/authToken";

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type ProfileUpdateResult =
  | { ok: true }
  | { ok: false; error: string };

type AuthContextValue = {
  isAuthenticated: boolean;
  profileEmail: string;
  role: "USER" | "ADMIN";
  isAdmin: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  signup: (email: string, password: string) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  applySessionToken: (token: string, email: string) => void;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ) => Promise<ProfileUpdateResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Profil unique admin: l'app fonctionne en accès direct, sans écran de connexion.
  // On conserve les clés existantes (token/email) pour compatibilité, mais elles ne sont plus requises.
  const [isAuthenticated] = useState(true);
  const [profileEmail, setProfileEmail] = useState("admin@local");
  const [role] = useState<"USER" | "ADMIN">("ADMIN");
  const [mustChangePassword] = useState(false);

  const applySessionToken = useCallback((token: string, email: string) => {
    setAuthSession(token, email);
    setProfileEmail(email.trim().toLowerCase());
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    void password;
    // Accès direct: on accepte.
    setProfileEmail(email.trim().toLowerCase() || "admin@local");
    return { ok: true as const };
  }, [applySessionToken]);

  const signup = useCallback(async (email: string, password: string) => {
    void password;
    setProfileEmail(email.trim().toLowerCase() || "admin@local");
    return { ok: true as const };
  }, [applySessionToken]);

  const logout = useCallback(async () => {
    // Mode admin unique: on ne déconnecte pas, mais on garde l'action pour compat UI.
    clearAuthSession();
    setProfileEmail("admin@local");
  }, []);

  const updatePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
      confirmNewPassword: string,
    ): Promise<ProfileUpdateResult> => {
      void currentPassword;
      void newPassword;
      void confirmNewPassword;
      return { ok: true };
    },
    [],
  );

  const value = useMemo(
    () => ({
      isAuthenticated,
      profileEmail,
      role,
      isAdmin: role === "ADMIN",
      mustChangePassword,
      login,
      signup,
      logout,
      applySessionToken,
      updatePassword,
    }),
    [
      isAuthenticated,
      profileEmail,
      role,
      mustChangePassword,
      login,
      signup,
      logout,
      applySessionToken,
      updatePassword,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
