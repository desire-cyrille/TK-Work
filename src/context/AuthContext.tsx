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
  readAuthSessionFromStorage,
  setAuthSession,
  type AuthSessionSnapshot,
} from "../lib/authToken";
import { cloudPush } from "../lib/cloudSync";

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type ProfileUpdateResult =
  | { ok: true }
  | { ok: false; error: string };

type AuthContextValue = AuthSessionSnapshot & {
  /** false tant que la session serveur n’a pas été vérifiée (évite les redirections instables). */
  authReady: boolean;
  isAdmin: boolean;
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

const initialSession = readAuthSessionFromStorage();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profileEmail, setProfileEmail] = useState(initialSession.profileEmail);
  const [role, setRole] = useState<"USER" | "ADMIN">(initialSession.role);
  const [mustChangePassword, setMustChangePassword] = useState(
    initialSession.mustChangePassword,
  );
  const [isAuthenticated, setIsAuthenticated] = useState(
    initialSession.isAuthenticated,
  );
  const [authReady, setAuthReady] = useState(!initialSession.isAuthenticated);

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
        const claims = decodeAuthTokenClaims(tok);
        if (claims) {
          setIsAuthenticated(true);
          setProfileEmail(claims.email);
          setRole(claims.role);
          setMustChangePassword(claims.mustChangePassword);
        }
      } catch {
        const claims = decodeAuthTokenClaims(tok);
        if (!cancelled && claims) {
          setIsAuthenticated(true);
          setProfileEmail(claims.email);
          setRole(claims.role);
          setMustChangePassword(claims.mustChangePassword);
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
