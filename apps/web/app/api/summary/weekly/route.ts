import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

interface TaskItem {
  isCompleted: boolean;
  isSkipped?: boolean;
  estimated_minutes?: number;
}

// GET /api/summary/weekly?withInsight=true
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const withInsight = searchParams.get("withInsight") === "true";

    // Last 7 days
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyTasks = await prisma.dailyTask.findMany({
      where: { userId: user.id, date: { gte: sevenDaysAgo } },
      include: {
        goal: { select: { id: true, title: true } },
        review: true,
      },
      orderBy: { date: "asc" },
    });

    // Compute stats
    let totalCompleted = 0;
    let totalTasks = 0;
    let totalMinutes = 0;
    const goalsWorkedOn = new Set<string>();
    const dailyBreakdown: { date: string; completed: number; total: number }[] = [];

    // Group by date
    const byDate = new Map<string, { completed: number; total: number }>();
    for (const dt of dailyTasks) {
      const key = new Date(dt.date).toISOString().split("T")[0];
      const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as TaskItem[]) : [];
      const completed = items.filter(t => t.isCompleted).length;
      const total = items.length;

      totalCompleted += completed;
      totalTasks += total;
      totalMinutes += items
        .filter(t => t.isCompleted)
        .reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
      goalsWorkedOn.add(dt.goalId);

      const existing = byDate.get(key) ?? { completed: 0, total: 0 };
      existing.completed += completed;
      existing.total += total;
      byDate.set(key, existing);
    }

    for (const [date, stats] of byDate) {
      dailyBreakdown.push({ date, ...stats });
    }

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    const summary: Record<string, unknown> = {
      tasksCompleted: totalCompleted,
      tasksGenerated: totalTasks,
      hoursInvested: totalHours,
      goalsWorkedOn: goalsWorkedOn.size,
      dailyBreakdown,
    };

    // Optional AI weekly insight
    if (withInsight) {
      const { allowed } = checkRateLimit(user.id);
      if (!allowed) {
        summary.insight = null;
        summary.insightError = "Rate limited — try again later";
      } else {
        try {
          const { generateWeeklySummary } = await import("@/lib/claude");

          // Build per-goal stats for the AI summary
          const goalStatsMap = new Map<string, { title: string; tasksCompleted: number; tasksTotal: number }>();
          for (const dt of dailyTasks) {
            const title = dt.goal?.title ?? "Unknown";
            const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as TaskItem[]) : [];
            const existing = goalStatsMap.get(dt.goalId) ?? { title, tasksCompleted: 0, tasksTotal: 0 };
            existing.tasksCompleted += items.filter(t => t.isCompleted).length;
            existing.tasksTotal += items.length;
            goalStatsMap.set(dt.goalId, existing);
          }

          const insight = await generateWeeklySummary({
            goalsWorkedOn: Array.from(goalStatsMap.values()),
            totalTasksCompleted: totalCompleted,
            totalTasksGenerated: totalTasks,
            totalMinutesInvested: totalMinutes,
            currentStreak: 0,
            dailyBreakdown,
          });
          summary.insight = insight;
        } catch (e) {
          console.error("[weekly insight]", e);
          summary.insight = null;
        }
      }
    }

    return NextResponse.json(summary);
  } catch (e) {
    console.error("[/api/summary/weekly]", e);
    return NextResponse.json({ error: "Failed to generate weekly summary" }, { status: 500 });
  }
}
