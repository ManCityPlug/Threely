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

// AI cost estimates per call (USD), computed from real AICallLog token averages
// priced against DeepSeek V3.2 ($0.28 in / $0.42 out per 1M). Must stay in sync
// with /api/admin/overview/route.ts. Only current-product functions are tracked.
const AI_COSTS = {
  parseGoal:       0.000305,
  generateRoadmap: 0.000749,
  generateTasks:   0.000962,
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

  const [user, goals, allDailyTasks] =
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

  // AI cost estimate. One DailyTask = one generateTasks call (work-ahead creates
  // a separate DailyTask for tomorrow, already included in the count).
  const goalCount = goals.length;
  const aiCosts = {
    parseGoal:       { calls: goalCount,            cost: goalCount            * AI_COSTS.parseGoal },
    generateRoadmap: { calls: goalCount,            cost: goalCount            * AI_COSTS.generateRoadmap },
    generateTasks:   { calls: allDailyTasks.length, cost: allDailyTasks.length * AI_COSTS.generateTasks },
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
        // Find today's tasks for this goal.
        // Tasks are stored with the user's local date, but the server runs in UTC,
        // so check both today and yesterday (UTC) to handle timezone differences.
        const now = new Date();
        const todayKey = now.toISOString().split("T")[0];
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayKey = yesterday.toISOString().split("T")[0];

        const goalDailyTasks = allDailyTasks
          .filter((dt) => {
            if (dt.goalId !== g.id) return false;
            const dateKey = new Date(dt.date).toISOString().split("T")[0];
            return dateKey === todayKey || dateKey === yesterdayKey;
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const latestDailyTask = goalDailyTasks[0] ?? null;
        const latestDateKey = latestDailyTask
          ? new Date(latestDailyTask.date).toISOString().split("T")[0]
          : null;

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
          todayTasks: latestDailyTask
            ? (latestDailyTask.tasks as unknown as TaskItem[])
            : null,
          todayTasksDate: latestDateKey,
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
      let stripeStatus: string | null = null;
      let cancelAtPeriodEnd = false;
      let currentPeriodEnd: string | null = null;
      let plan: string | null = null;
      let trialStart: string | null = null;
      let trialEnd: string | null = null;

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
          // Get live subscription data
          const subs = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            limit: 1,
          });
          if (subs.data.length > 0) {
            const sub = subs.data[0];
            subscriptionStartDate = new Date(sub.start_date * 1000).toISOString();
            stripeStatus = sub.status; // active, trialing, canceled, past_due, etc.
            cancelAtPeriodEnd = sub.cancel_at_period_end;
            currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
            if (sub.trial_start) trialStart = new Date(sub.trial_start * 1000).toISOString();
            if (sub.trial_end) trialEnd = new Date(sub.trial_end * 1000).toISOString();
            // Get plan info
            const item = sub.items.data[0];
            if (item) {
              const interval = item.price.recurring?.interval;
              const amount = (item.price.unit_amount ?? 0) / 100;
              plan = `$${amount}/${interval}`;
            }
          }
        } catch {
          // ignore stripe errors
        }
      }

      return {
        status: user.subscriptionStatus,
        stripeStatus,
        stripeCustomerId: user.stripeCustomerId,
        trialClaimedAt: user.trialClaimedAt,
        trialEndsAt: user.trialEndsAt,
        firstChargeDate,
        subscriptionStartDate,
        cancelAtPeriodEnd,
        currentPeriodEnd,
        plan,
        trialStart,
        trialEnd,
        rcSubscriptionActive: user.rcSubscriptionActive,
      };
    })(),
    ai: {
      breakdown: aiCosts,
      totalCost: Math.round(totalAICost * 100) / 100,
    },
  });
}
