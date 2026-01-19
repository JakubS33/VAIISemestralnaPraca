import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionPayload } from "@/lib/auth";

/**
 * Server-side guard for admin API routes.
 * - verifies JWT
 * - verifies that the user still exists in DB
 * - verifies role == ADMIN
 */
export async function requireAdminUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const sess = verifySessionPayload(token);
  if (!sess || sess.role !== "ADMIN") return null;

  // DB check (in case role changed or user deleted)
  const u = await prisma.user.findUnique({ where: { id: sess.userId }, select: { id: true, role: true } });
  if (!u || u.role !== "ADMIN") return null;

  return u.id;
}
