import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

interface TaskItem {
  id: string;
  isCompleted: boolean;
  isSkipped?: boolean;
  isRescheduled?: boolean;
}

// GET /api/tasks?date=YYYY-MM-DD&includeOverdue=true  — fetch today's (or a given date's) daily tasks
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const includeOverdue = searchParams.get("includeOverdue") === "true";

    // Default to today (UTC midnight)
    const date = dateParam ? new Date(dateParam) : new Date();
    date.setUTCHours(0, 0, 0, 0);

    const dailyTasks = await prisma.dailyTask.findMany({
      where: { userId: user.id, date },
      include: {
        goal: { select: { id: true, title: true, description: true } },
        review: { select: { id: true, difficultyRating: true, completionStatus: true, userNote: true, insight: true } },
      },
      orderBy: { generatedAt: "asc" },
    });

    let overdueTasks: typeof dailyTasks = [];
    if (includeOverdue) {
      const sevenDaysAgo = new Date(date);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const overdueAll = await prisma.dailyTask.findMany({
        where: {
          userId: user.id,
          date: { gte: sevenDaysAgo, lt: date },
        },
        include: {
          goal: { select: { id: true, title: true, description: true } },
          review: { select: { id: true, difficultyRating: true, completionStatus: true, userNote: true, insight: true } },
        },
        orderBy: { date: "desc" },
      });
      // Only include tasks that have at least one incomplete, non-skipped, non-rescheduled item
      overdueTasks = overdueAll.filter((dt) => {
        const items = dt.tasks as unknown as TaskItem[];
        return items.some((t) => !t.isCompleted && !t.isSkipped && !t.isRescheduled);
      });
    }

    // Check if today is a rest day (no goals scheduled for today's day-of-week)
    let restDay = false;
    if (dailyTasks.length === 0) {
      const jsDay = date.getUTCDay(); // 0=Sun..6=Sat
      const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun
      const activeGoals = await prisma.goal.findMany({
        where: { userId: user.id, isActive: true, isPaused: false },
        select: { workDays: true },
      });
      if (activeGoals.length > 0) {
        const anyScheduled = activeGoals.some(g => {
          const workDays: number[] = (g.workDays as number[]) ?? [1, 2, 3, 4, 5, 6, 7];
          return workDays.includes(isoDay);
        });
        restDay = !anyScheduled;
      }
    }

    return NextResponse.json({ dailyTasks, overdueTasks, restDay });
  } catch (e) {
    console.error("[GET /api/tasks]", e);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}
