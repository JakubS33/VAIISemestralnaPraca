import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AssetKind = "main" | "other";

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

// GET /api/assets?walletId=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const walletId = searchParams.get("walletId");

  if (!walletId) {
    return NextResponse.json({ error: "Missing walletId" }, { status: 400 });
  }

  const data = await prisma.walletAsset.findMany({
    where: { walletId },
    orderBy: { createdAt: "desc" },
  });

  const out = data.map((a) => ({
    id: a.id,
    walletId: a.walletId,
    kind: a.kind === "MAIN" ? "main" : "other",
    name: a.name,
    amount: a.amount ? Number(a.amount) : undefined,
    value: Number(a.value),
  }));

  return NextResponse.json(out);
}

// POST /api/assets
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const walletId = (body.walletId ?? "").toString().trim();
  const kind: AssetKind = body.kind === "main" ? "main" : "other";
  const name = (body.name ?? "").toString().trim();
  const rawAmount = body.amount;
  const rawValue = body.value;

  if (!walletId) {
    return NextResponse.json({ error: "Missing walletId" }, { status: 400 });
  }

  const walletExists = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!walletExists) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "Name must have at least 2 characters." },
      { status: 400 }
    );
  }

  const value = parseNumber(rawValue);
  if (value === null) {
    return NextResponse.json({ error: "Value must be a valid number." }, { status: 400 });
  }

  let amount: number | null = null;
  if (kind === "main") {
    const parsedAmount = parseNumber(rawAmount);
    if (parsedAmount === null || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number for main assets." },
        { status: 400 }
      );
    }
    amount = parsedAmount;
  }

  const created = await prisma.walletAsset.create({
    data: {
      walletId,
      kind: kind === "main" ? "MAIN" : "OTHER",
      name,
      amount,
      value,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      walletId: created.walletId,
      kind: created.kind === "MAIN" ? "main" : "other",
      name: created.name,
      amount: created.amount ? Number(created.amount) : undefined,
      value: Number(created.value),
    },
    { status: 201 }
  );
}

// PUT /api/assets?id=...
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as any));
  const name = (body.name ?? "").toString().trim();
  const rawAmount = body.amount;
  const rawValue = body.value;

  const existing = await prisma.walletAsset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "Name must have at least 2 characters." },
      { status: 400 }
    );
  }

  const value = parseNumber(rawValue);
  if (value === null) {
    return NextResponse.json({ error: "Value must be a valid number." }, { status: 400 });
  }

  let amount: number | null = existing.amount ? Number(existing.amount) : null;

  if (existing.kind === "MAIN") {
    const parsedAmount = parseNumber(rawAmount);
    if (parsedAmount === null || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number for main assets." },
        { status: 400 }
      );
    }
    amount = parsedAmount;
  } else {
    amount = null;
  }

  const updated = await prisma.walletAsset.update({
    where: { id },
    data: { name, value, amount },
  });

  return NextResponse.json({
    id: updated.id,
    walletId: updated.walletId,
    kind: updated.kind === "MAIN" ? "main" : "other",
    name: updated.name,
    amount: updated.amount ? Number(updated.amount) : undefined,
    value: Number(updated.value),
  });
}

// DELETE /api/assets?id=...
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await prisma.walletAsset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
}
