import * as jose from "jose";

const ALG = "HS256";

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET doit faire au moins 32 caractères.");
  }
  return new TextEncoder().encode(s);
}

export type SessionClaims = {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  mustChangePassword: boolean;
};

export async function signSessionToken(
  userId: string,
  email: string,
  role: "USER" | "ADMIN",
  mustChangePassword: boolean,
): Promise<string> {
  const secret = getSecret();
  return new jose.SignJWT({
    email,
    role,
    mcp: mustChangePassword,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("60d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionClaims> {
  const secret = getSecret();
  const { payload } = await jose.jwtVerify(token, secret, { algorithms: [ALG] });
  const sub = payload.sub;
  const email = payload.email;
  const roleRaw = payload.role;
  const mcp = payload.mcp;
  if (typeof sub !== "string" || !sub) {
    throw new Error("Token invalide (sub).");
  }
  if (typeof email !== "string" || !email) {
    throw new Error("Token invalide (email).");
  }
  const role: "USER" | "ADMIN" = roleRaw === "ADMIN" ? "ADMIN" : "USER";
  return {
    userId: sub,
    email,
    role,
    mustChangePassword: mcp === true,
  };
}
