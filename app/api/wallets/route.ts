// app/api/wallets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function safeTrim(v: unknown) {
  return (typeof v === "string" ? v : "").trim();
}

// READ – GET /api/wallets
export async function GET() {
  const data = await prisma.wallet.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(data);
}

// CREATE – POST /api/wallets
// Dočasne: userId berieme z body (kým nemáš auth).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const userId = safeTrim(body.userId);
  const name = safeTrim(body.name);
  const currency = safeTrim(body.currency);

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }
  if (!name || name.length < 3) {
    return NextResponse.json(
      { error: "Name must have at least 3 characters." },
      { status: 400 }
    );
  }
  if (!currency) {
    return NextResponse.json(
      { error: "Currency is required." },
      { status: 400 }
    );
  }

  const userExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!userExists) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const created = await prisma.wallet.create({
    data: { userId, name, currency },
  });

  return NextResponse.json(created, { status: 201 });
}

// UPDATE – PUT /api/wallets?id=...
export async function PUT(req: Request) {
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
    return NextResponse.json(
      { error: "Currency is required." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.wallet.update({
      where: { id },
      data: { name, currency },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }
}

// DELETE – DELETE /api/wallets?id=...
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await prisma.wallet.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }
}
