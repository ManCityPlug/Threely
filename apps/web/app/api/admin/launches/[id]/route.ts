import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// ─── GET /api/admin/launches/[id] ────────────────────────────────────────────
// Full detail: launch + user + all assets + recent events.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const launch = await prisma.launch.findUnique({
    where: { id },
    include: {
      user:   { select: { id: true, email: true, createdAt: true, subscriptionStatus: true } },
      assets: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!launch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ launch });
}

// ─── PATCH /api/admin/launches/[id] ──────────────────────────────────────────
// Update phase / status / businessName / niche. Writes a LaunchEvent if phase
// changes so the user's timeline shows the progress.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await prisma.launch.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: {
    currentPhase?: number;
    status?: string;
    businessName?: string;
    niche?: string;
  } = {};

  if (typeof body.currentPhase === "number" && body.currentPhase >= 1 && body.currentPhase <= 6) {
    data.currentPhase = body.currentPhase;
  }
  if (typeof body.status === "string" && ["active", "paused", "completed"].includes(body.status)) {
    data.status = body.status;
  }
  if (typeof body.businessName === "string" && body.businessName.trim()) {
    data.businessName = body.businessName.trim();
  }
  if (typeof body.niche === "string" && body.niche.trim()) {
    data.niche = body.niche.trim();
  }

  const launch = await prisma.launch.update({
    where: { id },
    data: {
      ...data,
      ...(data.currentPhase && data.currentPhase !== existing.currentPhase
        ? {
            events: {
              create: {
                kind: "phase_change",
                title: `Phase advanced to ${PHASE_NAMES[data.currentPhase - 1] || data.currentPhase}`,
                detail: `Moved from ${PHASE_NAMES[existing.currentPhase - 1] || existing.currentPhase} to ${PHASE_NAMES[data.currentPhase - 1] || data.currentPhase}.`,
              },
            },
          }
        : {}),
    },
  });

  return NextResponse.json({ launch });
}

// ─── DELETE /api/admin/launches/[id] ────────────────────────────────────────
// Hard-delete. Cascades assets + events.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.launch.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

const PHASE_NAMES = ["Foundation", "Branding", "Store", "First Ads", "Scale", "Growth"];
