import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const VALID_KINDS = ["logo", "store", "product_page", "ad", "ugc", "email"] as const;
const VALID_STATUSES = ["in_progress", "in_review", "ready"] as const;

// ─── POST /api/admin/launches/[id]/assets ───────────────────────────────────
// Create a new asset. In production the AI generator will call this; admin can
// also call it manually to drop in content.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const launch = await prisma.launch.findUnique({ where: { id } });
  if (!launch) return NextResponse.json({ error: "Launch not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const kind  = String(body.kind ?? "");
  const title = String(body.title ?? "").trim();
  const status = String(body.status ?? "in_progress");
  const payload = body.payload ?? null;
  const aiGenerated = body.aiGenerated !== false; // default true

  if (!VALID_KINDS.includes(kind as (typeof VALID_KINDS)[number])) {
    return NextResponse.json({ error: `kind must be one of: ${VALID_KINDS.join(", ")}` }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const asset = await prisma.launchAsset.create({
    data: {
      launchId: id,
      kind,
      title,
      status,
      payload,
      aiGenerated,
      deliveredAt: status === "ready" ? new Date() : null,
    },
  });

  // Log an event so the user's timeline updates
  if (status === "ready") {
    await prisma.launchEvent.create({
      data: {
        launchId: id,
        kind: "asset_ready",
        title: `${KIND_LABELS[kind] || kind} delivered`,
        detail: title,
      },
    });
  }

  return NextResponse.json({ asset });
}

const KIND_LABELS: Record<string, string> = {
  logo: "Logo",
  store: "Storefront",
  product_page: "Product page",
  ad: "Ad creative",
  ugc: "UGC video",
  email: "Email flow",
};
