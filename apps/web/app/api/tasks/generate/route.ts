import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { generateTasks, type TaskItem } from "@/lib/claude";

// POST /api/tasks/generate
// Body: { goalId?, requestingAdditional?, focusShifted?, postReview? }
// - goalId omitted → generates for ALL active goals
// - requestingAdditional: true → generates 3 stretch tasks appended to existing
// - focusShifted: true → user just switched focus to this goal
// - postReview: true → generate with review feedback as context
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const { goalId, requestingAdditional, focusShifted, postReview } = body as {
    goalId?: string;
    requestingAdditional?: boolean;
    focusShifted?: boolean;
    postReview?: boolean;
  };

  // Today at UTC midnight
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Determine time of day for task calibration
  const currentHour = new Date().getUTCHours();
  const timeOfDay: "morning" | "afternoon" | "evening" =
    currentHour < 12 ? "morning" : currentHour < 17 ? "afternoon" : "evening";

  // Load user profile for coaching context
  const profileRecord = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  const userProfile = {
    dailyTimeMinutes: profileRecord?.dailyTimeMinutes ?? 60,
    intensityLevel: profileRecord?.intensityLevel ?? 2,
  };

  // Resolve which goals to generate for
  const goals = await prisma.goal.findMany({
    where: {
      userId: user.id,
      isActive: true,
      isPaused: false,
      ...(goalId ? { id: goalId } : {}),
    },
  });

  if (goals.length === 0) {
    return NextResponse.json({ error: "No active goals found" }, { status: 404 });
  }

  // Compute aggregate stats across all goals
  const allHistory = await prisma.dailyTask.findMany({
    where: { userId: user.id },
    select: { date: true, tasks: true },
  });

  const daysActive = new Set(
    allHistory.map((dt) => new Date(dt.date).toDateString())
  ).size;

  const tasksCompletedTotal = allHistory.reduce((sum, dt) => {
    const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as { isCompleted: boolean }[]) : [];
    return sum + items.filter((t) => t.isCompleted).length;
  }, 0);

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

      const result = await generateTasks({
        goal: {
          id: goal.id,
          title: goal.title,
          rawInput: goal.rawInput,
          structuredSummary: goal.structuredSummary ?? null,
          category: goal.category ?? null,
          deadline: goal.deadline ?? null,
          createdAt: goal.createdAt,
        },
        profile: goalProfile,
        daysActive,
        tasksCompletedTotal,
        coachingContext: (profileRecord?.coachingContext as unknown as import("@/lib/claude").CoachingContext) ?? null,
        requestingAdditional,
        focusShifted,
        postReview,
        timeOfDay,
      });

      let dailyTask;

      if (existing && requestingAdditional) {
        // Append stretch tasks to existing list
        const existingTasks = Array.isArray(existing.tasks)
          ? (existing.tasks as unknown as TaskItem[])
          : [];
        const mergedTasks = [...existingTasks, ...result.tasks];
        dailyTask = await prisma.dailyTask.update({
          where: { goalId_date: { goalId: goal.id, date: today } },
          data: { tasks: mergedTasks as never, generatedAt: new Date() },
        });
      } else if (existing && postReview) {
        // Replace tasks with fresh set after post-review generation
        dailyTask = await prisma.dailyTask.update({
          where: { goalId_date: { goalId: goal.id, date: today } },
          data: { tasks: result.tasks as never, generatedAt: new Date(), isCompleted: false },
        });
      } else {
        dailyTask = await prisma.dailyTask.create({
          data: {
            userId: user.id,
            goalId: goal.id,
            date: today,
            tasks: result.tasks as never,
          },
        });
      }

      return { dailyTask, coachNote: result.coach_note };
    })
  );

  const dailyTasks = results.map((r) => r.dailyTask);
  const coachNote = results.find((r) => r.coachNote)?.coachNote;

  return NextResponse.json(
    { dailyTasks, ...(coachNote ? { coachNote } : {}) },
    { status: 201 }
  );
  } catch (e) {
    console.error("[/api/tasks/generate]", e);
    return NextResponse.json({ error: "Failed to generate tasks" }, { status: 500 });
  }
}
