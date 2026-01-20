import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionPayload } from "@/lib/auth";
import { createWalletSnapshot } from "@/lib/walletSnapshots";
import { TransactionType } from "@prisma/client";

async function getUserIdOr401() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const sess = verifySessionPayload(token);
  if (!sess) return null;
  if (sess.role === "ADMIN") return "__FORBIDDEN_ADMIN__";
  return sess.userId;
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(req: Request, ctx: { params: Promise<{ walletId: string }> }) {
  const userId = await getUserIdOr401();
  if (userId === "__FORBIDDEN_ADMIN__") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

// CREATE – POST /api/wallets/[walletId]/transactions
export async function POST(req: Request, ctx: { params: Promise<{ walletId: string }> }) {
  const userId = await getUserIdOr401();
  if (userId === "__FORBIDDEN_ADMIN__") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { walletId } = await ctx.params;

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    select: { id: true },
  });
  if (!wallet) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const typeRaw = body.type;
  const type =
    typeof typeRaw === "string" && (Object.values(TransactionType) as string[]).includes(typeRaw)
      ? (typeRaw as TransactionType)
      : null;

  const assetId = typeof body.assetId === "string" ? body.assetId : null;
  const quantity = safeNum(body.quantity);
  const pricePerUnit = safeNum(body.pricePerUnit);

  const date = body.date ? new Date(body.date) : new Date();

  if (!type) {
    return NextResponse.json({ error: "Invalid type", allowed: Object.values(TransactionType) }, { status: 400 });
  }
  if (!assetId) {
    return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be > 0" }, { status: 400 });
  }
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    return NextResponse.json({ error: "Price per unit must be > 0" }, { status: 400 });
  }
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  // ensure asset exists
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const created = await prisma.transaction.create({
    data: {
      walletId,
      type,
      date,
      assetId,
      quantity: quantity.toString(),
      pricePerUnit: pricePerUnit.toString(),
    },
    select: { id: true },
  });

  // After creating a transaction, store a new wallet snapshot.
  try {
    await createWalletSnapshot(walletId, "TX_ADD");
  } catch (e) {
    console.error("[snapshot] TX_CREATE failed", e);
  }

  return NextResponse.json(created, { status: 201 });
}

// UPDATE – PUT /api/wallets/[walletId]/transactions?id=...
export async function PUT(req: Request, ctx: { params: Promise<{ walletId: string }> }) {
  const userId = await getUserIdOr401();
  if (userId === "__FORBIDDEN_ADMIN__") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  try {
    await createWalletSnapshot(walletId, "TX_EDIT");
  } catch (e) {
    console.error("[snapshot] TX_EDIT failed", e);
  }

  return NextResponse.json(updated);
}

// DELETE – DELETE /api/wallets/[walletId]/transactions?id=...
export async function DELETE(req: Request, ctx: { params: Promise<{ walletId: string }> }) {
  const userId = await getUserIdOr401();
  if (userId === "__FORBIDDEN_ADMIN__") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  try {
    await createWalletSnapshot(walletId, "TX_DELETE");
  } catch (e) {
    console.error("[snapshot] TX_DELETE failed", e);
  }

  return NextResponse.json({ ok: true });
}
