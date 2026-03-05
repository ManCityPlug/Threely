import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalLogs,
    logsByFunction,
    logsByModel,
    feedbackCompleted,
    feedbackSkipped,
    feedbackRescheduled,
    feedbackEdited,
    feedbackNull,
    tokenAggregates,
    avgResponseTime,
    dailyGrowth,
    recentLogs,
    estimatedTrainingReady,
    uniqueUsers,
    tokensByModel,
  ] = await Promise.all([
    // 1. Total logs
    prisma.aICallLog.count(),

    // 2. Logs grouped by functionName
    prisma.aICallLog.groupBy({
      by: ["functionName"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),

    // 3. Logs grouped by modelUsed
    prisma.aICallLog.groupBy({
      by: ["modelUsed"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),

    // 4. Feedback stats - individual counts
    prisma.aICallLog.count({ where: { taskFeedback: "completed" } }),
    prisma.aICallLog.count({ where: { taskFeedback: "skipped" } }),
    prisma.aICallLog.count({ where: { taskFeedback: "rescheduled" } }),
    prisma.aICallLog.count({ where: { taskFeedback: "edited" } }),
    prisma.aICallLog.count({ where: { taskFeedback: null } }),

    // 5. Total tokens
    prisma.aICallLog.aggregate({
      _sum: { inputTokens: true, outputTokens: true },
    }),

    // 6. Average response time
    prisma.aICallLog.aggregate({
      _avg: { responseTimeMs: true },
    }),

    // 7. Daily growth (last 30 days) - fetch raw, group in JS
    prisma.aICallLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),

    // 8. Recent logs
    prisma.aICallLog.findMany({
      select: {
        id: true,
        functionName: true,
        modelUsed: true,
        inputTokens: true,
        outputTokens: true,
        responseTimeMs: true,
        taskFeedback: true,
        goalId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),

    // 9. Estimated training ready (completed feedback = high quality)
    prisma.aICallLog.count({ where: { taskFeedback: "completed" } }),

    // 10. Unique users
    prisma.aICallLog.findMany({
      select: { userId: true },
      distinct: ["userId"],
    }),

    // 11. Token usage grouped by model (for accurate cost calculation)
    prisma.aICallLog.groupBy({
      by: ["modelUsed"],
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);

  // Group daily growth by date string
  const dailyGrowthMap: Record<string, number> = {};
  for (const log of dailyGrowth) {
    const dateKey = log.createdAt.toISOString().split("T")[0];
    dailyGrowthMap[dateKey] = (dailyGrowthMap[dateKey] || 0) + 1;
  }
  const dailyGrowthArray = Object.entries(dailyGrowthMap).map(
    ([date, count]) => ({ date, count })
  );

  return NextResponse.json({
    totalLogs,
    logsByFunction: logsByFunction.map((g) => ({
      functionName: g.functionName,
      count: g._count.id,
    })),
    logsByModel: logsByModel.map((g) => ({
      modelUsed: g.modelUsed,
      count: g._count.id,
    })),
    feedbackStats: {
      completed: feedbackCompleted,
      skipped: feedbackSkipped,
      rescheduled: feedbackRescheduled,
      edited: feedbackEdited,
      none: feedbackNull,
    },
    totalTokens: {
      input: tokenAggregates._sum.inputTokens ?? 0,
      output: tokenAggregates._sum.outputTokens ?? 0,
      total:
        (tokenAggregates._sum.inputTokens ?? 0) +
        (tokenAggregates._sum.outputTokens ?? 0),
    },
    avgResponseTime: Math.round(avgResponseTime._avg.responseTimeMs ?? 0),
    dailyGrowth: dailyGrowthArray,
    recentLogs,
    estimatedTrainingReady,
    uniqueUsers: uniqueUsers.length,
    costBreakdown: (() => {
      // Anthropic pricing per 1M tokens (March 2026)
      const pricing: Record<string, { input: number; output: number }> = {
        "claude-opus-4-6": { input: 15, output: 75 },
        "claude-sonnet-4-6": { input: 3, output: 15 },
        "claude-haiku-4-5-20251001": { input: 0.80, output: 4 },
      };
      let totalCost = 0;
      const perModel = tokensByModel.map((m) => {
        const rates = pricing[m.modelUsed] ?? { input: 3, output: 15 };
        const inputCost = ((m._sum.inputTokens ?? 0) / 1_000_000) * rates.input;
        const outputCost = ((m._sum.outputTokens ?? 0) / 1_000_000) * rates.output;
        const cost = inputCost + outputCost;
        totalCost += cost;
        return {
          model: m.modelUsed,
          inputTokens: m._sum.inputTokens ?? 0,
          outputTokens: m._sum.outputTokens ?? 0,
          cost: Math.round(cost * 10000) / 10000,
        };
      });
      return { perModel, totalCost: Math.round(totalCost * 100) / 100 };
    })(),
  });
}
