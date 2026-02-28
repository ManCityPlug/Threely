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
  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      email: { contains: q, mode: "insensitive" },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      profile: { select: { dailyTimeMinutes: true, intensityLevel: true } },
      _count: { select: { goals: true, dailyTasks: true } },
    },
  });

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
  });
}
