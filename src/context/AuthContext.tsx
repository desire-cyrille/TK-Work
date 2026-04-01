import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const SESSION_KEY = "tk_gestion_session";
const PROFILE_KEY = "tk_gestion_profile";

type StoredProfile = {
  email: string;
  password: string;
};

export type ProfileUpdateResult =
  | { ok: true }
  | { ok: false; error: string };

function readProfile(): StoredProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredProfile;
    if (typeof p?.email === "string" && typeof p?.password === "string") {
      return { email: p.email, password: p.password };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeProfile(p: StoredProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

function ensureProfile(): StoredProfile {
  let p = readProfile();
  if (!p) {
    p = { email: "admin@local", password: "admin" };
    writeProfile(p);
  }
  return p;
}

type AuthContextValue = {
  isAuthenticated: boolean;
  profileEmail: string;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  updateProfileCredentials: (
    email: string,
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ) => ProfileUpdateResult;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuth] = useState(() => {
    try {
      return localStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [profileEmail, setProfileEmail] = useState(() => ensureProfile().email);

  const login = useCallback((email: string, password: string) => {
    const p = ensureProfile();
    const ok =
      email.trim().toLowerCase() === p.email.trim().toLowerCase() &&
      password === p.password;
    if (!ok) return false;
    try {
      localStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setAuth(true);
    setProfileEmail(p.email);
    return true;
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setAuth(false);
  }, []);

  const updateProfileCredentials = useCallback(
    (
      email: string,
      currentPassword: string,
      newPassword: string,
      confirmNewPassword: string,
    ): ProfileUpdateResult => {
      const p = ensureProfile();
      if (currentPassword !== p.password) {
        return { ok: false, error: "Mot de passe actuel incorrect." };
      }
      const em = email.trim();
      if (!em) {
        return { ok: false, error: "L’e-mail est requis." };
      }
      let nextPassword = p.password;
      const np = newPassword.trim();
      if (np.length > 0) {
        if (np !== confirmNewPassword) {
          return {
            ok: false,
            error: "La confirmation ne correspond pas au nouveau mot de passe.",
          };
        }
        nextPassword = np;
      }
      writeProfile({ email: em, password: nextPassword });
      setProfileEmail(em);
      return { ok: true };
    },
    [],
  );

  const value = useMemo(
    () => ({
      isAuthenticated,
      profileEmail,
      login,
      logout,
      updateProfileCredentials,
    }),
    [isAuthenticated, profileEmail, login, logout, updateProfileCredentials],
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
