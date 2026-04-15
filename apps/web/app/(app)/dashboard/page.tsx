"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth, getNickname } from "@/lib/auth-context";
import { formatDisplayName } from "@/lib/format-name";
import {
  tasksApi, goalsApi, reviewsApi, insightsApi, statsApi, focusApi, subscriptionApi,
  type DailyTask, type TaskItem, type Goal, type GoalStat,
} from "@/lib/api-client";
import { SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";
import { useSubscription } from "@/lib/subscription-context";
import { MOCK_TUTORIAL_GOAL, MOCK_TUTORIAL_DAILY_TASK } from "@/lib/mock-tutorial-data";
import OfferBanner from "@/components/OfferBanner";
import OfferLoginModal from "@/components/OfferLoginModal";
import PathView from "@/components/PathView";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTodayIsoDay(): number {
  const d = new Date().getDay(); // 0=Sun
  return d === 0 ? 7 : d;
}

function isWorkDay(workDays: number[] | undefined): boolean {
  if (!workDays || workDays.length === 0 || workDays.length === 7) return true;
  return workDays.includes(getTodayIsoDay());
}

function formatWorkDaysList(workDays: number[]): string {
  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return workDays.sort((a, b) => a - b).map(d => names[d]).join(", ");
}

// ─── Gamification Helpers ─────────────────────────────────────────────────────

function getCompletionMessage(day: number): string {
  const messages: Record<number, string> = {
    1: "This is where it all starts.",
    2: "You're already ahead of most people.",
    3: "This is becoming a habit.",
    5: "You're not the same person you were Monday.",
    7: "One full week. Most people quit by now. You didn't.",
    10: "You're building something real.",
    14: "Two weeks in. The old you wouldn't recognize this.",
    21: "21 days. Science says this is a habit now.",
    30: "One month. You're not dreaming anymore — you're doing.",
    60: "Two months. This is who you are now.",
    100: "100 days. Legend.",
  };
  if (messages[day]) return messages[day];
  const generic = [
    "These are building you for tomorrow.",
    "Every day you show up, you level up.",
    "Small steps. Big results. See you tomorrow.",
    "You showed up. That's what matters.",
  ];
  return generic[day % generic.length];
}

function getGoalDayNumber(goal: Goal): number {
  const created = new Date(goal.createdAt);
  const now = new Date();
  const diff = now.getTime() - created.getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

function getStreakFromGoals(goals: Goal[]): number {
  if (goals.length === 0) return 0;
  // Streak = number of days since the user's earliest goal was created (never decreases)
  const earliest = goals.reduce((min, g) => {
    const d = new Date(g.createdAt).getTime();
    return d < min ? d : min;
  }, Infinity);
  const diff = Date.now() - earliest;
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

// ─── Task Card (simplified for gamified dashboard) ────────────────────────────

function GamifiedTaskCard({
  task,
  onToggle,
  onTap,
  animatingId,
}: {
  task: TaskItem;
  onToggle: (id: string, done: boolean) => void;
  onTap?: () => void;
  animatingId: string | null;
}) {
  const isAnimating = animatingId === task.id;

  return (
    <div
      onClick={() => {
        if (!task.isSkipped) onToggle(task.id, !task.isCompleted);
      }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "1rem",
        padding: "1.125rem 1.25rem",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        cursor: "pointer",
        transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
        transform: isAnimating ? "scale(1.02)" : "scale(1)",
        borderColor: task.isCompleted ? "#D4A843" : "var(--border)",
        opacity: task.isSkipped ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!task.isCompleted && !task.isSkipped) {
          e.currentTarget.style.borderColor = "rgba(212,168,67,0.4)";
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(212,168,67,0.08)";
        }
      }}
      onMouseLeave={e => {
        if (!task.isCompleted) {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!task.isSkipped) onToggle(task.id, !task.isCompleted);
        }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: task.isCompleted ? "2px solid #D4A843" : "2px solid var(--border)",
          background: task.isCompleted ? "#D4A843" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: task.isSkipped ? "not-allowed" : "pointer",
          flexShrink: 0,
          marginTop: 2,
          transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transform: isAnimating ? "scale(1.2)" : "scale(1)",
        }}
      >
        {task.isCompleted && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7L6 10L11 4" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }} onClick={onTap}>
        <div style={{
          fontWeight: 600,
          fontSize: "1rem",
          color: task.isCompleted ? "rgba(255,255,255,0.5)" : "var(--text)",
          textDecoration: task.isCompleted ? "line-through" : "none",
          textDecorationColor: "rgba(255,255,255,0.3)",
          lineHeight: 1.45,
          transition: "color 0.3s, text-decoration 0.3s",
        }}>
          {task.task}
        </div>
        <div style={{
          fontSize: "0.84rem",
          color: task.isCompleted ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.7)",
          marginTop: 4,
          lineHeight: 1.5,
          transition: "color 0.3s",
        }}>
          {task.description}
        </div>
      </div>
    </div>
  );
}

