import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { generateInsight, updateCoachingContext, type CoachingContext } from "@/lib/claude";

// POST /api/insights
// Body: { dailyTaskId: string }
// Generates a coach insight based on today's review + recent history.
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const { allowed } = checkRateLimit(user.id);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { dailyTaskId } = body as { dailyTaskId?: string };

    if (!dailyTaskId) {
      return NextResponse.json({ error: "dailyTaskId is required" }, { status: 400 });
    }

    const dailyTask = await prisma.dailyTask.findFirst({
      where: { id: dailyTaskId, userId: user.id },
      include: { goal: true, review: true },
    });

    if (!dailyTask) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!dailyTask.review) {
      return NextResponse.json({ error: "No review found — submit a review first" }, { status: 400 });
    }

    // Return cached insight if already generated
    if (dailyTask.review.insight) {
      return NextResponse.json({ insight: dailyTask.review.insight });
    }

    // Load last 7 days of history for this goal (excluding today)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const history = await prisma.dailyTask.findMany({
      where: {
        goalId: dailyTask.goalId,
        userId: user.id,
        date: { gte: sevenDaysAgo },
        id: { not: dailyTaskId },
      },
      include: { review: true },
      orderBy: { date: "desc" },
      take: 7,
    });

    const last7Days = history.map((dt) => {
      const taskItems = Array.isArray(dt.tasks)
        ? (dt.tasks as { isCompleted: boolean }[])
        : [];
      return {
        date: new Date(dt.date).toISOString().split("T")[0],
        tasksCompleted: taskItems.filter((t) => t.isCompleted).length,
        tasksTotal: taskItems.length,
        difficultyRating: dt.review?.difficultyRating ?? null,
        completionStatus: dt.review?.completionStatus ?? null,
        userNote: dt.review?.userNote ?? null,
      };
    });

    // Count how many tasks were completed today
    const todayTaskItems = Array.isArray(dailyTask.tasks)
      ? (dailyTask.tasks as { isCompleted: boolean; task?: string; description?: string }[])
      : [];
    const tasksCompletedToday = todayTaskItems.filter((t) => t.isCompleted).length;
    const tasksTotalToday = todayTaskItems.length;

    // Load user profile for intensity level and compute progress stats
    const profileRecord = await prisma.userProfile.findUnique({ where: { userId: user.id } });
    const coachingCtx = profileRecord?.coachingContext as unknown as import("@/lib/claude").CoachingContext | null;

    // Compute days active and total completed for this goal
    const goalHistory = await prisma.dailyTask.findMany({
      where: { userId: user.id, goalId: dailyTask.goalId },
      select: { date: true, tasks: true },
    });
    const daysActiveOnGoal = new Set(goalHistory.map((dt) => new Date(dt.date).toDateString())).size;
    const totalCompletedOnGoal = goalHistory.reduce((sum, dt) => {
      const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as { isCompleted: boolean }[]) : [];
      return sum + items.filter((t) => t.isCompleted).length;
    }, 0);

    try {
      const insight = await generateInsight({
        difficultyRating: dailyTask.review.difficultyRating,
        completionStatus: dailyTask.review.completionStatus,
        userNote: dailyTask.review.userNote ?? null,
        goalTitle: dailyTask.goal.title,
        goalSummary: dailyTask.goal.structuredSummary ?? null,
        tasksCompletedToday,
        tasksTotalToday,
        last7Days,
        intensityLevel: profileRecord?.intensityLevel ?? 2,
        daysActive: daysActiveOnGoal,
        tasksCompletedTotal: totalCompletedOnGoal,
        streak: coachingCtx?.streak,
      });

      // Save insight to review
      await prisma.dailyReview.update({
        where: { id: dailyTask.review.id },
        data: { insight },
      });

      // Fire-and-forget: update coaching context for future task generation
      const todaysTasks = todayTaskItems.map((t) => ({
        task: t.task ?? "",
        description: t.description ?? "",
      }));
      if (profileRecord) {
        updateCoachingContext({
          currentContext: coachingCtx ?? null,
          difficultyRating: dailyTask.review.difficultyRating,
          completionStatus: dailyTask.review.completionStatus,
          userNote: dailyTask.review.userNote ?? null,
          tasksCompletedToday,
          tasksTotalToday,
          goalTitle: dailyTask.goal.title,
          insight,
          todaysTasks,
        })
          .then((updatedContext) =>
            prisma.userProfile.update({
              where: { id: profileRecord.id },
              data: { coachingContext: updatedContext as never },
            })
          )
          .catch((err) => console.error("[updateCoachingContext]", err));
      }

      return NextResponse.json({ insight });
    } catch (e) {
      console.error("[/api/insights]", e);
      return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/insights]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
