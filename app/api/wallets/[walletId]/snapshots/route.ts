import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { ensureDailyWalletSnapshot } from "@/lib/walletSnapshots";

type Ctx = { params: Promise<{ walletId: string }> };

async function getUserId() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

// GET /api/wallets/[walletId]/snapshots
// Returns wallet value snapshots for the chart.
export async function GET(req: Request, ctx: Ctx) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { walletId } = await ctx.params;

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId }, select: { id: true } });
  if (!wallet) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Ensure there is at least one "daily" snapshot for the current day when user opens the detail.
  await ensureDailyWalletSnapshot(walletId);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "180"), 10), 1000);

  const rows = await prisma.walletSnapshot.findMany({
    where: { walletId },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, createdAt: true, value: true, currency: true, reason: true },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      date: r.createdAt,
      value: r.value,
      currency: r.currency,
      reason: r.reason,
    }))
  );
}
