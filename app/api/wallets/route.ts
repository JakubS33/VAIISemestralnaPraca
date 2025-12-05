// app/api/wallets/route.ts
import { NextResponse } from "next/server";

interface Wallet {
  id: string;
  name: string;
  currency: string;
}

let wallets: Wallet[] = [];
let nextId = 1;

// READ – GET /api/wallets
export async function GET() {
  return NextResponse.json(wallets);
}

// CREATE – POST /api/wallets
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  const currency = (body.currency ?? "").trim();

  // SERVER-SIDE VALIDÁCIA
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

  const newWallet: Wallet = {
    id: String(nextId++),
    name,
    currency,
  };

  wallets.push(newWallet);
  return NextResponse.json(newWallet, { status: 201 });
}

// UPDATE – PUT /api/wallets?id=...
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  const currency = (body.currency ?? "").trim();

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

  const index = wallets.findIndex((w) => w.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  wallets[index] = { ...wallets[index], name, currency };
  return NextResponse.json(wallets[index]);
}

// DELETE – DELETE /api/wallets?id=...
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const exists = wallets.some((w) => w.id === id);
  if (!exists) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  wallets = wallets.filter((w) => w.id !== id);
  return NextResponse.json({ ok: true });
}
