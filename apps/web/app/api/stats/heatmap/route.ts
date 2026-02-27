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

// Convert a full timestamp to a local date string using timezone offset
// tz = getTimezoneOffset() from client (positive for west of UTC)
function toLocalDateKey(timestamp: Date, tzOffsetMs: number): string {
  const local = new Date(timestamp.getTime() - tzOffsetMs);
  return local.toISOString().split("T")[0];
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

    const [dailyTasks, dailyFocusRecords] = await Promise.all([
      prisma.dailyTask.findMany({
        where: { userId: user.id, date: { gte: since } },
        select: { date: true, goalId: true, tasks: true, generatedAt: true },
      }),
      prisma.dailyFocus.findMany({
        where: { userId: user.id, date: { gte: since } },
        select: { date: true, focusGoalId: true, shuffleTaskIds: true, createdAt: true },
      }),
    ]);

    // Index focus records by date (the DB `date` column is the canonical day)
    const focusByDate = new Map<string, { focusGoalId: string; shuffleTaskIds: string[] | null }>();
    for (const f of dailyFocusRecords) {
      const key = new Date(f.date).toISOString().split("T")[0];
      focusByDate.set(key, {
        focusGoalId: f.focusGoalId,
        shuffleTaskIds: Array.isArray(f.shuffleTaskIds) ? (f.shuffleTaskIds as string[]) : null,
      });
    }

    // Group by the task's date column (the canonical day), filtering by focus
    // Also track which dates have no focus record so we can cap them
    const byDate = new Map<string, { completed: number; total: number }>();
    const datesWithoutFocus = new Set<string>();

    for (const dt of dailyTasks) {
      const key = new Date(dt.date).toISOString().split("T")[0];
      const focus = focusByDate.get(key);
      const allItems = Array.isArray(dt.tasks) ? (dt.tasks as unknown as TaskItem[]) : [];

      // Filter out rescheduled and skipped items — they shouldn't count
      const items = allItems.filter(t => !t.isRescheduled && !t.isSkipped);

      let relevantItems: TaskItem[];

      if (!focus) {
        // No DailyFocus record (pre-feature data) — count tasks but track for capping
        relevantItems = items;
        datesWithoutFocus.add(key);
      } else if (focus.focusGoalId === "shuffle") {
        // Shuffle mode — only count tasks whose IDs are in shuffleTaskIds
        if (focus.shuffleTaskIds && focus.shuffleTaskIds.length > 0) {
          const idSet = new Set(focus.shuffleTaskIds);
          relevantItems = items.filter(t => idSet.has(t.id));
        } else {
          // No shuffle IDs saved — fall back to counting all
          relevantItems = items;
        }
      } else if (dt.goalId === focus.focusGoalId) {
        // Focused on a specific goal — only count that goal's tasks
        relevantItems = items;
      } else {
        // This DailyTask is for a non-focused goal — skip it
        continue;
      }

      const existing = byDate.get(key) ?? { completed: 0, total: 0 };
      existing.completed += relevantItems.filter(t => t.isCompleted).length;
      existing.total += relevantItems.length;
      byDate.set(key, existing);
    }

    // For dates without a DailyFocus record (pre-feature or edge case),
    // cap the total at 3 to avoid inflating from multiple goals
    for (const key of datesWithoutFocus) {
      const entry = byDate.get(key);
      if (entry && entry.total > 3) {
        entry.total = 3;
        entry.completed = Math.min(entry.completed, 3);
      }
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
