import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type VsCurrency = "eur" | "usd";

type PriceResult = {
  assetId: string;
  vs: VsCurrency;
  price: number;
  source: "coingecko" | "twelvedata";
};

function asVsCurrency(v: string | null): VsCurrency {
  const x = (v ?? "eur").toLowerCase();
  return x === "usd" ? "usd" : "eur";
}

function splitCsv(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

async function fetchCoinGeckoSimplePrice(ids: string[], vs: VsCurrency): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("vs_currencies", vs);

  const r = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    // cache on server for 60s to protect rate limits
    next: { revalidate: 60 },
  });

  if (!r.ok) return map;

  const json = (await r.json()) as Record<string, Record<string, number>>;
  for (const id of ids) {
    const price = json?.[id]?.[vs];
    if (typeof price === "number") map.set(id, price);
  }
  return map;
}

async function fetchTwelveDataQuote(symbols: string[], vs: VsCurrency): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (symbols.length === 0) return map;

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return map;

  // Twelve Data free plan has limits; we keep it simple: one request with comma-separated symbols.
  // If their API returns only one symbol per call, user can reduce the list or adjust.
  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", symbols.join(","));
  url.searchParams.set("apikey", apiKey);

  const r = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!r.ok) return map;

  const json = await r.json();

  // Common formats:
  // 1) single quote: { symbol: "AAPL", close: "..." }
  // 2) batch: { data: [ { symbol: "AAPL", close: "..." }, ... ] }
  // 3) batch map: { AAPL: { close: "..." }, MSFT: { close: "..." } }
  const push = (sym: string, raw: any) => {
    const v = Number(raw);
    if (Number.isFinite(v)) map.set(sym, v);
  };

  if (json && typeof json === "object" && "symbol" in json) {
    push(String((json as any).symbol), (json as any).close ?? (json as any).price ?? (json as any).last);
  } else if (json && typeof json === "object" && Array.isArray((json as any).data)) {
    for (const row of (json as any).data) {
      if (!row) continue;
      push(String(row.symbol), row.close ?? row.price ?? row.last);
    }
  } else if (json && typeof json === "object") {
    for (const sym of symbols) {
      const row = (json as any)[sym];
      if (!row) continue;
      push(sym, row.close ?? row.price ?? row.last);
    }
  }

  // NOTE: TwelveData typically returns prices in the instrument currency (often USD).
  // For this project we assume wallets are EUR or USD and show the quote as-is.
  // If you later want strict conversion, you can add FX endpoint here.
  void vs;
  return map;
}

// GET /api/prices?assetIds=id1,id2&vs=eur
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vs = asVsCurrency(searchParams.get("vs"));

  const assetIds = splitCsv(searchParams.get("assetIds"));
  const single = searchParams.get("assetId");
  const ids = [...new Set([...(single ? [single] : []), ...assetIds])].filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Missing assetId(s)" }, { status: 400 });
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: ids } },
    select: { id: true, type: true, provider: true, apiId: true },
  });

  const byId = new Map(assets.map((a) => [a.id, a] as const));
  const cgIds: { assetId: string; apiId: string }[] = [];
  const tdSyms: { assetId: string; apiId: string }[] = [];

  for (const id of ids) {
    const a = byId.get(id);
    if (!a || !a.apiId) continue;
    if (a.provider === "COINGECKO" && a.type === "CRYPTO") cgIds.push({ assetId: a.id, apiId: a.apiId });
    if (a.provider === "TWELVEDATA" && (a.type === "STOCK" || a.type === "ETF")) tdSyms.push({ assetId: a.id, apiId: a.apiId });
  }

  const [cgMap, tdMap] = await Promise.all([
    fetchCoinGeckoSimplePrice(cgIds.map((x) => x.apiId), vs),
    fetchTwelveDataQuote(tdSyms.map((x) => x.apiId), vs),
  ]);

  const results: PriceResult[] = [];

  for (const x of cgIds) {
    const p = cgMap.get(x.apiId);
    if (typeof p === "number") results.push({ assetId: x.assetId, vs, price: p, source: "coingecko" });
  }
  for (const x of tdSyms) {
    const p = tdMap.get(x.apiId);
    if (typeof p === "number") results.push({ assetId: x.assetId, vs, price: p, source: "twelvedata" });
  }

  // Response is a list for simplicity (easy to map by assetId client-side)
  return NextResponse.json({ vs, results });
}
