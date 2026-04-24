import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// ─── GET /api/admin/launches ─────────────────────────────────────────────────
// List all launches across users, with user email + asset counts.
// Supports simple pagination via ?page=&pageSize= and ?search= on businessName/email.
export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page     = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10)));
  const search   = (searchParams.get("search") || "").trim();

  const where = search
    ? {
        OR: [
          { businessName: { contains: search, mode: "insensitive" as const } },
          { niche:        { contains: search, mode: "insensitive" as const } },
          { user: { email: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [total, launches] = await Promise.all([
    prisma.launch.count({ where }),
    prisma.launch.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true, id: true } },
        _count: { select: { assets: true, events: true } },
      },
    }),
  ]);

  return NextResponse.json({
    launches: launches.map((l) => ({
      id: l.id,
      userId: l.userId,
      userEmail: l.user.email,
      businessName: l.businessName,
      niche: l.niche,
      currentPhase: l.currentPhase,
      status: l.status,
      assetCount: l._count.assets,
      eventCount: l._count.events,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
    total,
    page,
    pageSize,
  });
}
