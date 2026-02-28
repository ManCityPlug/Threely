import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface TaskItem {
  id: string;
  isCompleted: boolean;
  isSkipped?: boolean;
  isRescheduled?: boolean;
  isCarriedOver?: boolean;
}

// GET /api/stats/heatmap?days=90&tz=360
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") ?? "90", 10), 365);
    const tz = parseInt(searchParams.get("tz") ?? "0", 10); // client timezone offset in minutes
    const tzOffsetMs = tz * 60 * 1000;

    // Extend query range by 1 day to account for timezone differences
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days - 1);

    const dailyTasks = await prisma.dailyTask.findMany({
      where: { userId: user.id, date: { gte: since } },
      select: { date: true, goalId: true, tasks: true, generatedAt: true },
    });

    // Group by the task's date column — count ALL goals' tasks for each day
    const byDate = new Map<string, { completed: number; total: number }>();

    for (const dt of dailyTasks) {
      const key = new Date(dt.date).toISOString().split("T")[0];
      const allItems = Array.isArray(dt.tasks) ? (dt.tasks as unknown as TaskItem[]) : [];

      // Filter out rescheduled and skipped items — they shouldn't count
      const items = allItems.filter(t => !t.isRescheduled && !t.isSkipped);

      const existing = byDate.get(key) ?? { completed: 0, total: 0 };
      existing.completed += items.filter(t => t.isCompleted).length;
      existing.total += items.length;
      byDate.set(key, existing);
    }

    // Build heatmap array for every day in range, using client's local "today"
    const heatmap: { date: string; completed: number; total: number; percentage: number }[] = [];
    const nowLocal = new Date(Date.now() - tzOffsetMs);
    const todayKey = nowLocal.toISOString().split("T")[0];

    // Parse todayKey back to iterate dates cleanly
    const todayDate = new Date(todayKey + "T00:00:00Z");

    for (let i = days; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().split("T")[0];
      const entry = byDate.get(key) ?? { completed: 0, total: 0 };
      heatmap.push({
        date: key,
        completed: entry.completed,
        total: entry.total,
        percentage: entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 0,
      });
    }

    return NextResponse.json({ heatmap }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    console.error("[/api/stats/heatmap]", e);
    return NextResponse.json({ error: "Failed to fetch heatmap data" }, { status: 500 });
  }
}
