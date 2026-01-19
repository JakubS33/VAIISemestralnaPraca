export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUserId } from "@/lib/admin";

// GET /api/admin/users
export async function GET() {
  const adminId = await requireAdminUserId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      wallets: { select: { id: true } },
    },
  });

  return NextResponse.json(
    users.map((u) => ({ id: u.id, email: u.email, role: u.role, walletCount: u.wallets.length }))
  );
}
