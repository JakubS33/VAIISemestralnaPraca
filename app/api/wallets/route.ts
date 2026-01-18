import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

function safeTrim(v: unknown) {
  return (v ?? "").toString().trim();
}

async function getUserIdOr401() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const userId = verifySessionToken(token);
  return userId;
}

// READ – GET /api/wallets
export async function GET() {
  const userId = await getUserIdOr401();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallets = await prisma.wallet.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      // ak si currency ešte nemáš v modeli Wallet, daj preč
      currency: true,
      createdAt: true,
    },
  });

  return NextResponse.json(wallets);
}

// CREATE – POST /api/wallets
export async function POST(req: Request) {
  const userId = await getUserIdOr401();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const name = safeTrim(body.name);
  const currency = safeTrim(body.currency);

  if (!name || name.length < 3) {
    return NextResponse.json(
      { error: "Name must have at least 3 characters." },
      { status: 400 }
    );
  }

  if (!currency) {
    return NextResponse.json({ error: "Currency is required." }, { status: 400 });
  }

  const created = await prisma.wallet.create({
    data: { userId, name, currency },
    select: { id: true, name: true, currency: true, createdAt: true },
  });

  return NextResponse.json(created, { status: 201 });
}

// UPDATE – PUT /api/wallets?id=...
export async function PUT(req: Request) {
  const userId = await getUserIdOr401();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as any));
  const name = safeTrim(body.name);
  const currency = safeTrim(body.currency);

  if (!name || name.length < 3) {
    return NextResponse.json(
      { error: "Name must have at least 3 characters." },
      { status: 400 }
    );
  }

  if (!currency) {
    return NextResponse.json({ error: "Currency is required." }, { status: 400 });
  }

  // ✅ over vlastnictvo
  const wallet = await prisma.wallet.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!wallet) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.wallet.update({
    where: { id },
    data: { name, currency },
    select: { id: true, name: true, currency: true, createdAt: true },
  });

  return NextResponse.json(updated);
}

// DELETE – DELETE /api/wallets?id=...
export async function DELETE(req: Request) {
  const userId = await getUserIdOr401();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // ✅ over vlastnictvo
  const wallet = await prisma.wallet.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!wallet) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.wallet.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
