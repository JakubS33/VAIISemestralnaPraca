import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/**
 * Použiteľné v route handlers (GET/PATCH/DELETE).
 * Vracia userId alebo null.
 */
export async function getUserIdFromRequest(_req: Request): Promise<string | null> {
  // v Next 16 je cookies() async, ale v route handleroch môžeš použiť cookies() sync alebo async podľa verzie.
  // Tu spravíme kompatibilne: skúsiť sync, ak by bolo treba, ľahko prepneš na await.
  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}
