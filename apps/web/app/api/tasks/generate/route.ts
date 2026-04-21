import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnyUserFromRequest } from "@/lib/supabase";
import { getUserAccess } from "@/lib/subscription";
import { getTasksForDay, LIBRARIES, type PathId } from "@threely/tasks";

export const maxDuration = 10;

// Stored inside DailyTask.tasks (JSON). Mirrors the old claude.ts shape so the
// mobile/web clients don't need to change anything about rendering.
interface TaskItem {
  id: string;
  task: string;
  description: string;
  estimated_minutes: number;
  goal_id: string;
  why: string;
  isCompleted: boolean;
  isSkipped?: boolean;
  isRescheduled?: boolean;
  isCarriedOver?: boolean;
  carriedFromDate?: string;
}

// POST /api/tasks/generate
// Body: { goalId?, localDate?, onboarding? }
// Pulls the 3 tasks for today from the pre-written path library (no LLM).
// Day number advances based on completion count, not calendar days — if the
// user skips a day, they continue where they left off.
export async function POST(request: NextRequest) {
  const user = await getAnyUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { goalId, localDate, onboarding } = body as {
    goalId?: string;
    localDate?: string;
    onboarding?: boolean;
  };

  if (!user.isAnonymous && !onboarding) {
    const access = await getUserAccess(user.id);
    if (!access.hasPro) {
      return NextResponse.json({
        error: "pro_required",
        message: "Subscribe to keep your momentum going",
        trialEndsAt: access.trialEndsAt?.toISOString() ?? null,
      }, { status: 403 });
    }
  }

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const today = localDate ? new Date(localDate) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  const jsDay = today.getUTCDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  const allGoals = await prisma.goal.findMany({
    where: {
      userId: user.id,
      isActive: true,
      isPaused: false,
      ...(goalId ? { id: goalId } : {}),
    },
  });

  if (allGoals.length === 0) {
    return NextResponse.json({ error: "No active goals found" }, { status: 404 });
  }

  // Work-days filter: honor the goal's schedule unless a specific goalId forced it
  const goals = goalId
    ? allGoals
    : allGoals.filter(g => {
        const workDays: number[] = (g.workDays as number[]) ?? [1, 2, 3, 4, 5, 6, 7];
        return workDays.includes(isoDay);
      });

  if (goals.length === 0) {
    return NextResponse.json({ dailyTasks: [], restDay: true }, { status: 200 });
  }

  try {
    const results = await Promise.all(
      goals.map(async (goal) => {
        const existing = await prisma.dailyTask.findUnique({
          where: { goalId_date: { goalId: goal.id, date: today } },
        });

        // Already have today's task set — return it untouched
        if (existing) return { dailyTask: existing };

        // goal.category stores the library path id (e.g. "daytrading_beginner").
        // Legacy clients may still pass the short category name — fall back to a
        // sensible default path per category so nothing breaks mid-rollout.
        const LEGACY_CATEGORY_FALLBACK: Record<string, PathId> = {
          daytrading: "daytrading_beginner",
          business: "business_ecommerce",
          health: "health_general",
          fitness: "health_general",
          wealth: "business_ecommerce",
        };
        let pathId = goal.category as PathId | null;
        if (pathId && !(pathId in LIBRARIES) && LEGACY_CATEGORY_FALLBACK[pathId]) {
          pathId = LEGACY_CATEGORY_FALLBACK[pathId];
        }
        if (!pathId || !(pathId in LIBRARIES)) {
          throw new Error(`Goal ${goal.id} has no valid library path (category="${goal.category}")`);
        }

        // Day number = (fully-completed prior days) + 1 — completion-based progression
        const priorTasks = await prisma.dailyTask.findMany({
          where: { goalId: goal.id, userId: user.id, date: { lt: today } },
          orderBy: { date: "asc" },
        });
        const completedDays = priorTasks.filter(dt => {
          const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as { isCompleted: boolean }[]) : [];
          return items.length > 0 && items.every(t => t.isCompleted);
        }).length;
        const dayNumber = completedDays + 1;

        const libraryDay = getTasksForDay(pathId, dayNumber, user.id);
        if (!libraryDay) {
          throw new Error(`No library entry for ${pathId} day ${dayNumber}`);
        }

        // Carry-over: grab up to 3 incomplete/non-skipped tasks from the last 7 days
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentTasks = await prisma.dailyTask.findMany({
          where: { goalId: goal.id, userId: user.id, date: { gte: sevenDaysAgo, lt: today } },
          orderBy: { date: "desc" },
        });

        const carriedOverItems: TaskItem[] = [];
        for (const dt of recentTasks) {
          if (carriedOverItems.length >= 3) break;
          const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as TaskItem[]) : [];
          for (const item of items) {
            if (carriedOverItems.length >= 3) break;
            if (!item.isCompleted && !item.isSkipped && !item.isRescheduled) {
              carriedOverItems.push({
                ...item,
                id: `task-${Date.now()}-co-${carriedOverItems.length}`,
                isCarriedOver: true,
                carriedFromDate: new Date(dt.date).toISOString().split("T")[0],
              });
            }
          }
        }

        // Mark carried-over originals as rescheduled so they don't pile up again tomorrow
        if (carriedOverItems.length > 0) {
          const carriedDates = new Set(carriedOverItems.map(t => t.carriedFromDate));
          for (const dt of recentTasks) {
            const dtDate = new Date(dt.date).toISOString().split("T")[0];
            if (!carriedDates.has(dtDate)) continue;
            const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as TaskItem[]) : [];
            const carriedNames = new Set(carriedOverItems.filter(c => c.carriedFromDate === dtDate).map(c => c.task));
            let updated = false;
            const newItems = items.map(item => {
              if (!item.isCompleted && !item.isSkipped && !item.isRescheduled && carriedNames.has(item.task)) {
                updated = true;
                return { ...item, isRescheduled: true };
              }
              return item;
            });
            if (updated) {
              await prisma.dailyTask.update({ where: { id: dt.id }, data: { tasks: newItems as never } });
            }
          }
        }

        // Library tasks for today (3 of them). Fill remaining slots after carry-overs.
        const libraryTasks: TaskItem[] = libraryDay.tasks.map((t, i) => ({
          id: `task-${Date.now()}-${i}`,
          task: t.task,
          description: "",
          estimated_minutes: t.minutes,
          goal_id: goal.id,
          why: t.why,
          isCompleted: false,
        }));

        const newCount = Math.max(0, 3 - carriedOverItems.length);
        const combinedTasks = [...carriedOverItems, ...libraryTasks.slice(0, newCount)];

        let dailyTask;
        try {
          dailyTask = await prisma.dailyTask.create({
            data: {
              userId: user.id,
              goalId: goal.id,
              date: today,
              tasks: combinedTasks as never,
            },
          });
        } catch (e: unknown) {
          // Unique-constraint race → re-fetch the row the other caller created
          if (e instanceof Error && e.message.includes("Unique constraint")) {
            dailyTask = await prisma.dailyTask.findUnique({
              where: { goalId_date: { goalId: goal.id, date: today } },
            });
            if (!dailyTask) throw e;
          } else {
            throw e;
          }
        }

        return { dailyTask };
      })
    );

    const dailyTasks = results.map(r => r.dailyTask);
    return NextResponse.json({ dailyTasks }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/tasks/generate]", msg, e);
    return NextResponse.json({ error: msg || "Failed to generate tasks" }, { status: 500 });
  }
}
