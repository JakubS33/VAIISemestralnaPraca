import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionPayload } from "@/lib/auth";
import { ensureDailyWalletSnapshot, bratislavaDayKey } from "@/lib/walletSnapshots";

type VsCurrency = "eur" | "usd";

function asVsCurrency(v: string | null): VsCurrency {
  const x = (v ?? "eur").toLowerCase();
  return x === "usd" ? "usd" : "eur";
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

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
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

  // Ensure each wallet has a snapshot for today (Bratislava day).
  await Promise.all(
    walletIds.map(async (id) => {
      try {
        await ensureDailyWalletSnapshot(id);
      } catch (e) {
        console.error("[snapshot] ensureDailyWalletSnapshot failed", { walletId: id, e });
      }
    })
  );

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

  // 3) OTHER assets
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

  // 5) asset meta + ceny
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

  // 6) current totals + allocation
  let mainValue = 0;
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

  // P/L len z assetov (others ignorujeme)
  const overallPL = mainValue - invested;

  // 7) timeSeries zo snapshotov (carry-forward namiesto 0)
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 60);

  const snaps = await prisma.walletSnapshot.findMany({
    where: { walletId: { in: walletIds }, createdAt: { gte: from } },
    select: { walletId: true, value: true, createdAt: true },
    orderBy: [{ walletId: "asc" }, { createdAt: "asc" }],
  });

  // walletId -> Map(dayKey -> last value that day)
  const perWalletDay = new Map<string, Map<string, number>>();
  for (const s of snaps) {
    const v = Number(s.value);
    if (!Number.isFinite(v)) continue;
    const dayKey = bratislavaDayKey(s.createdAt);
    let m = perWalletDay.get(s.walletId);
    if (!m) {
      m = new Map<string, number>();
      perWalletDay.set(s.walletId, m);
    }
    // ASC order => overwriting gives "last snapshot that day"
    m.set(dayKey, v);
  }

  // Build list of dayKeys from from..today (Bratislava day keys)
  const today = new Date();
  const dayKeys: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const d = addDaysUTC(from, i);
    const k = bratislavaDayKey(d);
    if (dayKeys.length === 0 || dayKeys[dayKeys.length - 1] !== k) dayKeys.push(k);
  }
  // Ensure today included
  const todayKey = bratislavaDayKey(today);
  if (dayKeys[dayKeys.length - 1] !== todayKey) dayKeys.push(todayKey);

  // carry-forward sum
  const lastValByWallet = new Map<string, number>();
  const timeSeries = dayKeys.map((dayKey) => {
    let sum = 0;

    for (const wid of walletIds) {
      const wm = perWalletDay.get(wid);
      const v = wm?.get(dayKey);

      if (typeof v === "number") {
        lastValByWallet.set(wid, v);
      }

      const carried = lastValByWallet.get(wid);
      if (typeof carried === "number") sum += carried;
      // else wallet has never had a snapshot yet => contributes 0 until first appears
    }

    return { date: dayKey, value: Number(sum.toFixed(2)) };
  });

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
    updatedAt: todayKey,
  });
}
