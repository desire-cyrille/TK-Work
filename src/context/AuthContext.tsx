import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearAuthSession,
  decodeAuthTokenClaims,
  getAuthEmail,
  getAuthToken,
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
  const [profileEmail, setProfileEmail] = useState("admin@local");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const tok = getAuthToken();
    if (!tok) {
      setIsAuthenticated(false);
      setRole("USER");
      setMustChangePassword(false);
      setProfileEmail(getAuthEmail() ?? "admin@local");
      return;
    }
    const claims = decodeAuthTokenClaims(tok);
    if (!claims) {
      setIsAuthenticated(false);
      setRole("USER");
      setMustChangePassword(false);
      setProfileEmail(getAuthEmail() ?? "admin@local");
      return;
    }
    setIsAuthenticated(true);
    setProfileEmail(claims.email);
    setRole(claims.role);
    setMustChangePassword(claims.mustChangePassword);
  }, []);

  const applySessionToken = useCallback((token: string, email: string) => {
    setAuthSession(token, email);
    setProfileEmail(email.trim().toLowerCase());
    const claims = decodeAuthTokenClaims(token);
    setRole(claims?.role ?? "USER");
    setMustChangePassword(claims?.mustChangePassword ?? false);
    setIsAuthenticated(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const em = email.trim().toLowerCase();
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, password }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as {
      token?: string;
      email?: string;
      error?: string;
    };
    if (!r.ok || typeof data.token !== "string" || typeof data.email !== "string") {
      return { ok: false as const, error: data.error ?? `Erreur ${r.status}` };
    }
    applySessionToken(data.token, data.email);
    return { ok: true as const };
  }, [applySessionToken]);

  const signup = useCallback(async (email: string, password: string) => {
    const em = email.trim().toLowerCase();
    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, password }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as {
      token?: string;
      email?: string;
      error?: string;
    };
    if (!r.ok || typeof data.token !== "string" || typeof data.email !== "string") {
      return { ok: false as const, error: data.error ?? `Erreur ${r.status}` };
    }
    applySessionToken(data.token, data.email);
    return { ok: true as const };
  }, [applySessionToken]);

  const logout = useCallback(async () => {
    clearAuthSession();
    setProfileEmail("admin@local");
    setRole("USER");
    setMustChangePassword(false);
    setIsAuthenticated(false);
  }, []);

  const updatePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
      confirmNewPassword: string,
    ): Promise<ProfileUpdateResult> => {
      const tok = getAuthToken();
      if (!tok) return { ok: false, error: "Non authentifié." };
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
        cache: "no-store",
      });
      const data = (await r.json().catch(() => ({}))) as {
        token?: string;
        email?: string;
        error?: string;
      };
      if (!r.ok || typeof data.token !== "string" || typeof data.email !== "string") {
        return { ok: false as const, error: data.error ?? `Erreur ${r.status}` };
      }
      applySessionToken(data.token, data.email);
      return { ok: true as const };
    },
    [applySessionToken],
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
