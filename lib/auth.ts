import jwt from "jsonwebtoken";

export const SESSION_COOKIE_NAME = "vaji_session";

export type Role = "USER" | "ADMIN";

type TokenPayload = { userId: string; role: Role };

export function signSessionToken(userId: string, role: Role): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return jwt.sign({ userId, role } satisfies TokenPayload, secret, { expiresIn: "7d" });
}

/** Backwards-compatible: returns only userId. */
export function verifySessionToken(token: string): string | null {
  const payload = verifySessionPayload(token);
  return payload?.userId ?? null;
}

export function verifySessionPayload(token: string): TokenPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  try {
    const payload = jwt.verify(token, secret) as TokenPayload;
    if (!payload?.userId) return null;
    // Default to USER for older tokens that didn't include role
    return {
      userId: payload.userId,
      role: (payload as any).role === "ADMIN" ? "ADMIN" : "USER",
    };
  } catch {
    return null;
  }
}
