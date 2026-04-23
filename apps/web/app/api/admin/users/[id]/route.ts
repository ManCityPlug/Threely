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

// Task content comes from @threely/tasks now, so this endpoint no longer
// reports per-call LLM cost or aggregate task counters — they were based on
// the old generateTasks/parseGoal/generateRoadmap stack that's been stubbed.
// Kept here: who the user is, their active goals (with today's task preview),
// current streak, and Stripe subscription state for support actions.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [user, goals, allDailyTasks] = await Promise.all([
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

  let lastSignIn: string | null = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    lastSignIn = data?.user?.last_sign_in_at ?? null;
  } catch {
    // ignore
  }

  // Current streak — same algorithm as /api/stats. Best streak was removed:
  // a streak that only counts up is the only number the user sees, so showing
  // a separate "best" added noise without adding info.
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
      list: goals.map((g) => {
        // Find today's tasks for this goal. Tasks are stored with the user's
        // local date; server runs in UTC, so check today and yesterday.
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
          rawInput: g.rawInput,
          category: g.category,
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
    streaks: { current: streak },
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
          const charges = await stripe.charges.list({
            customer: user.stripeCustomerId,
            limit: 1,
          });
          if (charges.data.length > 0 && charges.data[0].status === "succeeded") {
            firstChargeDate = new Date(charges.data[0].created * 1000).toISOString();
          }
          const subs = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            limit: 1,
          });
          if (subs.data.length > 0) {
            const sub = subs.data[0];
            subscriptionStartDate = new Date(sub.start_date * 1000).toISOString();
            stripeStatus = sub.status;
            cancelAtPeriodEnd = sub.cancel_at_period_end;
            currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
            if (sub.trial_start) trialStart = new Date(sub.trial_start * 1000).toISOString();
            if (sub.trial_end) trialEnd = new Date(sub.trial_end * 1000).toISOString();
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
  });
}
