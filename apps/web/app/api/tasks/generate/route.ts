import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnyUserFromRequest } from "@/lib/supabase";
import { generateTasks, type TaskItem } from "@/lib/claude";
import { getUserAccess } from "@/lib/subscription";
import { checkAnonRateLimit, getClientIp } from "@/lib/anon-rate-limit";

export const maxDuration = 30;

// POST /api/tasks/generate
// Body: { goalId?, requestingAdditional?, focusShifted?, postReview? }
// - goalId omitted → generates for ALL active goals
// - requestingAdditional: true → generates 3 stretch tasks appended to existing
// - focusShifted: true → user just switched focus to this goal
// - postReview: true → generate with review feedback as context
export async function POST(request: NextRequest) {
  const user = await getAnyUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { goalId, localDate, requestingAdditional, focusShifted, postReview, onboarding } = body as {
    goalId?: string;
    localDate?: string;
    requestingAdditional?: boolean;
    focusShifted?: boolean;
    postReview?: boolean;
    onboarding?: boolean;
  };

  if (user.isAnonymous) {
    // Anon users — only initial generation allowed (no requestingAdditional / postReview)
    if (requestingAdditional || postReview) {
      return NextResponse.json({ error: "Sign up to generate more tasks", message: "Sign up to keep going" }, { status: 403 });
    }
    const ip = getClientIp(request);
    const { allowed: ipAllowed } = checkAnonRateLimit(ip);
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many requests from this IP. Try again tomorrow or sign up." }, { status: 429 });
    }
  } else if (!onboarding && (requestingAdditional || postReview)) {
    // Pro gate for real users
    const access = await getUserAccess(user.id);
    if (!access.hasPro) {
      return NextResponse.json({
        error: "pro_required",
        message: "Subscribe to keep your momentum going",
        trialEndsAt: access.trialEndsAt?.toISOString() ?? null,
      }, { status: 403 });
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  // Use client's local date if provided, otherwise fall back to UTC midnight
  const today = localDate ? new Date(localDate) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Compute day-of-week from localDate: 1=Mon..7=Sun (ISO standard)
  const jsDay = today.getUTCDay(); // 0=Sun..6=Sat
  const isoDay = jsDay === 0 ? 7 : jsDay; // convert to 1=Mon..7=Sun

  // Determine time of day for task calibration
  const currentHour = new Date().getUTCHours();
  const timeOfDay: "morning" | "afternoon" | "evening" =
    currentHour < 12 ? "morning" : currentHour < 17 ? "afternoon" : "evening";

  // Load user profile for coaching context
  const profileRecord = await prisma.userProfile.findUnique({ where: { userId: user.id } });

  // Resolve which goals to generate for
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

  // Work days filter: only include goals scheduled for today
  // Skip filter when a specific goalId is provided (goal creation / onboarding always generates)
  const goals = goalId
    ? allGoals
    : allGoals.filter(g => {
        const workDays: number[] = (g.workDays as number[]) ?? [1, 2, 3, 4, 5, 6, 7];
        return workDays.includes(isoDay);
      });

  // Rest day: no goals scheduled for today (only when generating for all goals)
  if (goals.length === 0) {
    return NextResponse.json({ dailyTasks: [], restDay: true }, { status: 200 });
  }

  // Compute aggregate stats across all goals
  const allHistory = await prisma.dailyTask.findMany({
    where: { userId: user.id },
    select: { date: true, tasks: true, goalId: true },
  });

  const daysActive = new Set(
    allHistory.map((dt) => new Date(dt.date).toDateString())
  ).size;

  const tasksCompletedTotal = allHistory.reduce((sum, dt) => {
    const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as { isCompleted: boolean }[]) : [];
    return sum + items.filter((t) => t.isCompleted).length;
  }, 0);

  // Collect compact task history (last 7 days) with descriptions for AI context
  const sevenDaysAgoGlobal = new Date(today);
  sevenDaysAgoGlobal.setDate(sevenDaysAgoGlobal.getDate() - 7);
  const recentTaskHistory = allHistory
    .filter((dt) => new Date(dt.date) >= sevenDaysAgoGlobal)
    .flatMap((dt) => {
      const daysAgo = Math.round((today.getTime() - new Date(dt.date).getTime()) / (1000 * 60 * 60 * 24));
      const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as { task: string; description: string; isCompleted: boolean }[]) : [];
      return items.filter(t => t.task).map(t => ({
        daysAgo,
        task: t.task,
        description: t.description ?? "",
        completed: !!t.isCompleted,
      }));
    });

  // ── Generation limit: 1 extra generation per goal per day ─────────────────
  if (requestingAdditional || postReview) {
    for (const goal of goals) {
      const existing = await prisma.dailyTask.findUnique({
        where: { goalId_date: { goalId: goal.id, date: today } },
      });
      if (existing) {
        const existingTasks = Array.isArray(existing.tasks)
          ? (existing.tasks as unknown as { id: string }[])
          : [];
        if (existingTasks.length > 3) {
          return NextResponse.json({
            error: "generation_limit_reached",
            message: "You've already gotten extra tasks for this goal today.",
          }, { status: 403 });
        }
      }
    }
  }

  try {
  const results = await Promise.all(
    goals.map(async (goal) => {
      const existing = await prisma.dailyTask.findUnique({
        where: { goalId_date: { goalId: goal.id, date: today } },
      });

      // Return existing unchanged unless we're adding/replacing tasks
      if (existing && !requestingAdditional && !postReview) {
        return { dailyTask: existing, coachNote: undefined };
      }

      // Per-goal profile: goal-level overrides fall back to global UserProfile
      const goalProfile = {
        dailyTimeMinutes: goal.dailyTimeMinutes ?? profileRecord?.dailyTimeMinutes ?? 60,
        intensityLevel: goal.intensityLevel ?? profileRecord?.intensityLevel ?? 2,
      };

      // ── Carry-forward logic (skip for requestingAdditional / postReview) ──
      let carriedOverItems: TaskItem[] = [];
      let newTaskCount = 3;

      if (!requestingAdditional && !postReview && !existing) {
        // Query last 7 days of DailyTask for this goal
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentTasks = await prisma.dailyTask.findMany({
          where: {
            goalId: goal.id,
            userId: user.id,
            date: { gte: sevenDaysAgo, lt: today },
          },
          orderBy: { date: "desc" },
        });

        // Extract incomplete, non-skipped, non-rescheduled items (up to 3)
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

        // Mark originals as rescheduled so they don't get carried over again
        if (carriedOverItems.length > 0) {
          const sourceTaskIds = new Set(carriedOverItems.map(t => {
            // Extract the original ID pattern from carriedFromDate + task name matching
            return t.carriedFromDate;
          }));

          for (const dt of recentTasks) {
            const dtDate = new Date(dt.date).toISOString().split("T")[0];
            if (!sourceTaskIds.has(dtDate)) continue;

            const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as TaskItem[]) : [];
            const carriedTaskNames = new Set(carriedOverItems
              .filter(c => c.carriedFromDate === dtDate)
              .map(c => c.task));

            let updated = false;
            const newItems = items.map(item => {
              if (!item.isCompleted && !item.isSkipped && !item.isRescheduled && carriedTaskNames.has(item.task)) {
                updated = true;
                return { ...item, isRescheduled: true };
              }
              return item;
            });

            if (updated) {
              await prisma.dailyTask.update({
                where: { id: dt.id },
                data: { tasks: newItems as never },
              });
            }
          }
        }

        newTaskCount = 3 - carriedOverItems.length;
      }

      // If all 3 slots filled by carry-forward, no AI call needed
      let aiTasks: TaskItem[] = [];
      let coachNote: string | undefined;

      if (newTaskCount > 0) {
        // Compute per-goal completion stats
        const goalHistory = allHistory.filter((dt) => (dt as unknown as { goalId: string }).goalId === goal.id);
        const goalTotalGenerated = goalHistory.reduce((sum, dt) => {
          const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as { isCompleted: boolean }[]) : [];
          return sum + items.length;
        }, 0);
        const goalTotalCompleted = goalHistory.reduce((sum, dt) => {
          const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as { isCompleted: boolean }[]) : [];
          return sum + items.filter(t => t.isCompleted).length;
        }, 0);
        const goalCompletionRate = goalTotalGenerated > 0 ? Math.round((goalTotalCompleted / goalTotalGenerated) * 100) : 0;

        const result = await generateTasks({
          goal: {
            id: goal.id,
            title: goal.title,
            rawInput: goal.rawInput,
            structuredSummary: goal.structuredSummary ?? null,
            category: goal.category ?? null,
            deadline: goal.deadline ?? null,
            createdAt: goal.createdAt,
            roadmap: goal.roadmap ?? null,
          },
          profile: goalProfile,
          daysActive,
          tasksCompletedTotal,
          coachingContext: (profileRecord?.coachingContext as unknown as import("@/lib/claude").CoachingContext) ?? null,
          requestingAdditional,
          focusShifted,
          postReview,
          timeOfDay,
          carriedOverTasks: carriedOverItems.length > 0
            ? carriedOverItems.map(t => ({ task: t.task, description: t.description, why: t.why }))
            : undefined,
          newTaskCount,
          previousTasks: recentTaskHistory,
          goalCompletionStats: {
            totalGenerated: goalTotalGenerated,
            totalCompleted: goalTotalCompleted,
            completionRate: goalCompletionRate,
          },
          userId: user.id,
        });

        aiTasks = result.tasks;
        coachNote = result.coach_note;
      }

      // Combine: carried-over first, then new AI tasks
      const combinedTasks = [...carriedOverItems, ...aiTasks];

      let dailyTask;

      if (existing && requestingAdditional) {
        const existingTasks = Array.isArray(existing.tasks)
          ? (existing.tasks as unknown as TaskItem[])
          : [];
        const mergedTasks = [...existingTasks, ...aiTasks];
        dailyTask = await prisma.dailyTask.update({
          where: { goalId_date: { goalId: goal.id, date: today } },
          data: { tasks: mergedTasks as never, generatedAt: new Date() },
        });
      } else if (existing && postReview) {
        // Keep completed/skipped tasks and append fresh set
        const existingTasks = Array.isArray(existing.tasks)
          ? (existing.tasks as unknown as TaskItem[])
          : [];
        const completedTasks = existingTasks.filter(t => t.isCompleted || t.isSkipped);
        const mergedTasks = [...completedTasks, ...aiTasks];
        dailyTask = await prisma.dailyTask.update({
          where: { goalId_date: { goalId: goal.id, date: today } },
          data: { tasks: mergedTasks as never, generatedAt: new Date(), isCompleted: false },
        });
      } else {
        // New record — includes carried-over + AI tasks
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
          // Unique constraint race condition — re-fetch existing
          if (e instanceof Error && e.message.includes("Unique constraint")) {
            dailyTask = await prisma.dailyTask.findUnique({
              where: { goalId_date: { goalId: goal.id, date: today } },
            });
            if (!dailyTask) throw e;
          } else {
            throw e;
          }
        }
      }

      return { dailyTask, coachNote };
    })
  );

  const dailyTasks = results.map((r) => r.dailyTask);
  const coachNote = results.find((r) => r.coachNote)?.coachNote;

  return NextResponse.json(
    { dailyTasks, ...(coachNote ? { coachNote } : {}) },
    { status: 201 }
  );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("Request timed out");
    console.error("[/api/tasks/generate]", msg, e);
    if (isTimeout) {
      return NextResponse.json({ error: "The AI took too long to respond. Please try again." }, { status: 504 });
    }
    return NextResponse.json({ error: msg || "Failed to generate tasks" }, { status: 500 });
  }
}
