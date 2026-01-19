export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { requireAdminUserId } from "@/lib/admin";

type Ctx = { params: Promise<{ userId: string }> };

function safeTrim(v: unknown) {
  return (v ?? "").toString().trim();
}

// PATCH /api/admin/users/:userId
// body: { email?: string, role?: "USER"|"ADMIN", password?: string }
export async function PATCH(req: Request, ctx: Ctx) {
  const adminId = await requireAdminUserId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await ctx.params;
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  // nech admin omylom nevymaže/nezmení sám seba na USER
  if (userId === adminId) {
    return NextResponse.json({ error: "You can't modify your own admin account via this endpoint." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as any));
  const email = safeTrim(body.email).toLowerCase();
  const role = body.role === "ADMIN" ? "ADMIN" : body.role === "USER" ? "USER" : undefined;
  const password = (body.password ?? "").toString();

  const data: any = {};

  if (email) {
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    data.email = email;
  }

  if (role) data.role = role;

  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must have at least 6 characters." }, { status: 400 });
    }
    data.password = await bcrypt.hash(password, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, role: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    // unique constraint on email
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 400 });
  }
}

// DELETE /api/admin/users/:userId
export async function DELETE(_req: Request, ctx: Ctx) {
  const adminId = await requireAdminUserId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await ctx.params;
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  if (userId === adminId) {
    return NextResponse.json({ error: "You can't delete your own admin account." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}
