import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ─── GET /api/launch ─────────────────────────────────────────────────────────
// Returns { launch, assets, events } for the authenticated user, or
// { launch: null } if they haven't started a launch yet.
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const launch = await prisma.launch.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      assets: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  if (!launch) return NextResponse.json({ launch: null });

  const { assets, events, ...rest } = launch;
  return NextResponse.json({ launch: rest, assets, events });
}

// ─── POST /api/launch ────────────────────────────────────────────────────────
// Creates the launch. Idempotent: if the user already has one, returns it.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const businessName = String(body.businessName ?? "").trim();
  const niche = String(body.niche ?? "").trim();

  if (!businessName || !niche) {
    return NextResponse.json({ error: "businessName and niche required" }, { status: 400 });
  }

  const existing = await prisma.launch.findFirst({ where: { userId: user.id } });
  if (existing) {
    return NextResponse.json({ launch: existing, created: false });
  }

  const launch = await prisma.launch.create({
    data: {
      userId: user.id,
      businessName,
      niche,
      currentPhase: 1,
      status: "active",
      events: {
        create: {
          kind: "note",
          title: "Launch started",
          detail: `We're building ${businessName} for you. First assets coming within 48h.`,
        },
      },
    },
  });

  return NextResponse.json({ launch, created: true });
}
