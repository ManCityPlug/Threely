import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") || "";
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
  const limit = 30;
  const skip = (page - 1) * limit;

  const where = q.length >= 2
    ? { email: { contains: q, mode: "insensitive" as const } }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        profile: { select: { dailyTimeMinutes: true, intensityLevel: true } },
        _count: { select: { goals: true, dailyTasks: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      createdAt: u.createdAt,
      subscriptionStatus: u.subscriptionStatus,
      goalCount: u._count.goals,
      taskCount: u._count.dailyTasks,
      profile: u.profile,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
