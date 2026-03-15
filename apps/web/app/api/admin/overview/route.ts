import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface TaskItem {
  id: string;
  isCompleted: boolean;
  isSkipped?: boolean;
  estimated_minutes?: number;
}

// AI cost estimates per call (USD) — based on actual token usage
// Sonnet 4.6: $3/$15 per 1M tokens (input/output)
// Haiku 4.5: $0.80/$4 per 1M tokens (input/output)
const AI_COSTS = {
  parseGoal: 0.002,           // Haiku — ~1.5K in, ~300 out
  generateRoadmap: 0.03,      // Sonnet — ~2.5K in, ~1.5K out
  generateTasks: 0.005,       // Haiku (cached) — ~5K in, ~3K out
  goalChat: 0.002,            // Haiku — ~800 in, ~400 out
  generateInsight: 0.001,     // Haiku — ~500 in, ~150 out
  refineTask: 0.001,          // Haiku — ~500 in, ~250 out
  askAboutTask: 0.002,        // Haiku — ~1K in, ~400 out
  generateWeeklySummary: 0.002, // Haiku — ~800 in, ~200 out
};

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalUsers,
    newUsers30d,
    totalGoals,
    activeGoals,
    allDailyTasks,
    trialingCount,
    activeSubCount,
    reviewsWithInsight,
    totalWeeklySummaries,
    recentActiveUserIds,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.goal.count(),
    prisma.goal.count({ where: { isActive: true } }),
    prisma.dailyTask.findMany(),
    prisma.user.count({ where: { subscriptionStatus: "trialing" } }),
    prisma.user.count({ where: { subscriptionStatus: "active" } }),
    prisma.dailyReview.count({ where: { insight: { not: null } } }),
    prisma.weeklySummary.count(),
    prisma.dailyTask.findMany({
      where: { generatedAt: { gte: sevenDaysAgo } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  // Task stats
  let totalTaskItems = 0;
  let completedTasks = 0;
  let skippedTasks = 0;
  for (const dt of allDailyTasks) {
    const tasks = dt.tasks as unknown as TaskItem[];
    for (const t of tasks) {
      totalTaskItems++;
      if (t.isCompleted) completedTasks++;
      if (t.isSkipped) skippedTasks++;
    }
  }

  // Revenue estimates (blended: ~$12.99 monthly + ~$8.33/mo yearly)
  const estimatedMRR = activeSubCount * 10.66;

  // AI cost estimates
  const goalCount = totalGoals;
  const taskRecordCount = allDailyTasks.length;
  const aiCosts = {
    parseGoal: { calls: goalCount, cost: goalCount * AI_COSTS.parseGoal },
    generateRoadmap: {
      calls: goalCount,
      cost: goalCount * AI_COSTS.generateRoadmap,
    },
    generateTasks: {
      calls: taskRecordCount,
      cost: taskRecordCount * AI_COSTS.generateTasks,
    },
    goalChat: {
      calls: goalCount * 2,
      cost: goalCount * 2 * AI_COSTS.goalChat,
    },
    generateInsight: {
      calls: reviewsWithInsight,
      cost: reviewsWithInsight * AI_COSTS.generateInsight,
    },
    refineTask: {
      calls: Math.round(totalTaskItems * 0.1),
      cost: Math.round(totalTaskItems * 0.1) * AI_COSTS.refineTask,
    },
    generateWeeklySummary: {
      calls: totalWeeklySummaries,
      cost: totalWeeklySummaries * AI_COSTS.generateWeeklySummary,
    },
  };
  const totalAICost = Object.values(aiCosts).reduce(
    (sum, v) => sum + v.cost,
    0
  );

  return NextResponse.json({
    users: {
      total: totalUsers,
      active7d: recentActiveUserIds.length,
      new30d: newUsers30d,
    },
    goals: {
      total: totalGoals,
      active: activeGoals,
    },
    tasks: {
      totalItems: totalTaskItems,
      completed: completedTasks,
      skipped: skippedTasks,
      completionRate:
        totalTaskItems > 0
          ? Math.round((completedTasks / totalTaskItems) * 100)
          : 0,
      dailyTaskRecords: allDailyTasks.length,
    },
    subscriptions: {
      trialing: trialingCount,
      active: activeSubCount,
      estimatedMRR: Math.round(estimatedMRR * 100) / 100,
    },
    ai: {
      breakdown: aiCosts,
      totalCost: Math.round(totalAICost * 100) / 100,
    },
  });
}
