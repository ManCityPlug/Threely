import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Task content now comes from the @threely/tasks library — no LLM runs in
// prod, so there's no per-call AI cost to report. Overview only tracks the
// counts that actually move: who's signed up, who's paying, who's trialing,
// and the implied MRR.
export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalUsers, trialingCount, activeSubCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { subscriptionStatus: "trialing" } }),
    prisma.user.count({ where: { subscriptionStatus: "active" } }),
  ]);

  // Blended MRR: ~$12.99 monthly, ~$8.33/mo yearly equivalent
  const estimatedMRR = activeSubCount * 10.66;

  return NextResponse.json({
    users: {
      total: totalUsers,
      paid: activeSubCount,
      trialing: trialingCount,
    },
    subscriptions: {
      estimatedMRR: Math.round(estimatedMRR * 100) / 100,
    },
  });
}
