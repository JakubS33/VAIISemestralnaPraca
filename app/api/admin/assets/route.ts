export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUserId } from "@/lib/admin";

// GET /api/admin/assets
export async function GET(req: Request) {
  const adminId = await requireAdminUserId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Number(searchParams.get("limit") ?? 200) || 200, 500);

  const assets = await prisma.asset.findMany({
    where: q
      ? {
          OR: [
            { symbol: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ type: "asc" }, { symbol: "asc" }],
    take: limit,
    select: {
      id: true,
      type: true,
      symbol: true,
      name: true,
      provider: true,
      apiId: true,
      exchange: true,
      createdAt: true,
    },
  });

  return NextResponse.json(assets);
}
