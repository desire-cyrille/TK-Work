/** Jeton JWT (connexion + API sync). Les données métier sont partagées (workspace unique sur le serveur). */

export type AuthTokenClaims = {
  email: string;
  role: "USER" | "ADMIN";
  mustChangePassword: boolean;
};

export function decodeAuthTokenClaims(token: string): AuthTokenClaims | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const json = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as {
      email?: string;
      role?: string;
      mcp?: boolean;
    };
    if (typeof json.email !== "string" || !json.email) return null;
    return {
      email: json.email,
      role: json.role === "ADMIN" ? "ADMIN" : "USER",
      mustChangePassword: json.mcp === true,
    };
  } catch {
    return null;
  }
}

export const AUTH_TOKEN_KEY = "tk_gestion_auth_token";
export const AUTH_EMAIL_KEY = "tk_gestion_auth_email";

const LEGACY_SESSION = "tk_gestion_session";
const LEGACY_CLOUD_TOKEN = "tk_gestion_cloud_token";
const LEGACY_CLOUD_EMAIL = "tk_gestion_cloud_email";

export function isAuthTokenExpired(token: string): boolean {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return true;
    const json = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    if (typeof json.exp !== "number") return false;
    return Date.now() >= json.exp * 1000 - 30_000;
  } catch {
    return true;
  }
}

export function getAuthToken(): string | null {
  try {
    let t = localStorage.getItem(AUTH_TOKEN_KEY);
    if (t) return t;
    const legacy = localStorage.getItem(LEGACY_CLOUD_TOKEN);
    if (legacy) {
      localStorage.setItem(AUTH_TOKEN_KEY, legacy);
      const em = localStorage.getItem(LEGACY_CLOUD_EMAIL);
      if (em) localStorage.setItem(AUTH_EMAIL_KEY, em);
      localStorage.removeItem(LEGACY_CLOUD_TOKEN);
      localStorage.removeItem(LEGACY_CLOUD_EMAIL);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function getAuthEmail(): string | null {
  try {
    return localStorage.getItem(AUTH_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, email: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_EMAIL_KEY, email.trim().toLowerCase());
  localStorage.removeItem(LEGACY_SESSION);
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EMAIL_KEY);
  localStorage.removeItem(LEGACY_SESSION);
  localStorage.removeItem(LEGACY_CLOUD_TOKEN);
  localStorage.removeItem(LEGACY_CLOUD_EMAIL);
}
