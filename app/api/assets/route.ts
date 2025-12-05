// app/api/assets/route.ts
import { NextResponse } from "next/server";

type AssetKind = "main" | "other";

interface Asset {
  id: string;
  walletId: string;
  kind: AssetKind;
  name: string;
  amount?: number; // iba pre main assets
  value: number;   // hodnota v mene danej peňaženky (môže byť záporná pri other)
}

let assets: Asset[] = [];
let nextAssetId = 1;

// Pomocná funkcia – parsovanie čísla z requestu
function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

// GET /api/assets?walletId=123
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const walletId = searchParams.get("walletId");

  if (!walletId) {
    return NextResponse.json(
      { error: "Missing walletId" },
      { status: 400 }
    );
  }

  const walletAssets = assets.filter((a) => a.walletId === walletId);
  return NextResponse.json(walletAssets);
}

// POST /api/assets  – vytvorenie assetu
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const walletId = (body.walletId ?? "").toString().trim();
  const kind: AssetKind = body.kind === "main" ? "main" : "other";
  const name = (body.name ?? "").toString().trim();
  const rawAmount = body.amount;
  const rawValue = body.value;

  if (!walletId) {
    return NextResponse.json(
      { error: "Missing walletId" },
      { status: 400 }
    );
  }

  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "Name must have at least 2 characters." },
      { status: 400 }
    );
  }

  const value = parseNumber(rawValue);
  if (value === null) {
    return NextResponse.json(
      { error: "Value must be a valid number." },
      { status: 400 }
    );
  }

  let amount: number | undefined = undefined;
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

  const newAsset: Asset = {
    id: String(nextAssetId++),
    walletId,
    kind,
    name,
    amount,
    value,
  };

  assets.push(newAsset);
  return NextResponse.json(newAsset, { status: 201 });
}

// PUT /api/assets?id=123 – úprava assetu
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing id" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({} as any));

  const name = (body.name ?? "").toString().trim();
  const rawAmount = body.amount;
  const rawValue = body.value;

  const index = assets.findIndex((a) => a.id === id);
  if (index === -1) {
    return NextResponse.json(
      { error: "Asset not found" },
      { status: 404 }
    );
  }

  const existing = assets[index];

  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "Name must have at least 2 characters." },
      { status: 400 }
    );
  }

  const value = parseNumber(rawValue);
  if (value === null) {
    return NextResponse.json(
      { error: "Value must be a valid number." },
      { status: 400 }
    );
  }

  let amount: number | undefined = existing.amount;
  if (existing.kind === "main") {
    const parsedAmount = parseNumber(rawAmount);
    if (parsedAmount === null || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number for main assets." },
        { status: 400 }
      );
    }
    amount = parsedAmount;
  }

  const updated: Asset = {
    ...existing,
    name,
    value,
    amount,
  };

  assets[index] = updated;
  return NextResponse.json(updated);
}

// DELETE /api/assets?id=123 – zmazanie assetu
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing id" },
      { status: 400 }
    );
  }

  const exists = assets.some((a) => a.id === id);
  if (!exists) {
    return NextResponse.json(
      { error: "Asset not found" },
      { status: 404 }
    );
  }

  assets = assets.filter((a) => a.id !== id);
  return NextResponse.json({ ok: true });
}
