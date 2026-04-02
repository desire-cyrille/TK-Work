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
  decodeAuthTokenClaims,
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
  role: "USER" | "ADMIN";
  isAdmin: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  signup: (email: string, password: string) => Promise<AuthActionResult>;
  logout: () => void;
  applySessionToken: (token: string, email: string) => void;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ) => Promise<ProfileUpdateResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readInitialSession(): {
  auth: boolean;
  email: string;
  role: "USER" | "ADMIN";
  mustChangePassword: boolean;
} {
  const t = getAuthToken();
  if (!t || isAuthTokenExpired(t)) {
    if (t) clearAuthSession();
    return {
      auth: false,
      email: "",
      role: "USER",
      mustChangePassword: false,
    };
  }
  const claims = decodeAuthTokenClaims(t);
  const email = getAuthEmail() ?? claims?.email ?? "";
  return {
    auth: true,
    email,
    role: claims?.role ?? "USER",
    mustChangePassword: claims?.mustChangePassword ?? false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const init = readInitialSession();
  const [isAuthenticated, setAuth] = useState(init.auth);
  const [profileEmail, setProfileEmail] = useState(init.email);
  const [role, setRole] = useState<"USER" | "ADMIN">(init.role);
  const [mustChangePassword, setMustChangePassword] = useState(
    init.mustChangePassword,
  );

  const applySessionToken = useCallback((token: string, email: string) => {
    setAuthSession(token, email);
    const c = decodeAuthTokenClaims(token);
    setAuth(true);
    setProfileEmail(email.trim().toLowerCase());
    setRole(c?.role ?? "USER");
    setMustChangePassword(c?.mustChangePassword ?? false);
  }, []);

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
    applySessionToken(data.token, data.email);
    return { ok: true as const };
  }, [applySessionToken]);

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
    applySessionToken(data.token, data.email);
    return { ok: true as const };
  }, [applySessionToken]);

  const logout = useCallback(() => {
    clearAuthSession();
    setAuth(false);
    setProfileEmail("");
    setRole("USER");
    setMustChangePassword(false);
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
      const errBody = (await r.json().catch(() => ({}))) as {
        error?: string;
        token?: string;
        mustChangePassword?: boolean;
      };
      if (!r.ok) {
        return {
          ok: false,
          error: errBody.error ?? `Erreur ${r.status}`,
        };
      }
      if (typeof errBody.token === "string") {
        const em = getAuthEmail();
        if (em) setAuthSession(errBody.token, em);
        const c = decodeAuthTokenClaims(errBody.token);
        setRole(c?.role ?? "USER");
        setMustChangePassword(false);
      }
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
