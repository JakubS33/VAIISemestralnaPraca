import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

function safeTrim(v: unknown) {
  return (v ?? "").toString().trim();
}

async function getUserIdOr401() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

// GET /api/catalog/assets?q=btc&types=CRYPTO,ETF,STOCK
export async function GET(req: Request) {
  const userId = await getUserIdOr401();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = safeTrim(searchParams.get("q")).toLowerCase();
  const typesRaw = safeTrim(searchParams.get("types"));
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 20);

  if (!q) return NextResponse.json([]);

  const types = typesRaw
    ? typesRaw
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean)
    : ["CRYPTO", "STOCK", "ETF"];

  const rows = await prisma.asset.findMany({
    where: {
      type: { in: types as any },
      provider: { in: ["COINGECKO", "TWELVEDATA"] },
      apiId: { not: null },
      OR: [
        { symbol: { startsWith: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: [{ symbol: "asc" }],
    select: {
      id: true,
      type: true,
      symbol: true,
      name: true,
      provider: true,
      apiId: true,
      exchange: true,
    },
  });

  return NextResponse.json(rows);
}
