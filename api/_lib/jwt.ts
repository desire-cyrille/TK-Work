import * as jose from "jose";

const ALG = "HS256";

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET doit faire au moins 32 caractères.");
  }
  return new TextEncoder().encode(s);
}

export async function signSessionToken(userId: string, email: string): Promise<string> {
  const secret = getSecret();
  return new jose.SignJWT({ email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("60d")
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: string; email: string }> {
  const secret = getSecret();
  const { payload } = await jose.jwtVerify(token, secret, { algorithms: [ALG] });
  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== "string" || !sub) {
    throw new Error("Token invalide (sub).");
  }
  if (typeof email !== "string" || !email) {
    throw new Error("Token invalide (email).");
  }
  return { userId: sub, email };
}