// ─── Celebration Overlay ──────────────────────────────────────────────────────

function CelebrationOverlay({
  dayNumber,
  goalTitle,
  onDismiss,
}: {
  dayNumber: number;
  goalTitle: string;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* Gold glow */}
      <div style={{
        position: "absolute",
        width: 300,
        height: 300,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(212,168,67,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        fontSize: 80,
        marginBottom: 24,
        transform: visible ? "scale(1)" : "scale(0.5)",
        transition: "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transitionDelay: "0.2s",
      }}>
        {"🔥"}
      </div>

      <h1 style={{
        fontSize: "2.5rem",
        fontWeight: 800,
        color: "#fff",
        letterSpacing: "-0.04em",
        marginBottom: 12,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0,
        transition: "all 0.5s ease",
        transitionDelay: "0.4s",
      }}>
        Day {dayNumber} Complete
      </h1>

      <p style={{
        fontSize: "1.1rem",
        color: "rgba(255,255,255,0.85)",
        maxWidth: 400,
        textAlign: "center",
        lineHeight: 1.6,
        marginBottom: 16,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0,
        transition: "all 0.5s ease",
        transitionDelay: "0.6s",
      }}>
        {getCompletionMessage(dayNumber)}
      </p>

      <button
        onClick={onDismiss}
        style={{
          padding: "14px 48px",
          borderRadius: 12,
          background: "#D4A843",
          color: "#000",
          fontSize: "1rem",
          fontWeight: 700,
          border: "none",
          cursor: "pointer",
          transform: visible ? "translateY(0)" : "translateY(20px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.5s ease, background 0.15s",
          transitionDelay: "0.8s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#e0bc5e"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#D4A843"; }}
      >
        See you tomorrow
      </button>
    </div>
  );
}

// ─── Midnight Countdown ──────────────────────────────────────────────────────

function MidnightCountdown({ dayNumber }: { dayNumber: number }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    function calcTimeLeft() {
      const now = Date.now();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft("");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}m`);
    }

    calcTimeLeft();
    const interval = setInterval(calcTimeLeft, 60000);
    return () => clearInterval(interval);
  }, []);

  if (expired) {
    return (
      <div style={{
        marginTop: 16,
        textAlign: "center",
      }}>
        <p style={{
          color: "#D4A843",
          fontSize: "0.95rem",
          fontWeight: 600,
        }}>
          New tasks available! Refresh to start Day {dayNumber + 1}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 10,
            padding: "8px 24px",
            borderRadius: 10,
            background: "#D4A843",
            color: "#000",
            fontSize: "0.85rem",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            transition: "filter 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
        >
          Refresh
        </button>
      </div>
    );
  }

  if (!timeLeft) return null;

  return (
    <p style={{
      marginTop: 16,
      color: "#D4A843",
      fontSize: "0.9rem",
      fontWeight: 600,
      opacity: 0.85,
    }}>
      Next day unlocks in {timeLeft}
    </p>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { hasPro, refreshSubscription, walkthroughActive, pauseEndsAt, isPaused } = useSubscription();
  const [resumingPause, setResumingPause] = useState(false);

  const handleResumePause = useCallback(async () => {
    if (resumingPause) return;
    setResumingPause(true);
    try {
      await subscriptionApi.resume();
      await refreshSubscription();
    } catch (e) {
      console.error("Failed to resume subscription:", e);
    } finally {
      setResumingPause(false);
    }
  }, [refreshSubscription, resumingPause]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [appNudgeDismissed, setAppNudgeDismissed] = useState(false);
  const [restDay, setRestDay] = useState(false);
  const [restDayPickerOpen, setRestDayPickerOpen] = useState(false);
  const [hasActiveOffer, setHasActiveOffer] = useState(false);
  const hasAutoGenerated = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recentlyToggledRef = useRef<Set<string>>(new Set());
  const [sortTrigger, setSortTrigger] = useState(0);

  // Gamification state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [animatingTaskId, setAnimatingTaskId] = useState<string | null>(null);

  // Path view state — false = path/roadmap view, true = fullscreen task view
  const [showTasks, setShowTasks] = useState(false);
  const [workAheadModal, setWorkAheadModal] = useState(false);
  const tasksRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [tasksRes, goalsRes, statsRes, focusRes] = await Promise.all([
        tasksApi.today(false),
        goalsApi.list(),
        statsApi.get(),
        focusApi.get().catch(() => ({ focus: null })),
      ]);
      setDailyTasks(tasksRes.dailyTasks);
      setGoals(goalsRes.goals);
      setGoalStats(statsRes.goalStats ?? []);
      // Check if any generate is in progress
      const todayStr = new Date().toLocaleDateString("en-CA");
      const restGenFlag = localStorage.getItem(`threely_restday_gen_${todayStr}`);
      const moreGenFlag = localStorage.getItem(`threely_generating_${todayStr}`);
      const activeGenFlag = restGenFlag || moreGenFlag;
      const flagKey = restGenFlag ? `threely_restday_gen_${todayStr}` : `threely_generating_${todayStr}`;

      if (activeGenFlag && !pollingRef.current) {
        const startedAt = parseInt(activeGenFlag, 10);
        const elapsed = Date.now() - startedAt;
        if (elapsed < 90_000) {
          setGenerating(true);
          setRestDay(false);
          const prevTaskCount = tasksRes.dailyTasks.length;
          pollingRef.current = setInterval(async () => {
            try {
              const poll = await tasksApi.today(false);
              if (poll.dailyTasks.length > prevTaskCount || (prevTaskCount === 0 && poll.dailyTasks.length > 0)) {
                setDailyTasks(poll.dailyTasks);
                setGenerating(false);
                setRestDay(false);
                localStorage.removeItem(flagKey);
                if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
              }
            } catch { /* ignore poll errors */ }
          }, 5000);
          setTimeout(() => {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              setGenerating(false);
              localStorage.removeItem(flagKey);
              tasksApi.today(false).then(r => {
                setDailyTasks(r.dailyTasks);
                setRestDay(r.restDay ?? false);
              }).catch(() => {});
            }
          }, Math.max(0, 90_000 - elapsed));
        } else {
          localStorage.removeItem(flagKey);
          setRestDay(tasksRes.restDay ?? false);
        }
      } else {
        setRestDay(tasksRes.restDay ?? false);
      }

      // Restore saved focus
      const todayKey = `threely_focus_${new Date().toLocaleDateString("en-CA")}`;
      const serverFocus = focusRes.focus?.focusGoalId ?? null;
      const localFocus = localStorage.getItem(todayKey);
      const restoredFocus = serverFocus ?? localFocus;
      const activeGoalIds = new Set(goalsRes.goals.map(g => g.id));
      const isValidFocus = restoredFocus && restoredFocus !== "all" && activeGoalIds.has(restoredFocus);
      if (isValidFocus) {
        setSelectedGoalId(restoredFocus);
        if (serverFocus && !localFocus) {
          localStorage.setItem(todayKey, serverFocus);
        }
      } else if (goalsRes.goals.length === 1) {
        const onlyGoalId = goalsRes.goals[0].id;
        setSelectedGoalId(onlyGoalId);
        localStorage.setItem(todayKey, onlyGoalId);
      } else if (goalsRes.goals.length > 1) {
        // Multiple goals — auto-select first
        setSelectedGoalId(goalsRes.goals[0].id);
      }

      // Auto-generate tasks if none exist and user has goals
      if (
        hasPro &&
        tasksRes.dailyTasks.length === 0 &&
        goalsRes.goals.length > 0 &&
        !tasksRes.restDay &&
        !hasAutoGenerated.current
      ) {
        hasAutoGenerated.current = true;
        setGenerating(true);
        localStorage.setItem(flagKey, String(Date.now()));
        try {
          const genRes = await tasksApi.generate();
          localStorage.removeItem(flagKey);
          if (genRes.restDay) {
            setRestDay(true);
          } else {
            setDailyTasks(genRes.dailyTasks);
          }
        } catch {
          localStorage.removeItem(flagKey);
        } finally {
          setGenerating(false);
        }
      }
    } catch {
      showToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, walkthroughActive, hasPro]);

  useEffect(() => { load(); return () => { if (pollingRef.current) clearInterval(pollingRef.current); }; }, [load]);

  // Detect mobile for app nudge banner
  useEffect(() => {
    setIsMobile(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }, []);

  // Handle successful Stripe Checkout redirect
  useEffect(() => {
    if (searchParams.get("subscribed") === "1") {
      refreshSubscription();
      if (searchParams.get("trial") === "denied") {
        showToast("Welcome to Pro! This card was already used for a free trial, so your subscription starts today.", "success");
      } else {
        showToast("Welcome to Pro! Your 7-day free trial has started.", "success");
      }
      router.replace("/dashboard");
    }
  }, [searchParams, refreshSubscription, showToast, router]);

  // Refetch when tab becomes visible
  const generatingRef = useRef(false);
  generatingRef.current = generating;
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && !generatingRef.current) load();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _sort = sortTrigger;

  const effectiveGoals = walkthroughActive ? [MOCK_TUTORIAL_GOAL] : goals;
  const effectiveDailyTasks = walkthroughActive ? [MOCK_TUTORIAL_DAILY_TASK] : dailyTasks;
  const effectiveSelectedGoalId = walkthroughActive ? MOCK_TUTORIAL_GOAL.id : selectedGoalId;

  const selectedGoal = effectiveGoals.find(g => g.id === effectiveSelectedGoalId);

  const displayedTasks = (() => {
    if (effectiveSelectedGoalId === null) return [];
    const dt = effectiveDailyTasks.find(d => d.goalId === effectiveSelectedGoalId);
    if (!dt) return [];
    const items = dt.tasks.slice(-3).map(task => ({ dt, task }));
    const incomplete = items.filter(x => !x.task.isCompleted || recentlyToggledRef.current.has(x.task.id));
    const completed = items.filter(x => x.task.isCompleted && !recentlyToggledRef.current.has(x.task.id));
    return [...incomplete, ...completed];
  })();

  const displayedItems = displayedTasks.map(x => x.task);
  const completedCount = displayedItems.filter(t => t.isCompleted || t.isSkipped).length;
  const totalCount = displayedItems.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const streak = getStreakFromGoals(effectiveGoals);
  const goalDayNumber = selectedGoal ? getGoalDayNumber(selectedGoal) : 1;

  // Show celebration when all tasks just completed — only once per day
  const prevAllDone = useRef(false);
  const hasTriggeredCelebration = useRef(false);
  useEffect(() => {
    // Only trigger when transitioning from not-done to done (user just completed last task)
    if (allDone && !prevAllDone.current && totalCount > 0 && !hasTriggeredCelebration.current) {
      setShowCelebration(true);
      setCelebrationDismissed(false);
      hasTriggeredCelebration.current = true;
    }
    prevAllDone.current = allDone;
  }, [allDone, totalCount]);

  function pickGoal(val: string) {
    setSelectedGoalId(val);
    setCelebrationDismissed(false);
    setShowCelebration(false);
    localStorage.setItem(`threely_focus_${new Date().toLocaleDateString("en-CA")}`, val);
    focusApi.save(val).catch(() => {});
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleGenerate(goalId?: string, isRestDayGen = false) {
    if (!hasPro) { router.push("/checkout?plan=yearly"); return; }
    setGenerating(true);
    const todayStr = new Date().toLocaleDateString("en-CA");
    const flagKey = isRestDayGen ? `threely_restday_gen_${todayStr}` : `threely_generating_${todayStr}`;
    localStorage.setItem(flagKey, String(Date.now()));
    try {
      const res = await tasksApi.generate(goalId ? { goalId } : undefined);
      if (res.dailyTasks.length > 0) {
        setDailyTasks(prev => {
          const newIds = new Set(res.dailyTasks.map(dt => dt.id));
          return [...prev.filter(dt => !newIds.has(dt.id) && res.dailyTasks.every(r => r.goalId !== dt.goalId)), ...res.dailyTasks];
        });
        setRestDay(false);
        if (res.dailyTasks.length === 1) {
          setSelectedGoalId(res.dailyTasks[0].goalId);
        }
      }
      localStorage.removeItem(flagKey);
    } catch (err: unknown) {
      localStorage.removeItem(flagKey);
      if (!(err instanceof Error && err.message?.includes("pro_required"))) {
        showToast("Failed to generate tasks", "error");
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleRestDayGenerate() {
    if (!hasPro) { router.push("/checkout?plan=yearly"); return; }
    if (goals.length === 1) {
      handleGenerate(goals[0].id, true);
    } else {
      setRestDayPickerOpen(true);
    }
  }

  async function handleToggle(dailyTaskId: string, taskItemId: string, isCompleted: boolean) {
    if (isCompleted) {
      setAnimatingTaskId(taskItemId);
      setTimeout(() => setAnimatingTaskId(null), 400);
      recentlyToggledRef.current.add(taskItemId);
      setTimeout(() => {
        recentlyToggledRef.current.delete(taskItemId);
        setSortTrigger(prev => prev + 1);
      }, 400);
    }

    try {
      const res = await tasksApi.toggleTask(dailyTaskId, taskItemId, isCompleted);
      const newDailyTasks = dailyTasks.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt);
      setDailyTasks(newDailyTasks);
    } catch {
      showToast("Failed to update task", "error");
    }
  }

  async function handleRefineTask(dailyTaskId: string, taskItemId: string, userRequest: string) {
    try {
      const res = await tasksApi.refineItem(dailyTaskId, taskItemId, userRequest);
      setDailyTasks(prev =>
        prev.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt)
      );
      showToast("Task refined by AI", "success");
    } catch {
      showToast("Failed to refine task", "error");
    }
  }

  async function handleAskAboutTask(dailyTaskId: string, taskItemId: string, messages: { role: "user" | "assistant"; content: string }[]) {
    const res = await tasksApi.askAboutTask(dailyTaskId, taskItemId, messages);
    return { answer: res.answer, options: res.options ?? [] };
  }

  async function handleSkipToday(dailyTaskId: string, taskItemId: string) {
    try {
      const res = await tasksApi.skip(dailyTaskId, taskItemId);
      setDailyTasks(prev =>
        prev.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt)
      );
      showToast("Task removed", "success");
    } catch {
      showToast("Failed to remove task", "error");
    }
  }

  async function handleRescheduleToday(dailyTaskId: string, taskItemId: string) {
    try {
      const res = await tasksApi.reschedule(dailyTaskId, taskItemId);
      setDailyTasks(prev =>
        prev.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt)
      );
      showToast("Task moved to tomorrow", "success");
    } catch {
      showToast("Failed to reschedule task", "error");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-inner" style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "3rem" }}>
        {/* Skeleton path nodes */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, opacity: 0.4 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: i === 0 ? 68 : 56,
              height: i === 0 ? 68 : 56,
              borderRadius: "50%",
              background: i === 0 ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.06)",
              border: i === 0 ? "3px solid rgba(212,168,67,0.3)" : "3px solid rgba(255,255,255,0.08)",
              marginLeft: i % 2 === 0 ? 0 : i % 4 === 1 ? -60 : 60,
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }`}</style>
      </div>
    );
  }

  return (
    <div className="page-inner">

      {/* Mobile app banner */}
      {isMobile && !appNudgeDismissed && (
        <div className="card fade-in" style={{
          padding: "1rem",
          background: "var(--primary-light)",
          border: "1px solid rgba(99,91,255,0.2)",
          marginBottom: "1.25rem",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{">"}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>
                Threely is available on mobile
              </span>
              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                Faster experience, works offline, and daily reminders so you never miss a task.
              </span>
            </div>
            <button
              onClick={() => setAppNudgeDismissed(true)}
              style={{ fontSize: 16, color: "var(--muted)", padding: "2px 4px", lineHeight: 1, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
            >
              {"✕"}
            </button>
          </div>
          <a
            href={/Android/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "") ? "https://play.google.com/store/apps/details?id=com.threely" : "https://apps.apple.com/app/threely/id6759625661"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 16px",
              background: "var(--primary)", color: "var(--primary-text)",
              borderRadius: 10, fontSize: "0.85rem", fontWeight: 700,
              textDecoration: "none", width: "100%",
            }}
          >
            <span style={{ position: "relative" }}>
              Download App
              <span style={{
                position: "absolute", top: -8, right: -28,
                background: "#F59E0B", color: "#fff",
                fontSize: "0.55rem", fontWeight: 700,
                padding: "1px 5px", borderRadius: 6,
                letterSpacing: "0.03em",
              }}>NEW</span>
            </span>
          </a>
        </div>
      )}

      {/* Pause banner */}
      {isPaused && pauseEndsAt && (
        <div className="paused-banner fade-in">
          <div className="paused-banner-text">
            <div className="paused-banner-title">Your subscription is paused</div>
            <div className="paused-banner-sub">
              You&apos;ll regain access on{" "}
              {new Date(pauseEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
            </div>
          </div>
          <button
            type="button"
            className="paused-banner-cta"
            onClick={handleResumePause}
            disabled={resumingPause}
          >
            {resumingPause ? "Resuming…" : "Resume now \u2192"}
          </button>
        </div>
      )}

      {/* Special offer banner */}
      <OfferBanner onActiveChange={setHasActiveOffer} />
      <OfferLoginModal firstName="" />

      {/* Limited mode banner */}
      {!hasPro && !hasActiveOffer && (
        <a href="/checkout?plan=yearly" style={{ textDecoration: "none" }}>
          <div className="card fade-in" style={{
            padding: "1rem 1.25rem",
            background: "var(--primary-light)",
            border: "1.5px solid var(--primary)",
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>
                Unlock Threely Pro
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Get Pro free for 7 days — Achieve your goals
              </div>
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>
              Try Free {"→"}
            </div>
          </div>
        </a>
      )}

      {/* ─── No goals: empty state ─── */}
      {effectiveGoals.length === 0 && (
        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: "1rem" }}>{"🚀"}</div>
          <button
            onClick={() => router.push("/goals?add=true")}
            style={{
              fontSize: "1.1rem", fontWeight: 700, padding: "1rem 2.5rem",
              background: "linear-gradient(135deg, #E8C547, #D4A843)",
              color: "#000", borderRadius: 14, border: "none", cursor: "pointer",
              boxShadow: "0 4px 16px rgba(212,168,67,0.3)",
            }}
          >
            Create your first goal →
          </button>
        </div>
      )}

      {/* ─── Has goals ─── */}
      {effectiveGoals.length > 0 && (
        <>
          {/* Header: streak + goal name */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: effectiveGoals.length > 1 ? "0.75rem" : "1.5rem",
          }}>
            <div style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "#D4A843",
              letterSpacing: "-0.02em",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              {"🔥"} {streak}
            </div>
            {selectedGoal && effectiveGoals.length === 1 && (
              <div style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                maxWidth: "60%",
                textAlign: "right",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {selectedGoal.title}
              </div>
            )}
          </div>

          {/* Goal tab pills (multiple goals) */}
          {effectiveGoals.length > 1 && (
            <div style={{
              display: "flex",
              gap: 8,
              marginBottom: "1.5rem",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              paddingBottom: 4,
            }}>
              {effectiveGoals.map(g => {
                const isActive = g.id === effectiveSelectedGoalId;
                return (
                  <button
                    key={g.id}
                    onClick={() => pickGoal(g.id)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 9999,
                      border: isActive ? "2px solid #D4A843" : "1.5px solid var(--border)",
                      background: isActive ? "rgba(212,168,67,0.1)" : "transparent",
                      color: isActive ? "#D4A843" : "rgba(255,255,255,0.7)",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.2s",
                    }}
                  >
                    {g.title}
                  </button>
                );
              })}
              {/* Add goal button */}
              <button
                onClick={() => {
                  if (effectiveGoals.length >= 3) {
                    showToast("3 goals is the sweet spot. Focus beats hustle. Finish or remove one to add another.", "error");
                  } else {
                    router.push("/start");
                  }
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  border: "1.5px solid var(--border)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "1.1rem",
                  fontWeight: 400,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#D4A843"; e.currentTarget.style.color = "#D4A843"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              >
                +
              </button>
            </div>
          )}

          {/* Rest day */}
          {restDay && !generating && !walkthroughActive && (
            <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"😴"}</div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
                No goals scheduled for today
              </h2>
              <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
                Enjoy your rest day — or keep the momentum going!
              </p>
              <button
                className="btn btn-primary"
                onClick={handleRestDayGenerate}
                style={{ height: 44, padding: "0 1.5rem", fontSize: "0.9rem" }}
              >
                Generate tasks anyway
              </button>
            </div>
          )}

          {/* Rest day goal picker */}
          {restDayPickerOpen && (
            <div
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
              }}
              onClick={() => setRestDayPickerOpen(false)}
            >
              <div
                className="card"
                style={{ padding: "1.5rem", width: "calc(100vw - 2rem)", maxWidth: 400 }}
                onClick={e => e.stopPropagation()}
              >
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4, letterSpacing: "-0.02em" }}>
                  Which goal?
                </h3>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.875rem", marginBottom: "1rem", lineHeight: 1.5 }}>
                  Pick a goal to generate tasks for today.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {goals.map(g => (
                    <button
                      key={g.id}
                      className="btn"
                      style={{
                        textAlign: "left", padding: "0.75rem 1rem",
                        border: "1px solid var(--border)", borderRadius: 10,
                        background: "var(--bg)", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10,
                      }}
                      onClick={() => {
                        setRestDayPickerOpen(false);
                        handleGenerate(g.id, true);
                      }}
                    >
                      <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{g.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading skeleton during auto-generate */}
          {generating && effectiveDailyTasks.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <p style={{ textAlign: "center", marginTop: "0.5rem", color: "rgba(255,255,255,0.6)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                <strong>This can take a couple of minutes.</strong>
                <br />
                Feel free to leave this page — your tasks will be ready when you come back.
              </p>
            </div>
          )}

          {/* Fallback: goal selected but no tasks generated yet */}
          {effectiveSelectedGoalId !== null && effectiveDailyTasks.length === 0 && !generating && !restDay && (
            <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"⚡"}</div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
                Ready to get started?
              </h2>
              <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
                Generate today&apos;s tasks for your goal.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => handleGenerate(effectiveSelectedGoalId ?? undefined)}
                style={{ fontSize: "1rem", padding: "0.75rem 2rem" }}
              >
                Generate tasks
              </button>
            </div>
          )}

          {/* ─── Path view + task area ─── */}
          {effectiveDailyTasks.length > 0 && effectiveSelectedGoalId !== null && !showTasks && (
            <>
              {/* All done state — shown ABOVE the path */}
              {allDone && celebrationDismissed && (
                <div style={{
                  textAlign: "center",
                  padding: "1.5rem 2rem",
                  marginBottom: 8,
                }}>
                  <div style={{
                    fontSize: "2rem",
                    marginBottom: 12,
                    color: "#D4A843",
                    fontWeight: 800,
                  }}>
                    {"✓"}
                  </div>
                  <h2 style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 6,
                    letterSpacing: "-0.02em",
                  }}>
                    All done for today
                  </h2>
                  <p style={{
                    color: "rgba(255,255,255,0.85)",
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                  }}>
                    {getCompletionMessage(goalDayNumber)}
                  </p>
                  <MidnightCountdown dayNumber={goalDayNumber} />
                </div>
              )}

              {/* Day heading */}
              {!allDone && (
                <h1 style={{
                  fontSize: "2.5rem",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  color: "var(--text)",
                  textAlign: "center",
                  marginBottom: 8,
                }}>
                  Day {goalDayNumber}
                </h1>
              )}

              {/* Path View */}
              <PathView
                dayNumber={goalDayNumber}
                completedDays={goalDayNumber - 1}
                onDayClick={async (day, type) => {
                  if (type === "today") {
                    setShowTasks(true);
                  } else if (type === "next") {
                    setWorkAheadModal(true);
                  } else if (type === "completed") {
                    // Fetch and show past day's tasks in read-only mode
                    try {
                      const goalCreated = selectedGoal?.createdAt ? new Date(selectedGoal.createdAt) : new Date();
                      const pastDate = new Date(goalCreated);
                      pastDate.setDate(pastDate.getDate() + day - 1);
                      const dateStr = pastDate.toISOString().split("T")[0];
                      const res = await tasksApi.today(false, dateStr);
                      const goalTasks = res.dailyTasks.filter(dt => dt.goalId === effectiveSelectedGoalId);
                      if (goalTasks.length > 0) {
                        const items = goalTasks[0].tasks.slice(-3);
                        alert(`Day ${day} Tasks:\n\n${items.map((t: { task?: string; title?: string; isCompleted?: boolean }, i: number) => `${(t as { isCompleted?: boolean }).isCompleted ? "✓" : "○"} ${(t as { task?: string; title?: string }).task || (t as { task?: string; title?: string }).title}`).join("\n")}`);
                      } else {
                        alert(`Day ${day}: No tasks found for this day.`);
                      }
                    } catch {
                      alert(`Day ${day}: Couldn't load tasks.`);
                    }
                  }
                }}
                allDoneToday={allDone}
                totalTasks={totalCount}
                onStartDay={() => {
                  setShowTasks(true);
                }}
                tasksVisible={showTasks}
              />

              {/* Work ahead modal */}
              {workAheadModal && (
                <div
                  style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 9999, backdropFilter: "blur(4px)",
                  }}
                  onClick={() => setWorkAheadModal(false)}
                >
                  <div
                    className="card"
                    style={{
                      padding: "2rem",
                      width: "calc(100vw - 2rem)",
                      maxWidth: 380,
                      textAlign: "center",
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ fontSize: 40, marginBottom: 16 }}>{"⚡"}</div>
                    <h3 style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      marginBottom: 8,
                      letterSpacing: "-0.02em",
                      color: "var(--text)",
                    }}>
                      Work ahead?
                    </h3>
                    <p style={{
                      color: "rgba(255,255,255,0.85)",
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                      marginBottom: "1.5rem",
                    }}>
                      We recommend doing one day&apos;s work per day. Want to work ahead?
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        className="btn"
                        onClick={() => setWorkAheadModal(false)}
                        style={{
                          flex: 1, padding: "12px 16px",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          background: "transparent",
                          color: "rgba(255,255,255,0.85)",
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        I&apos;ll wait
                      </button>
                      <button
                        onClick={async () => {
                          setWorkAheadModal(false);
                          if (!hasPro) { router.push("/checkout?plan=yearly"); return; }
                          setGenerating(true);
                          try {
                            // Generate for TOMORROW's date
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

                            const { getSupabase } = await import("@/lib/supabase-client");
                            const supabase = getSupabase();
                            const { data: { session } } = await supabase.auth.getSession();

                            const res = await fetch("/api/tasks/generate", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                              },
                              body: JSON.stringify({
                                localDate: tomorrowStr,
                                ...(effectiveSelectedGoalId ? { goalId: effectiveSelectedGoalId } : {}),
                              }),
                            });

                            if (res.ok) {
                              const data = await res.json();
                              if (data.dailyTasks?.length > 0) {
                                setDailyTasks(prev => [...prev, ...data.dailyTasks]);
                                setCelebrationDismissed(false);
                                setShowTasks(true);
                              }
                            } else {
                              window.location.reload();
                            }
                          } catch {
                            showToast("Couldn't generate tasks", "error");
                          } finally {
                            setGenerating(false);
                          }
                        }}
                        style={{
                          flex: 1, padding: "12px 16px",
                          borderRadius: 10,
                          background: "#D4A843",
                          color: "#000",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Work ahead
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── Fullscreen Task View ─── */}
          {effectiveDailyTasks.length > 0 && effectiveSelectedGoalId !== null && showTasks && (
            <div ref={tasksRef} className="slide-up" style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}>
              {/* Back to path button */}
              <button
                onClick={() => setShowTasks(false)}
                style={{
                  background: "none", border: "none", color: "rgba(255,255,255,0.85)",
                  cursor: "pointer", fontSize: "0.95rem", fontWeight: 600,
                  padding: "8px 0", alignSelf: "flex-start",
                  display: "flex", alignItems: "center", gap: 6, minHeight: 44,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#D4A843"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to path
              </button>

              {/* Day heading */}
              <h1 style={{
                fontSize: "2.5rem",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "var(--text)",
                textAlign: "center",
                marginBottom: 4,
              }}>
                Day {goalDayNumber}
              </h1>

              <p style={{
                textAlign: "center",
                fontSize: "0.9rem",
                color: "rgba(255,255,255,0.7)",
                marginBottom: 8,
              }}>
                {totalCount} tasks for today
              </p>

              {/* Task cards */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
                marginBottom: "1.25rem",
              }}>
                {displayedTasks.map(({ dt, task }) => (
                  <div key={task.id} className="slide-up">
                    <GamifiedTaskCard
                      task={task}
                      onToggle={(taskItemId, isCompleted) =>
                        handleToggle(dt.id, taskItemId, isCompleted)
                      }
                      animatingId={animatingTaskId}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Task view: all done state */}
          {effectiveDailyTasks.length > 0 && effectiveSelectedGoalId !== null && showTasks && allDone && celebrationDismissed && (
            <div className="slide-up" style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}>
              <button
                onClick={() => setShowTasks(false)}
                style={{
                  background: "none", border: "none", color: "rgba(255,255,255,0.85)",
                  cursor: "pointer", fontSize: "0.95rem", fontWeight: 600,
                  padding: "8px 0", alignSelf: "flex-start",
                  display: "flex", alignItems: "center", gap: 6, minHeight: 44,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#D4A843"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to path
              </button>

              <div style={{
                textAlign: "center",
                padding: "2rem",
              }}>
                <div style={{ fontSize: "3rem", marginBottom: 16 }}>{"✓"}</div>
                <h2 style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "var(--text)",
                  marginBottom: 8,
                  letterSpacing: "-0.02em",
                }}>
                  All done for today
                </h2>
                <p style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: "1rem",
                  lineHeight: 1.6,
                  marginBottom: 16,
                }}>
                  {getCompletionMessage(goalDayNumber)}
                </p>
                <MidnightCountdown dayNumber={goalDayNumber} />
                <button
                  onClick={() => setShowTasks(false)}
                  style={{
                    marginTop: 24,
                    padding: "14px 36px",
                    borderRadius: 12,
                    background: "#D4A843",
                    color: "#000",
                    fontSize: "1rem",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    transition: "filter 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
                >
                  View path
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Celebration overlay */}
      {showCelebration && selectedGoal && typeof document !== "undefined" && createPortal(
        <CelebrationOverlay
          dayNumber={goalDayNumber}
          goalTitle={selectedGoal.title}
          onDismiss={() => {
            setShowCelebration(false);
            setCelebrationDismissed(true);
            setShowTasks(false);
          }}
        />,
        document.body
      )}
    </div>
  );
}
