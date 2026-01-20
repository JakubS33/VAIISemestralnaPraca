import { prisma } from "@/lib/prisma";

type VsCurrency = "eur" | "usd";

function asVsCurrencyFromWalletCurrency(currency: string | null | undefined): VsCurrency {
  const x = (currency ?? "EUR").toLowerCase();
  return x === "usd" ? "usd" : "eur";
}

function bratislavaDayKey(d: Date): string {
  // YYYY-MM-DD in Europe/Bratislava
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function sameDayInBratislava(a: Date, b: Date): boolean {
  return bratislavaDayKey(a) === bratislavaDayKey(b);
}

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

async function fetchTwelveDataQuote(symbols: string[], _vs: VsCurrency): Promise<Map<string, number>> {
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

  return map;
}

async function computeWalletValueLive(walletId: string): Promise<{ value: number; currency: string; pricedAssetCount: number }> {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId }, select: { id: true, currency: true } });
  if (!wallet) throw new Error("Wallet not found");

  const txs = await prisma.transaction.findMany({
    where: { walletId },
    select: { assetId: true, type: true, quantity: true },
  });

  const holdings = new Map<string, number>();
  for (const t of txs) {
    const q = Number(t.quantity);
    if (!Number.isFinite(q)) continue;
    const sign = t.type === "BUY" ? 1 : -1;
    holdings.set(t.assetId, (holdings.get(t.assetId) ?? 0) + sign * q);
  }

  const assetIds = Array.from(holdings.entries())
    .filter(([, qty]) => Math.abs(qty) > 1e-12)
    .map(([assetId]) => assetId);

  if (assetIds.length === 0) {
    return { value: 0, currency: wallet.currency, pricedAssetCount: 0 };
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, type: true, provider: true, apiId: true },
  });

  const byId = new Map(assets.map((a) => [a.id, a] as const));
  const cgIds: { assetId: string; apiId: string }[] = [];
  const tdSyms: { assetId: string; apiId: string }[] = [];

  for (const id of assetIds) {
    const a = byId.get(id);
    if (!a || !a.apiId) continue;
    if (a.provider === "COINGECKO" && a.type === "CRYPTO") cgIds.push({ assetId: a.id, apiId: a.apiId });
    if (a.provider === "TWELVEDATA" && (a.type === "STOCK" || a.type === "ETF")) tdSyms.push({ assetId: a.id, apiId: a.apiId });
  }

  const vs = asVsCurrencyFromWalletCurrency(wallet.currency);
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

  let sum = 0;
  let pricedAssetCount = 0;

  for (const [assetId, qty] of holdings) {
    const p = priceByAssetId.get(assetId);
    if (typeof p !== "number") continue;
    pricedAssetCount += 1;
    sum += qty * p;
  }

  const value = Number(sum.toFixed(2));
  return { value, currency: wallet.currency, pricedAssetCount };
}

export async function createWalletSnapshot(walletId: string, reason: "TX_ADD" | "TX_DELETE" | "EOD" | "TX_EDIT") {
  const { value, currency, pricedAssetCount } = await computeWalletValueLive(walletId);

  await prisma.walletSnapshot.create({
    data: {
      walletId,
      value: value.toString(),
      currency,
      reason,
    },
  });

  return { value, currency, pricedAssetCount };
}

/**
 * Ensure wallet has at least one snapshot for "today" (Europe/Bratislava).
 * We check the latest snapshot of ANY reason. If none is from today, create an EOD snapshot.
 */
export async function ensureDailyWalletSnapshot(walletId: string) {
  const lastAny = await prisma.walletSnapshot.findFirst({
    where: { walletId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const now = new Date();
  if (lastAny && sameDayInBratislava(lastAny.createdAt, now)) {
    return { created: false };
  }

  await createWalletSnapshot(walletId, "EOD");
  return { created: true };
}

export { bratislavaDayKey };
