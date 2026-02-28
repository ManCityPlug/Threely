import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface TaskItem {
  id: string;
  task: string;
  description?: string;
  estimated_minutes?: number;
  goal_id?: string;
  why?: string;
  isCompleted: boolean;
  isSkipped?: boolean;
}

const AI_COSTS = {
  parseGoal: 0.027,
  generateRoadmap: 0.093,
  generateTasks: 0.02,
  goalChat: 0.001,
  generateInsight: 0.001,
  refineTask: 0.001,
  generateWeeklySummary: 0.001,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [user, goals, allDailyTasks, reviews, weeklySummaries] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id },
        include: { profile: true },
      }),
      prisma.goal.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.dailyTask.findMany({ where: { userId: id } }),
      prisma.dailyReview.findMany({ where: { userId: id } }),
      prisma.weeklySummary.count({ where: { userId: id } }),
    ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get Supabase auth info (last sign in)
  let lastSignIn: string | null = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    lastSignIn = data?.user?.last_sign_in_at ?? null;
  } catch {
    // ignore
  }

  // Task stats
  let totalTaskItems = 0;
  let completedTasks = 0;
  let skippedTasks = 0;
  let totalMinutesInvested = 0;
  for (const dt of allDailyTasks) {
    const tasks = dt.tasks as unknown as TaskItem[];
    for (const t of tasks) {
      totalTaskItems++;
      if (t.isCompleted) {
        completedTasks++;
        totalMinutesInvested += t.estimated_minutes ?? 0;
      }
      if (t.isSkipped) skippedTasks++;
    }
  }

  // Streak calculation (same algorithm as /api/stats)
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
          const diffDays = Math.round(
            (thisDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
          );
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

  // Goals in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const goalsLast30d = goals.filter((g) => g.createdAt >= thirtyDaysAgo).length;

  // AI cost estimate
  const goalCount = goals.length;
  const reviewsWithInsight = reviews.filter((r) => r.insight).length;
  const aiCosts = {
    parseGoal: { calls: goalCount, cost: goalCount * AI_COSTS.parseGoal },
    generateRoadmap: {
      calls: goalCount,
      cost: goalCount * AI_COSTS.generateRoadmap,
    },
    generateTasks: {
      calls: allDailyTasks.length,
      cost: allDailyTasks.length * AI_COSTS.generateTasks,
    },
    goalChat: {
      calls: goalCount * 2,
      cost: goalCount * 2 * AI_COSTS.goalChat,
    },
    generateInsight: {
      calls: reviewsWithInsight,
      cost: reviewsWithInsight * AI_COSTS.generateInsight,
    },
    refineTask: {
      calls: Math.round(totalTaskItems * 0.1),
      cost: Math.round(totalTaskItems * 0.1) * AI_COSTS.refineTask,
    },
    generateWeeklySummary: {
      calls: weeklySummaries,
      cost: weeklySummaries * AI_COSTS.generateWeeklySummary,
    },
  };
  const totalAICost = Object.values(aiCosts).reduce(
    (sum, v) => sum + v.cost,
    0
  );

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      lastSignIn,
      nickname: user.profile
        ? `${user.profile.dailyTimeMinutes}min/${["", "Steady", "Committed", "All-in"][user.profile.intensityLevel] || "?"}`
        : null,
      profile: user.profile,
    },
    goals: {
      total: goals.length,
      active: goals.filter((g) => g.isActive).length,
      completed: goals.filter((g) => !g.isActive).length,
      last30d: goalsLast30d,
      list: goals.map((g) => {
        // Find today's tasks for this goal
        const todayKey = new Date().toISOString().split("T")[0];
        const todayDailyTask = allDailyTasks.find(
          (dt) =>
            dt.goalId === g.id &&
            new Date(dt.date).toISOString().split("T")[0] === todayKey
        );
        return {
          id: g.id,
          title: g.title,
          description: g.description,
          rawInput: g.rawInput,
          structuredSummary: g.structuredSummary,
          category: g.category,
          roadmap: g.roadmap,
          dailyTimeMinutes: g.dailyTimeMinutes,
          intensityLevel: g.intensityLevel,
          deadline: g.deadline,
          isActive: g.isActive,
          isPaused: g.isPaused,
          createdAt: g.createdAt,
          todayTasks: todayDailyTask
            ? (todayDailyTask.tasks as unknown as TaskItem[])
            : null,
        };
      }),
    },
    tasks: {
      totalGenerated: totalTaskItems,
      completed: completedTasks,
      skipped: skippedTasks,
      completionRate:
        totalTaskItems > 0
          ? Math.round((completedTasks / totalTaskItems) * 100)
          : 0,
      totalMinutesInvested,
      totalHoursInvested:
        Math.round((totalMinutesInvested / 60) * 10) / 10,
      dailyTaskRecords: allDailyTasks.length,
    },
    streaks: {
      current: streak,
      best: bestStreak,
    },
    subscription: await (async () => {
      let firstChargeDate: string | null = null;
      let subscriptionStartDate: string | null = null;
      if (user.stripeCustomerId) {
        try {
          const stripe = getStripe();
          // Get first successful charge date
          const charges = await stripe.charges.list({
            customer: user.stripeCustomerId,
            limit: 1,
          });
          if (charges.data.length > 0 && charges.data[0].status === "succeeded") {
            firstChargeDate = new Date(charges.data[0].created * 1000).toISOString();
          }
          // Get subscription start date
          const subs = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            limit: 1,
          });
          if (subs.data.length > 0) {
            subscriptionStartDate = new Date(subs.data[0].start_date * 1000).toISOString();
          }
        } catch {
          // ignore stripe errors
        }
      }
      return {
        status: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        trialClaimedAt: user.trialClaimedAt,
        trialEndsAt: user.trialEndsAt,
        firstChargeDate,
        subscriptionStartDate,
      };
    })(),
    ai: {
      breakdown: aiCosts,
      totalCost: Math.round(totalAICost * 100) / 100,
    },
  });
}
