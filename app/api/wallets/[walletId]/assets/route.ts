import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionPayload } from "@/lib/auth";
import { WalletAssetKind } from "@prisma/client";
import { createWalletSnapshot } from "@/lib/walletSnapshots";

type Ctx = { params: Promise<{ walletId: string }> };

async function getUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const sess = verifySessionPayload(token);
  if (!sess) return null;
  if (sess.role === "ADMIN") return "__FORBIDDEN_ADMIN__";
  return sess.userId;
}

function parseKind(url: string): WalletAssetKind {
  const u = new URL(url);
  const k = u.searchParams.get("kind");
  return k === "OTHER" ? "OTHER" : "MAIN";
}

export async function GET(req: Request, ctx: Ctx) {
  const { walletId } = await ctx.params;

  const userId = await getUserId();
  if (userId === "__FORBIDDEN_ADMIN__") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    select: {
      id: true,
      walletId: true,
      kind: true,
      name: true,
      amount: true,
      value: true,
      createdAt: true,
      updatedAt: true,
      assetId: true,
      asset: {
        select: {
          id: true,
          type: true,
          symbol: true,
          name: true,
          provider: true,
          apiId: true,
          exchange: true,
        },
      },
    },
  });

  return NextResponse.json(items);
}

export async function POST(req: Request, ctx: Ctx) {
  const { walletId } = await ctx.params;

  const userId = await getUserId();
  if (userId === "__FORBIDDEN_ADMIN__") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    select: { id: true, currency: true },
  });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const kind = (body?.kind === "OTHER" ? "OTHER" : "MAIN") as WalletAssetKind;

  if (kind === "MAIN") {
  const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";
  const amountNum = Number(body?.amount);
  const pricePerUnitNum = Number(body?.pricePerUnit);

  if (!assetId) return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(pricePerUnitNum) || pricePerUnitNum <= 0) {
    return NextResponse.json({ error: "Purchase price must be a positive number" }, { status: 400 });
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, symbol: true, name: true, type: true, provider: true, apiId: true },
  });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (!asset.apiId || asset.provider === "MANUAL") {
    return NextResponse.json({ error: "Asset is not price-enabled" }, { status: 400 });
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Merge behavior: if the same asset already exists in wallet -> add to amount.
    const existing = await tx.walletAsset.findFirst({
      where: { walletId, kind: "MAIN", assetId: asset.id },
      select: { id: true, amount: true },
    });

    const updatedOrCreated = existing
      ? await tx.walletAsset.update({
          where: { id: existing.id },
          data: {
            amount: (Number(existing.amount ?? "0") + amountNum).toString(),
            name: asset.symbol,
          },
          select: {
            id: true,
            walletId: true,
            kind: true,
            name: true,
            amount: true,
            value: true,
            assetId: true,
            asset: {
              select: { id: true, type: true, symbol: true, name: true, provider: true, apiId: true, exchange: true },
            },
          },
        })
      : await tx.walletAsset.create({
          data: {
            walletId,
            kind: "MAIN",
            name: asset.symbol,
            assetId: asset.id,
            amount: amountNum.toString(),
            value: "0",
          },
          select: {
            id: true,
            walletId: true,
            kind: true,
            name: true,
            amount: true,
            value: true,
            assetId: true,
            asset: {
              select: { id: true, type: true, symbol: true, name: true, provider: true, apiId: true, exchange: true },
            },
          },
        });

    // ✅ Create BUY transaction
    await tx.transaction.create({
      data: {
        walletId,
        assetId: asset.id,
        quantity: amountNum.toString(),
        pricePerUnit: pricePerUnitNum.toString(),
        type: "BUY",
        date: now,
        note: "Add asset",
      },
      select: { id: true }, // nemusíš vracať celý objekt
    });

    return updatedOrCreated;
  });

  // After a BUY transaction is created, store a wallet value snapshot based on live prices.
  // This is used by the wallet value chart.
  try {
    await createWalletSnapshot(walletId, "TX_ADD");
  } catch (e) {
    console.error("[snapshot] TX_ADD failed", e);
  }

  // zachováme pôvodné response správanie (updated = 200, created = 201 by bolo fajn,
  // ale kvôli jednoduchosti vraciame 200)
  return NextResponse.json(result, { status: 200 });
}


  // OTHER
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const valueNum = Number(body?.value);
  if (name.length < 2) return NextResponse.json({ error: "Názov je povinný" }, { status: 400 });
  if (!Number.isFinite(valueNum)) return NextResponse.json({ error: "Neplatná hodnota value" }, { status: 400 });

  const created = await prisma.walletAsset.create({
    data: {
      walletId,
      kind: "OTHER",
      name,
      amount: null,
      value: valueNum.toString(),
      assetId: null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { walletId } = await ctx.params;

  const userId = await getUserId();
  if (userId === "__FORBIDDEN_ADMIN__") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
