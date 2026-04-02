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
  getAuthEmail,
  getAuthToken,
  isAuthTokenExpired,
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
  login: (email: string, password: string) => Promise<AuthActionResult>;
  signup: (email: string, password: string) => Promise<AuthActionResult>;
  logout: () => void;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ) => Promise<ProfileUpdateResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readInitialSession(): { auth: boolean; email: string } {
  const t = getAuthToken();
  if (!t || isAuthTokenExpired(t)) {
    if (t) clearAuthSession();
    return { auth: false, email: "" };
  }
  return { auth: true, email: getAuthEmail() ?? "" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const init = readInitialSession();
  const [isAuthenticated, setAuth] = useState(init.auth);
  const [profileEmail, setProfileEmail] = useState(init.email);

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as {
      token?: string;
      email?: string;
      error?: string;
    };
    if (!r.ok) {
      return {
        ok: false as const,
        error: data.error ?? `Erreur ${r.status}`,
      };
    }
    if (typeof data.token !== "string" || typeof data.email !== "string") {
      return { ok: false as const, error: "Réponse serveur invalide." };
    }
    setAuthSession(data.token, data.email);
    setAuth(true);
    setProfileEmail(data.email);
    return { ok: true as const };
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as {
      token?: string;
      email?: string;
      error?: string;
    };
    if (!r.ok) {
      return {
        ok: false as const,
        error: data.error ?? `Erreur ${r.status}`,
      };
    }
    if (typeof data.token !== "string" || typeof data.email !== "string") {
      return { ok: false as const, error: "Réponse serveur invalide." };
    }
    setAuthSession(data.token, data.email);
    setAuth(true);
    setProfileEmail(data.email);
    return { ok: true as const };
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setAuth(false);
    setProfileEmail("");
  }, []);

  const updatePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
      confirmNewPassword: string,
    ): Promise<ProfileUpdateResult> => {
      const token = getAuthToken();
      if (!token) {
        return { ok: false, error: "Non connecté." };
      }
      const np = newPassword.trim();
      if (np.length < 8) {
        return {
          ok: false,
          error: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
        };
      }
      if (np !== confirmNewPassword) {
        return {
          ok: false,
          error: "La confirmation ne correspond pas au nouveau mot de passe.",
        };
      }
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword: np }),
        cache: "no-store",
      });
      const errBody = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        return {
          ok: false,
          error: errBody.error ?? `Erreur ${r.status}`,
        };
      }
      return { ok: true };
    },
    [],
  );

  const value = useMemo(
    () => ({
      isAuthenticated,
      profileEmail,
      login,
      signup,
      logout,
      updatePassword,
    }),
    [
      isAuthenticated,
      profileEmail,
      login,
      signup,
      logout,
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
