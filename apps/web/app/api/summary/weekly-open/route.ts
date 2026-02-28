import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getUserAccess } from "@/lib/subscription";

interface TaskItem {
  isCompleted: boolean;
  isSkipped?: boolean;
  estimated_minutes?: number;
}

function getWeekBoundaries(tz: string) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const localDateStr = formatter.format(now);
  const [y, m, d] = localDateStr.split("-").map(Number);
  const localDate = new Date(y, m - 1, d);

  const dow = localDate.getDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;

  const thisMonday = new Date(localDate);
  thisMonday.setDate(thisMonday.getDate() - daysSinceMonday);

  const previousWeekStart = new Date(thisMonday);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const previousWeekEnd = new Date(thisMonday);

  return { previousWeekStart, previousWeekEnd, thisMonday };
}

// POST /api/summary/weekly-open
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Pro gate
    const access = await getUserAccess(user.id);
    if (!access.hasPro) {
      return NextResponse.json({
        error: "pro_required",
        message: "Subscribe to keep your momentum going",
        trialEndsAt: access.trialEndsAt?.toISOString() ?? null,
      }, { status: 403 });
    }

    const body = await request.json();
    const tz = body.tz || "UTC";

    const { previousWeekStart, previousWeekEnd } = getWeekBoundaries(tz);

    // Check if already exists
    const existing = await prisma.weeklySummary.findUnique({
      where: {
        userId_weekStart: { userId: user.id, weekStart: previousWeekStart },
      },
    });

    if (existing) {
      // Mark as opened if not yet
      if (!existing.firstOpenedAt) {
        await prisma.weeklySummary.update({
          where: { id: existing.id },
          data: { firstOpenedAt: new Date() },
        });
      }
      return NextResponse.json({
        ...existing.stats as object,
        insight: existing.insight,
      });
    }

    // Generate fresh summary from DailyTask data for the previous week
    const dailyTasks = await prisma.dailyTask.findMany({
      where: {
        userId: user.id,
        date: { gte: previousWeekStart, lt: previousWeekEnd },
      },
      include: {
        goal: { select: { id: true, title: true } },
      },
      orderBy: { date: "asc" },
    });

    // Compute stats
    let totalCompleted = 0;
    let totalTasks = 0;
    let totalMinutes = 0;
    const goalsWorkedOn = new Set<string>();
    const byDate = new Map<string, { completed: number; total: number }>();
    const goalStatsMap = new Map<string, { title: string; completed: number; total: number }>();

    for (const dt of dailyTasks) {
      const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as TaskItem[]) : [];
      const completed = items.filter((t) => t.isCompleted).length;
      const total = items.length;

      totalCompleted += completed;
      totalTasks += total;
      totalMinutes += items
        .filter((t) => t.isCompleted)
        .reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
      goalsWorkedOn.add(dt.goalId);

      // Daily breakdown
      const key = new Date(dt.date).toISOString().split("T")[0];
      const existing = byDate.get(key) ?? { completed: 0, total: 0 };
      existing.completed += completed;
      existing.total += total;
      byDate.set(key, existing);

      // Goal breakdown (frozen with title at generation time)
      const title = dt.goal?.title ?? "Deleted goal";
      const goalStats = goalStatsMap.get(dt.goalId) ?? { title, completed: 0, total: 0 };
      goalStats.completed += completed;
      goalStats.total += total;
      goalStatsMap.set(dt.goalId, goalStats);
    }

    const dailyBreakdown = Array.from(byDate.entries()).map(([date, s]) => ({
      date,
      ...s,
    }));
    const goalBreakdown = Array.from(goalStatsMap.values());
    const hoursInvested = Math.round((totalMinutes / 60) * 10) / 10;
    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    const stats = {
      tasksCompleted: totalCompleted,
      tasksGenerated: totalTasks,
      hoursInvested,
      goalsWorkedOn: goalsWorkedOn.size,
      completionRate,
      dailyBreakdown,
      goalBreakdown,
    };

    // Generate AI insight
    let insight: string | null = null;
    const { allowed } = checkRateLimit(user.id);
    if (allowed && totalTasks > 0) {
      try {
        const { generateWeeklySummary } = await import("@/lib/claude");
        insight = await generateWeeklySummary({
          goalsWorkedOn: goalBreakdown.map((g) => ({
            title: g.title,
            tasksCompleted: g.completed,
            tasksTotal: g.total,
          })),
          totalTasksCompleted: totalCompleted,
          totalTasksGenerated: totalTasks,
          totalMinutesInvested: totalMinutes,
          currentStreak: 0,
          dailyBreakdown,
        });
      } catch (e) {
        console.error("[weekly-open insight]", e);
      }
    }

    // Persist frozen snapshot
    await prisma.weeklySummary.create({
      data: {
        userId: user.id,
        weekStart: previousWeekStart,
        stats,
        insight,
        timezone: tz,
        firstOpenedAt: new Date(),
      },
    });

    return NextResponse.json({ ...stats, insight });
  } catch (e) {
    console.error("[/api/summary/weekly-open]", e);
    return NextResponse.json({ error: "Failed to generate weekly summary" }, { status: 500 });
  }
}
