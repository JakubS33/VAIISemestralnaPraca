import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/*
  AI generated:
*/
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

  // ✅ correct endpoint
  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", symbols.join(","));
  url.searchParams.set("apikey", apiKey);

  const r = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
  });

  const json = await r.json().catch(() => null);

  // ✅ ak TwelveData vracia error, uvidíš to v konzole (server log)
  if (!r.ok || (json && typeof json === "object" && (json as any).status === "error")) {
    console.error("[twelvedata] error", {
      status: r.status,
      body: json,
      url: url.toString().slice(0, 200) + "...",
    });
    return map;
  }

  const getPrice = (row: any) => {
    const raw = row?.close ?? row?.price ?? row?.last ?? row?.previous_close;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };

  // Formát 1: single
  if (json && typeof json === "object" && "symbol" in (json as any)) {
    const sym = String((json as any).symbol);
    const p = getPrice(json);
    if (p !== null) map.set(sym, p);
    void vs;
    return map;
  }

  // Formát 2: batch map { AAPL: {...}, MSFT: {...} }
  if (json && typeof json === "object") {
    for (const sym of symbols) {
      const row = (json as any)[sym];
      if (!row) continue;
      const p = getPrice(row);
      if (p !== null) map.set(sym, p);
    }
  }

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

  
  return NextResponse.json({ vs, results });
}
