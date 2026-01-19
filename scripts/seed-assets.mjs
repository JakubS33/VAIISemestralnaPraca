/*
  Seed Asset catalog with provider-specific identifiers used for live prices.

  - Crypto: CoinGecko (no API key required)
  - Stocks / ETFs: TwelveData (requires TWELVEDATA_API_KEY)

  Usage:
    node scripts/seed-assets.mjs

  Optional env:
    COINGECKO_TOP_N=2000
    TWELVEDATA_API_KEY=...
    TWELVEDATA_MAX=5000
    TWELVEDATA_EXCHANGES=NASDAQ,NYSE,AMEX
*/
import "dotenv/config";
console.log("[seed] TWELVEDATA_API_KEY present:", !!process.env.TWELVEDATA_API_KEY);

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TOP_N = Number(process.env.COINGECKO_TOP_N ?? "2000");
const TD_KEY = process.env.TWELVEDATA_API_KEY ?? "";
const TD_MAX = Number(process.env.TWELVEDATA_MAX ?? "5000");
const TD_EXCHANGES = (process.env.TWELVEDATA_EXCHANGES ?? "NASDAQ,NYSE,AMEX")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, opts = {}, attempt = 1) {
  const r = await fetch(url, opts);

  // ✅ rate limit / transient errors → retry
  if (r.status === 429 || (r.status >= 500 && r.status <= 599)) {
    const retryAfter = Number(r.headers.get("retry-after") ?? "0") * 1000;

    // exponential backoff (max ~30s)
    const backoff = Math.min(30000, 1000 * Math.pow(2, attempt - 1));

    const waitMs = Math.max(retryAfter, backoff);

    console.log(`[seed] HTTP ${r.status}. retry in ${waitMs}ms (attempt ${attempt})`);
    await sleep(waitMs);

    if (attempt >= 6) {
      throw new Error(`HTTP ${r.status} after ${attempt} retries for ${url}`);
    }
    return fetchJson(url, opts, attempt + 1);
  }

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} for ${url}\n${txt}`);
  }

  return r.json();
}



async function seedCoinGecko() {
  console.log(`[seed] CoinGecko top ${TOP_N}...`);

  const perPage = 250;
  const pages = Math.ceil(Math.min(TOP_N, 5000) / perPage);
  let inserted = 0;

  for (let page = 1; page <= pages; page++) {
    const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("order", "market_cap_desc");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("sparkline", "false");

    const rows = await fetchJson(url.toString());
    if (!Array.isArray(rows) || rows.length === 0) break;

    for (const row of rows) {
      if (inserted >= TOP_N) break;
      const apiId = String(row.id);
      const symbol = String(row.symbol ?? "").toUpperCase();
      const name = String(row.name ?? symbol);

      if (!apiId || !symbol) continue;

      await prisma.asset.upsert({
        where: { provider_apiId_type: { provider: "COINGECKO", apiId, type: "CRYPTO" } },
        update: { symbol, name, provider: "COINGECKO", apiId, type: "CRYPTO" },
        create: { symbol, name, provider: "COINGECKO", apiId, type: "CRYPTO" },
      });

      inserted++;
    }

    console.log(`[seed] CoinGecko page ${page}/${pages} (total: ${inserted})`);
    if (inserted >= TOP_N) break;
  }

  console.log(`[seed] CoinGecko done. Total: ${inserted}`);
}

async function seedTwelveData(kind) {
  if (!TD_KEY) {
    console.log(`[seed] TwelveData key missing -> skipping ${kind}. Set TWELVEDATA_API_KEY if you want STOCK/ETF catalog.`);
    return;
  }

  const endpoint = kind === "ETF" ? "etf" : "stocks";
  console.log(`[seed] TwelveData ${kind} list (${TD_EXCHANGES.join(", ")})...`);

  const url = new URL(`https://api.twelvedata.com/${endpoint}`);
  url.searchParams.set("apikey", TD_KEY);

  const json = await fetchJson(url.toString());
  const data = Array.isArray(json?.data) ? json.data : [];

  let inserted = 0;
  for (const row of data) {
    if (inserted >= TD_MAX) break;

    const symbol = String(row.symbol ?? "").trim();
    const name = String(row.name ?? symbol).trim();
    const exchange = String(row.exchange ?? "").trim();

    if (!symbol) continue;
    if (exchange && TD_EXCHANGES.length > 0 && !TD_EXCHANGES.includes(exchange)) continue;

    const apiId = symbol; // US-only in this project

    await prisma.asset.upsert({
      where: { provider_apiId_type: { provider: "TWELVEDATA", apiId, type: kind } },
      update: { symbol, name, exchange: exchange || null, provider: "TWELVEDATA", apiId, type: kind },
      create: { symbol, name, exchange: exchange || null, provider: "TWELVEDATA", apiId, type: kind },
    });

    inserted++;
  }

  console.log(`[seed] TwelveData ${kind} done. Total: ${inserted}`);
}

async function main() {
  try {
    await seedCoinGecko();
    //await seedTwelveData("STOCK");
    //await seedTwelveData("ETF");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
