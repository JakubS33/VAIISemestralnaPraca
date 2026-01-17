import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type VsCurrency = "eur" | "usd";

function asVsCurrency(v: string | null): VsCurrency {
  const x = (v ?? "eur").toLowerCase();
  return x === "usd" ? "usd" : "eur";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const assetId = searchParams.get("assetId");
  if (!assetId) {
    return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  }

  const vs = asVsCurrency(searchParams.get("vs"));

  // 1) načítaj asset z DB
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, apiId: true, symbol: true, name: true, type: true },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // 2) zatiaľ podporujeme iba CRYPTO cez CoinGecko
  if (asset.type !== "CRYPTO") {
    return NextResponse.json(
      { error: `Price lookup not implemented for type ${asset.type}` },
      { status: 400 }
    );
  }

  // 3) zavolaj CoinGecko /simple/price
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", asset.apiId);
  url.searchParams.set("vs_currencies", vs);

  // Next.js server-side fetch:
  // - `revalidate` = caching na 60s (ochrana proti rate limitom, rýchlejšie)
  const r = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!r.ok) {
    return NextResponse.json(
      { error: "CoinGecko request failed", status: r.status },
      { status: 502 }
    );
  }

  const json = (await r.json()) as Record<string, Record<string, number>>;
  const price = json?.[asset.apiId]?.[vs];

  if (typeof price !== "number") {
    return NextResponse.json(
      { error: "Price not found for apiId", apiId: asset.apiId, vs },
      { status: 404 }
    );
  }

  return NextResponse.json({
    assetId: asset.id,
    apiId: asset.apiId,
    symbol: asset.symbol,
    name: asset.name,
    type: asset.type,
    vs,
    price,
    source: "coingecko",
  });
}
