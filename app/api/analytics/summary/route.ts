import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionPayload } from "@/lib/auth";

type VsCurrency = "eur" | "usd";

function asVsCurrency(v: string | null): VsCurrency {
  const x = (v ?? "eur").toLowerCase();
  return x === "usd" ? "usd" : "eur";
}

function utcDayKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ------- pricing helpers (skopírované z /api/prices) -------
async function fetchCoinGeckoSimplePrice(ids: string[], vs: VsCurrency): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("vs_currencies", vs);

  const r = await fetch(url.toString(), {
    headers: { accept: "application/json" },
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

  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", symbols.join(","));
  url.searchParams.set("apikey", apiKey);

  const r = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
  });

  const json = await r.json().catch(() => null);

  if (!r.ok || (json && typeof json === "object" && (json as any).status === "error")) {
    console.error("[twelvedata] error", { status: r.status, body: json });
    return map;
  }

  const getPrice = (row: any) => {
    const raw = row?.close ?? row?.price ?? row?.last ?? row?.previous_close;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };

  // single
  if (json && typeof json === "object" && "symbol" in (json as any)) {
    const sym = String((json as any).symbol);
    const p = getPrice(json);
    if (p !== null) map.set(sym, p);
    void vs;
    return map;
  }

  // batch map
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

async function getUserIdOr401() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const sess = verifySessionPayload(token);
  if (!sess) return null;
  if (sess.role === "ADMIN") return "__FORBIDDEN_ADMIN__";
  return sess.userId;
}

export async function GET(req: Request) {
  const userId = await getUserIdOr401();
  if (userId === "__FORBIDDEN_ADMIN__") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const vs = asVsCurrency(searchParams.get("vs"));

  // 1) wallets usera
  const wallets = await prisma.wallet.findMany({
    where: { userId },
    select: { id: true, currency: true },
  });

  if (wallets.length === 0) {
    return NextResponse.json({
      vs,
      currentTotalValue: 0,
      overallPL: 0,
      allocation: [
        { name: "Crypto", value: 0 },
        { name: "Stocks", value: 0 },
        { name: "ETFs", value: 0 },
        { name: "Other", value: 0 },
      ],
      timeSeries: [],
    });
  }

  const walletIds = wallets.map((w) => w.id);

  // 2) transactions (MAIN assets)
  const txs = await prisma.transaction.findMany({
    where: { walletId: { in: walletIds } },
    select: {
      type: true,
      quantity: true,
      pricePerUnit: true,
      assetId: true,
      date: true,
    },
  });

  // 3) OTHER assets (savings, debt…)
  const otherAssets = await prisma.walletAsset.findMany({
    where: { walletId: { in: walletIds }, kind: "OTHER" },
    select: { value: true },
  });

  // 4) holdings + invested
  const holdings = new Map<string, number>(); // assetId -> qty
  let invested = 0;

  for (const t of txs) {
    const q = Number(t.quantity);
    if (!Number.isFinite(q) || !t.assetId) continue;

    const sign = t.type === "BUY" ? 1 : -1;
    holdings.set(t.assetId, (holdings.get(t.assetId) ?? 0) + sign * q);

    if (t.type === "BUY") {
      const p = Number(t.pricePerUnit ?? "0");
      const v = q * p;
      if (Number.isFinite(v)) invested += v;
    }
  }

  // 5) nacitaj asset meta (typ/provider/apiId) a potom ceny
  const assetIds = Array.from(holdings.keys());
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, type: true, provider: true, apiId: true },
  });

  const byId = new Map(assets.map((a) => [a.id, a] as const));

  const cgIds: { assetId: string; apiId: string }[] = [];
  const tdSyms: { assetId: string; apiId: string }[] = [];

  for (const id of assetIds) {
    const a = byId.get(id);
    if (!a?.apiId) continue;
    if (a.provider === "COINGECKO" && a.type === "CRYPTO") cgIds.push({ assetId: id, apiId: a.apiId });
    if (a.provider === "TWELVEDATA" && (a.type === "STOCK" || a.type === "ETF")) tdSyms.push({ assetId: id, apiId: a.apiId });
  }

  const [cgMap, tdMap] = await Promise.all([
    fetchCoinGeckoSimplePrice(cgIds.map((x) => x.apiId), vs),
    fetchTwelveDataQuote(tdSyms.map((x) => x.apiId), vs),
  ]);

  const priceByAssetId = new Map<string, number>();
  for (const x of cgIds) {
    const p = cgMap.get(x.apiId);
    if (typeof p === "number") priceByAssetId.set(x.assetId, p);
  }
  for (const x of tdSyms) {
    const p = tdMap.get(x.apiId);
    if (typeof p === "number") priceByAssetId.set(x.assetId, p);
  }

  // 6) current total value (main + other)
  let mainValue = 0;

  // allocation buckets
  let vCrypto = 0, vStock = 0, vEtf = 0;

  for (const [assetId, qty] of holdings) {
    if (qty <= 0) continue;
    const price = priceByAssetId.get(assetId) ?? 0;
    const v = qty * price;
    if (!Number.isFinite(v)) continue;

    mainValue += v;

    const meta = byId.get(assetId);
    if (meta?.type === "CRYPTO") vCrypto += v;
    else if (meta?.type === "STOCK") vStock += v;
    else if (meta?.type === "ETF") vEtf += v;
  }

  const otherValue = otherAssets.reduce((s, a) => {
    const v = Number(a.value);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);

  const currentTotalValue = mainValue + otherValue;
  const overallPL = currentTotalValue - (invested + 0); // invested je cost basis len z BUY; OTHER tu nemá cost basis

 // 7) timeSeries zo snapshotov: berieme POSLEDNY snapshot za den pre kazdu wallet
const from = new Date();
from.setDate(from.getDate() - 60);

const snaps = await prisma.walletSnapshot.findMany({
  where: { walletId: { in: walletIds }, createdAt: { gte: from } },
  select: { walletId: true, value: true, createdAt: true },
  orderBy: [{ walletId: "asc" }, { createdAt: "asc" }],
});

// 7a) wallet+day -> last snapshot value
const lastByWalletDay = new Map<string, number>(); // key = `${walletId}|${dayKey}`

for (const s of snaps) {
  const v = Number(s.value);
  if (!Number.isFinite(v)) continue;
  const dayKey = utcDayKey(s.createdAt);
  const key = `${s.walletId}|${dayKey}`;

  // kedze ideme ASC, posledny zapis pre dany key bude najnovsi snapshot v ten den
  lastByWalletDay.set(key, v);
}

// 7b) day -> sum(last snapshots across wallets)
const seriesMap = new Map<string, number>();

for (const [key, val] of lastByWalletDay.entries()) {
  const dayKey = key.split("|")[1];
  seriesMap.set(dayKey, (seriesMap.get(dayKey) ?? 0) + val);
}

const timeSeries = Array.from(seriesMap.entries()).map(([dayKey, value]) => ({
  date: dayKey,
  value: Number(value.toFixed(2)),
}));


  return NextResponse.json({
    vs,
    currentTotalValue: Number(currentTotalValue.toFixed(2)),
    overallPL: Number(overallPL.toFixed(2)),
    allocation: [
      { name: "Crypto", value: Number(vCrypto.toFixed(2)) },
      { name: "Stocks", value: Number(vStock.toFixed(2)) },
      { name: "ETFs", value: Number(vEtf.toFixed(2)) },
      { name: "Other", value: Number(otherValue.toFixed(2)) },
    ],
    timeSeries,
    updatedAt: utcDayKey(new Date()),
  });
}
