import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { WalletAssetKind } from "@prisma/client";

type Ctx = { params: Promise<{ walletId: string }> };

async function getUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

function parseKind(url: string): WalletAssetKind {
  const u = new URL(url);
  const k = u.searchParams.get("kind");
  return k === "OTHER" ? "OTHER" : "MAIN";
}

export async function GET(req: Request, ctx: Ctx) {
  const { walletId } = await ctx.params;

  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    select: { id: true },
  });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const kind = parseKind(req.url);

  const items = await prisma.walletAsset.findMany({
    where: { walletId, kind },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: Request, ctx: Ctx) {
  const { walletId } = await ctx.params;

  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    select: { id: true, currency: true },
  });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const kind = (body?.kind === "OTHER" ? "OTHER" : "MAIN") as WalletAssetKind;
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  const amountRaw = body?.amount;
  const valueRaw = body?.value;

  const amountNum = amountRaw === null || amountRaw === undefined ? null : Number(amountRaw);
  const valueNum = Number(valueRaw);

  if (name.length < 2) return NextResponse.json({ error: "Názov je povinný" }, { status: 400 });
  if (!Number.isFinite(valueNum)) return NextResponse.json({ error: "Neplatná hodnota value" }, { status: 400 });

  if (kind === "MAIN") {
    if (amountNum === null || !Number.isFinite(amountNum)) {
      return NextResponse.json({ error: "Pre MAIN musíš zadať amount" }, { status: 400 });
    }
  }

  const created = await prisma.walletAsset.create({
    data: {
      walletId,
      kind,
      name,
      amount: kind === "MAIN" ? amountNum!.toString() : null,
      value: valueNum.toString(),
    },
  });

  return NextResponse.json(created);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { walletId } = await ctx.params;

  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    select: { id: true },
  });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const item = await prisma.walletAsset.findFirst({
    where: { id, walletId },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  await prisma.walletAsset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
