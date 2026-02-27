import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getCachedStats, setCachedStats } from "@/lib/stats-cache";

interface TaskItem {
  id: string;
  isCompleted: boolean;
  isSkipped?: boolean;
}

interface GoalStat {
  goalId: string;
  title: string;
  lastWorkedAt: string | null;
  overdueCount: number;
  dailyTimeMinutes: number | null;
  lifetimeCompleted: number;
  lifetimeTotal: number;
}

// GET /api/stats — returns aggregate stats for the authenticated user
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cached = getCachedStats(user.id);
  if (cached) return NextResponse.json(cached);

  const [allDailyTasks, activeGoals, activeGoalsList] = await Promise.all([
    prisma.dailyTask.findMany({ where: { userId: user.id } }),
    prisma.goal.count({ where: { userId: user.id, isActive: true } }),
    prisma.goal.findMany({ where: { userId: user.id, isActive: true }, select: { id: true, title: true, dailyTimeMinutes: true } }),
  ]);

  // Total completed task items + total hours invested
  let totalCompleted = 0;
  let totalMinutesInvested = 0;
  for (const dt of allDailyTasks) {
    const tasks = dt.tasks as unknown as (TaskItem & { estimated_minutes?: number })[];
    for (const t of tasks) {
      if (t.isCompleted) {
        totalCompleted++;
        totalMinutesInvested += t.estimated_minutes ?? 0;
      }
    }
  }
  const totalHoursInvested = Math.round((totalMinutesInvested / 60) * 10) / 10;

  // Current streak: consecutive days (back from today) where ≥1 task was completed
  const tasksByDate = new Map<string, typeof allDailyTasks>();
  for (const dt of allDailyTasks) {
    const key = new Date(dt.date).toISOString().split("T")[0];
    if (!tasksByDate.has(key)) tasksByDate.set(key, []);
    tasksByDate.get(key)!.push(dt);
  }

  let streak = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const dayTasks = tasksByDate.get(key);
    if (!dayTasks) break;
    const hasCompleted = dayTasks.some((dt) =>
      (dt.tasks as unknown as TaskItem[]).some((t) => t.isCompleted)
    );
    if (!hasCompleted) break;
    streak++;
  }

  // Best streak: longest run of consecutive days with at least one completed task
  let bestStreak = streak;
  const allDateKeys = Array.from(tasksByDate.keys()).sort();
  if (allDateKeys.length > 0) {
    let currentRun = 0;
    let prevDate: Date | null = null;
    for (const key of allDateKeys) {
      const dayTasks = tasksByDate.get(key)!;
      const hasCompleted = dayTasks.some((dt) =>
        (dt.tasks as unknown as TaskItem[]).some((t) => t.isCompleted)
      );
      if (hasCompleted) {
        const thisDate = new Date(key + "T00:00:00Z");
        if (prevDate) {
          const diffDays = Math.round((thisDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          currentRun = diffDays === 1 ? currentRun + 1 : 1;
        } else {
          currentRun = 1;
        }
        prevDate = thisDate;
        if (currentRun > bestStreak) bestStreak = currentRun;
      } else {
        currentRun = 0;
        prevDate = null;
      }
    }
  }

  // Per-goal stats: lastWorkedAt + overdueCount
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split("T")[0];

  const goalStats: GoalStat[] = activeGoalsList.map((goal) => {
    const goalTasks = allDailyTasks.filter((dt) => dt.goalId === goal.id);

    // Last worked at: most recent date with at least one completed task
    let lastWorkedAt: string | null = null;
    for (const dt of goalTasks) {
      const items = dt.tasks as unknown as TaskItem[];
      if (items.some((t) => t.isCompleted)) {
        const dateStr = new Date(dt.date).toISOString().split("T")[0];
        if (!lastWorkedAt || dateStr > lastWorkedAt) lastWorkedAt = dateStr;
      }
    }

    // Overdue count: incomplete + not-skipped items from yesterday
    let overdueCount = 0;
    const yesterdayTasks = goalTasks.filter(
      (dt) => new Date(dt.date).toISOString().split("T")[0] === yesterdayKey
    );
    for (const dt of yesterdayTasks) {
      const items = dt.tasks as unknown as TaskItem[];
      overdueCount += items.filter((t) => !t.isCompleted && !t.isSkipped).length;
    }

    // Lifetime task completion counts
    let lifetimeCompleted = 0;
    let lifetimeTotal = 0;
    for (const dt of goalTasks) {
      const items = dt.tasks as unknown as TaskItem[];
      lifetimeTotal += items.length;
      lifetimeCompleted += items.filter((t) => t.isCompleted).length;
    }

    return {
      goalId: goal.id,
      title: goal.title,
      lastWorkedAt,
      overdueCount,
      dailyTimeMinutes: goal.dailyTimeMinutes,
      lifetimeCompleted,
      lifetimeTotal,
    };
  });

  const result = { totalCompleted, activeGoals, streak, bestStreak, totalHoursInvested, goalStats };
  setCachedStats(user.id, result);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
