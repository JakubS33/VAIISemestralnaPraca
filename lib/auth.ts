import jwt from "jsonwebtoken";

export const SESSION_COOKIE_NAME = "vaji_session";

type TokenPayload = { userId: string };

export function signSessionToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return jwt.sign({ userId } satisfies TokenPayload, secret, { expiresIn: "7d" });
}

export function verifySessionToken(token: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  try {
    const payload = jwt.verify(token, secret) as TokenPayload;
    return payload.userId ?? null;
  } catch {
    return null;
  }
}
