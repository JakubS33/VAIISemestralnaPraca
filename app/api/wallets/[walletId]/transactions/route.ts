import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

async function getUserIdOr401() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(req: Request, ctx: { params: Promise<{ walletId: string }> }) {
  const userId = await getUserIdOr401();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { walletId } = await ctx.params;

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    select: { id: true },
  });
  if (!wallet) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const txs = await prisma.transaction.findMany({
    where: { walletId },
    orderBy: { date: "asc" },
    select: {
      id: true,
      type: true,
      date: true,
      quantity: true,
      pricePerUnit: true,
      assetId: true,
      asset: { select: { symbol: true, name: true, type: true } },
    },
  });

  return NextResponse.json(txs);
}
// UPDATE – PUT /api/wallets/[walletId]/transactions?id=...
export async function PUT(req: Request, ctx: { params: Promise<{ walletId: string }> }) {
  const userId = await getUserIdOr401();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { walletId } = await ctx.params;

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId }, select: { id: true } });
  if (!wallet) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const quantity = safeNum(body.quantity);
  const pricePerUnit = safeNum(body.pricePerUnit);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be > 0" }, { status: 400 });
  }
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    return NextResponse.json({ error: "Price per unit must be > 0" }, { status: 400 });
  }

  const txRow = await prisma.transaction.findFirst({
    where: { id, walletId },
    select: { id: true },
  });
  if (!txRow) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const updated = await prisma.transaction.update({
    where: { id },
    data: { quantity: quantity.toString(), pricePerUnit: pricePerUnit.toString() },
    select: { id: true },
  });

  return NextResponse.json(updated);
}

// DELETE – DELETE /api/wallets/[walletId]/transactions?id=...
export async function DELETE(req: Request, ctx: { params: Promise<{ walletId: string }> }) {
  const userId = await getUserIdOr401();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { walletId } = await ctx.params;

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId }, select: { id: true } });
  if (!wallet) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const txRow = await prisma.transaction.findFirst({
    where: { id, walletId },
    select: { id: true },
  });
  if (!txRow) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}