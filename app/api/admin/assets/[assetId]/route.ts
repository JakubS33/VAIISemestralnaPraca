export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUserId } from "@/lib/admin";

type Ctx = { params: Promise<{ assetId: string }> };

// DELETE /api/admin/assets/:assetId
// Pozn.: Toto odstráni aj transakcie a walletAssets, ktoré na asset odkazujú.
export async function DELETE(_req: Request, ctx: Ctx) {
  const adminId = await requireAdminUserId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { assetId } = await ctx.params;
  if (!assetId) return NextResponse.json({ error: "Missing assetId" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { assetId } });
      await tx.walletAsset.deleteMany({ where: { assetId } });
      await tx.asset.delete({ where: { id: assetId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Delete failed" }, { status: 400 });
  }
}
