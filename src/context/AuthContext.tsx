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
  getValidAuthToken,
  setAuthSession,
} from "../lib/authToken";
import { cloudPush } from "../lib/cloudSync";

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
  /** false tant que la session serveur n’a pas été vérifiée (routes protégées). */
  authReady: boolean;
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

const pendingTokenOnBoot = getValidAuthToken() !== null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profileEmail, setProfileEmail] = useState(
    getAuthEmail() ?? "admin@local",
  );
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  /** Ne jamais présumer connecté avant validation serveur (évite les boucles Chrome). */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(!pendingTokenOnBoot);

  useEffect(() => {
    const tok = getValidAuthToken();
    if (!tok) {
      setIsAuthenticated(false);
      setRole("USER");
      setMustChangePassword(false);
      setProfileEmail(getAuthEmail() ?? "admin@local");
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/auth/session", {
          headers: { Authorization: `Bearer ${tok}` },
          cache: "no-store",
        });
        if (cancelled) return;
        if (r.status === 401) {
          clearAuthSession();
          setIsAuthenticated(false);
          setRole("USER");
          setMustChangePassword(false);
          setProfileEmail(getAuthEmail() ?? "admin@local");
          return;
        }
        if (r.ok) {
          const data = (await r.json().catch(() => ({}))) as {
            email?: string;
            role?: string;
            mustChangePassword?: boolean;
          };
          if (typeof data.email === "string" && data.email) {
            setProfileEmail(data.email);
          }
          setRole(data.role === "ADMIN" ? "ADMIN" : "USER");
          setMustChangePassword(data.mustChangePassword === true);
          setIsAuthenticated(true);
          return;
        }
        /* Session non confirmée (404 réseau, 503…) : rester sur la page connexion. */
        clearAuthSession();
        setIsAuthenticated(false);
      } catch {
        if (!cancelled) {
          clearAuthSession();
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const applySessionToken = useCallback((token: string, email: string) => {
    setAuthSession(token, email);
    setProfileEmail(email.trim().toLowerCase());
    const claims = decodeAuthTokenClaims(token);
    setRole(claims?.role ?? "USER");
    setMustChangePassword(claims?.mustChangePassword ?? false);
    setIsAuthenticated(true);
    setAuthReady(true);
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
    if (getValidAuthToken()) {
      try {
        await cloudPush();
      } catch {
        /* ignore — déconnexion locale quand même */
      }
    }
    clearAuthSession();
    setProfileEmail("admin@local");
    setRole("USER");
    setMustChangePassword(false);
    setIsAuthenticated(false);
    setAuthReady(true);
  }, []);

  const updatePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
      confirmNewPassword: string,
    ): Promise<ProfileUpdateResult> => {
      const tok = getValidAuthToken();
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
      authReady,
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
      authReady,
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
