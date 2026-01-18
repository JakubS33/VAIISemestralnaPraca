import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

type Ctx = { params: Promise<{ walletId: string }> };

async function getUserId() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  const { walletId } = await ctx.params;

  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
  });

  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  return NextResponse.json(wallet);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { walletId } = await ctx.params;

  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const currency = typeof body?.currency === "string" ? body.currency.trim() : "";

  if (name.length < 3) {
    return NextResponse.json({ error: "Názov musí mať aspoň 3 znaky" }, { status: 400 });
  }
  if (!currency) {
    return NextResponse.json({ error: "Mena je povinná" }, { status: 400 });
  }

  const exists = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const updated = await prisma.wallet.update({
    where: { id: walletId },
    data: { name, currency },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { walletId } = await ctx.params;

  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exists = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  await prisma.wallet.delete({ where: { id: walletId } });
  return NextResponse.json({ ok: true });
}
