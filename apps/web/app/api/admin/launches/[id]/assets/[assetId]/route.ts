import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["in_progress", "in_review", "ready"] as const;

// ─── PATCH /api/admin/launches/[id]/assets/[assetId] ─────────────────────────
// Update an asset — used to mark "in review" → "ready" when the AI finalizes
// or when an admin approves. Writes an asset_ready event when flipping to ready.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, assetId } = await params;
  const existing = await prisma.launchAsset.findFirst({ where: { id: assetId, launchId: id } });
  if (!existing) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  const data: {
    title?: string;
    status?: string;
    payload?: unknown;
    deliveredAt?: Date | null;
  } = {};

  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (body.payload !== undefined) data.payload = body.payload;

  if (typeof body.status === "string" && VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
    data.status = body.status;
    if (body.status === "ready" && !existing.deliveredAt) data.deliveredAt = new Date();
  }

  const asset = await prisma.launchAsset.update({
    where: { id: assetId },
    // deliveredAt typed via Prisma.InputJsonValue workaround — keep as-is; Prisma accepts this shape.
    data: data as { title?: string; status?: string; deliveredAt?: Date | null },
  });

  // Log the delivery event when newly ready
  if (data.status === "ready" && existing.status !== "ready") {
    await prisma.launchEvent.create({
      data: {
        launchId: id,
        kind: "asset_ready",
        title: `${KIND_LABELS[asset.kind] || asset.kind} delivered`,
        detail: asset.title,
      },
    });
  }

  return NextResponse.json({ asset });
}

// ─── DELETE /api/admin/launches/[id]/assets/[assetId] ────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, assetId } = await params;
  await prisma.launchAsset.deleteMany({ where: { id: assetId, launchId: id } });
  return NextResponse.json({ ok: true });
}

const KIND_LABELS: Record<string, string> = {
  logo: "Logo",
  store: "Storefront",
  product_page: "Product page",
  ad: "Ad creative",
  ugc: "UGC video",
  email: "Email flow",
};
