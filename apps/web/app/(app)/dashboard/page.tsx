"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, getNickname } from "@/lib/auth-context";
import {
  tasksApi, goalsApi, reviewsApi, insightsApi, statsApi,
  type DailyTask, type TaskItem, type Goal, type GoalStat,
} from "@/lib/api-client";
import { SkeletonCard } from "@/components/Skeleton";
import Confetti from "@/components/Confetti";
import { useToast } from "@/components/ToastProvider";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function stalenessColor(days: number | null): string {
  if (days === null) return "var(--muted)";
  if (days < 7) return "var(--success)";
  if (days < 14) return "var(--warning)";
  return "var(--danger)";
}

function stalenessLabel(days: number | null): string {
  if (days === null) return "Never worked on";
  if (days === 0) return "Worked today";
  if (days === 1) return "Worked yesterday";
  return `${days}d ago`;
}

const DIFFICULTY_OPTIONS = [
  { value: "too_easy", label: "Too easy" },
  { value: "just_right", label: "Just right" },
  { value: "challenging", label: "Challenging" },
  { value: "overwhelming", label: "Overwhelming" },
];

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, onToggle, onSkip, onReschedule, onRefine, readonly = false, overdue = false,
}: {
  task: TaskItem;
  onToggle?: (id: string, done: boolean) => void;
  onSkip?: (id: string) => void;
  onReschedule?: (id: string) => void;
  onRefine?: (id: string, userRequest: string) => void;
  readonly?: boolean;
  overdue?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [refineMode, setRefineMode] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleStartRefine() {
    setMenuOpen(false);
    setRefineInput("");
    setRefineMode(true);
  }

  async function handleSubmitRefine() {
    if (!refineInput.trim()) return;
    setRefining(true);
    onRefine?.(task.id, refineInput.trim());
    setRefining(false);
    setRefineMode(false);
  }

  const showMenu = !readonly && !task.isCompleted && !task.isSkipped;

  return (
    <div
      className={`card${!task.isCompleted && !task.isSkipped ? " task-card-hover" : ""}`}
      style={{
        padding: "1rem 1.25rem",
        opacity: task.isCompleted || task.isSkipped ? 0.7 : 1,
        transition: "opacity 0.2s, transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        display: "flex",
        gap: "1rem",
        alignItems: "flex-start",
        borderColor: overdue ? "var(--warning)" : undefined,
      }}
    >
      {!readonly && (
        <button
          className={`task-checkbox${task.isCompleted ? " checked" : ""}`}
          onClick={() => onToggle?.(task.id, !task.isCompleted)}
          style={{ marginTop: 2 }}
        >
          {task.isCompleted && "✓"}
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {refineMode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: "0.8rem", color: "var(--subtext)", margin: 0 }}>
              Tell AI how to adjust this task:
            </p>
            <input
              className="field-input"
              value={refineInput}
              onChange={e => setRefineInput(e.target.value)}
              placeholder="e.g. make it shorter, focus on X..."
              onKeyDown={e => e.key === "Enter" && handleSubmitRefine()}
              style={{ fontSize: "0.85rem", padding: "6px 10px" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn btn-primary"
                onClick={handleSubmitRefine}
                disabled={refining || !refineInput.trim()}
                style={{ fontSize: "0.8rem", padding: "4px 12px" }}
              >
                {refining ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Refining...</> : "Refine"}
              </button>
              <button className="btn btn-outline" onClick={() => setRefineMode(false)} style={{ fontSize: "0.8rem", padding: "4px 12px" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{
              fontWeight: 600,
              fontSize: "0.95rem",
              color: task.isCompleted ? "var(--muted)" : "var(--text)",
              textDecoration: task.isCompleted ? "line-through" : "none",
              marginBottom: 4,
            }}>
              {task.task}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--subtext)", marginBottom: 6, lineHeight: 1.5 }}>
              {task.description}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontStyle: "italic", marginBottom: 6 }}>
              {task.why}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: "0.75rem", color: "var(--muted)",
                background: "var(--bg)", borderRadius: 20,
                padding: "2px 8px",
              }}>
                {"⏱"} {task.estimated_minutes} min
              </div>
              {task.isCarriedOver && (
                <span style={{
                  fontSize: "0.7rem", fontWeight: 600,
                  color: "var(--warning)", background: "var(--warning-light)",
                  borderRadius: 20, padding: "2px 8px",
                }}>
                  Overdue
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {showMenu && (
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              fontSize: "1.25rem", lineHeight: 1, padding: "2px 6px",
              color: "var(--muted)", cursor: "pointer",
              borderRadius: 4, border: "none", background: "transparent",
            }}
          >
            {"\u22EF"}
          </button>
          {menuOpen && (
            <div style={{
              position: "absolute", right: 0, top: "100%", zIndex: 50,
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              minWidth: 180, overflow: "hidden",
            }}>
              {onRefine && (
                <button onClick={handleStartRefine} style={menuItemStyle}>
                  Ask AI to refine
                </button>
              )}
              {onReschedule && (
                <button onClick={() => { setMenuOpen(false); onReschedule(task.id); }} style={menuItemStyle}>
                  Move to tomorrow
                </button>
              )}
              {onSkip && (
                <button onClick={() => { setMenuOpen(false); onSkip(task.id); }} style={{ ...menuItemStyle, color: "var(--danger)" }}>
                  Remove task
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "10px 14px",
  fontSize: "0.85rem", fontWeight: 500, textAlign: "left",
  color: "var(--text)", background: "transparent",
  border: "none", cursor: "pointer",
  borderBottom: "1px solid var(--border)",
};

// ─── Review Modal (simplified: 2 steps) ──────────────────────────────────────

function ReviewModal({
  dailyTaskId,
  onComplete,
  onClose,
}: {
  dailyTaskId: string;
  onComplete: (insight: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"difficulty" | "note">("difficulty");
  const [difficulty, setDifficulty] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!difficulty) return;
    setSubmitting(true);
    try {
      await reviewsApi.submit({
        dailyTaskId,
        difficultyRating: difficulty,
        userNote: note || undefined,
      });
      const { insight } = await insightsApi.generate(dailyTaskId);
      onComplete(insight);
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Daily review</h2>
            <p style={{ color: "var(--subtext)", fontSize: "0.85rem", marginTop: 2 }}>
              {step === "difficulty" ? "How were today's tasks?" : "Anything to add?"}
            </p>
          </div>
          <button onClick={onClose} style={{ fontSize: 20, color: "var(--muted)", padding: 4 }}>{"✕"}</button>
        </div>

        {/* Step 1: Difficulty */}
        {step === "difficulty" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setDifficulty(opt.value); setStep("note"); }}
                style={{
                  padding: "0.875rem 1rem",
                  borderRadius: "var(--radius)",
                  border: `2px solid ${difficulty === opt.value ? "var(--primary)" : "var(--border)"}`,
                  background: difficulty === opt.value ? "var(--primary-light)" : "var(--card)",
                  color: "var(--text)",
                  fontWeight: 500,
                  fontSize: "0.95rem",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Note + Submit */}
        {step === "note" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <textarea
              className="field-input"
              placeholder="Anything you want to note? (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              style={{ resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep("difficulty")} className="btn btn-outline" style={{ flex: 1 }}>
                {"←"} Back
              </button>
              <button
                onClick={handleSubmit}
                className="btn btn-primary"
                disabled={submitting}
                style={{ flex: 2 }}
              >
                {submitting ? <span className="spinner" /> : "Submit review"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<"all" | string | null>(null);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [reviewDailyTaskId, setReviewDailyTaskId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [completingAll, setCompletingAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [appNudgeDismissed, setAppNudgeDismissed] = useState(false);
  const [proExpired, setProExpired] = useState(false);
  const [welcomeProVisible, setWelcomeProVisible] = useState(false);
  const [restDay, setRestDay] = useState(false);
  const hasAutoGenerated = useRef(false);

  const load = useCallback(async () => {
    try {
      const [tasksRes, goalsRes, statsRes] = await Promise.all([
        tasksApi.today(false),
        goalsApi.list(),
        statsApi.get(),
      ]);
      setDailyTasks(tasksRes.dailyTasks);
      setGoals(goalsRes.goals);
      setGoalStats(statsRes.goalStats ?? []);
      setRestDay(tasksRes.restDay ?? false);

      // Restore saved focus or prompt user to pick
      const todayKey = `threely_focus_${new Date().toISOString().slice(0, 10)}`;
      const saved = sessionStorage.getItem(todayKey);
      if (saved) {
        setSelectedGoalId(saved as "all" | string);
      } else if (goalsRes.goals.length === 1) {
        const onlyGoalId = goalsRes.goals[0].id;
        setSelectedGoalId(onlyGoalId);
        sessionStorage.setItem(todayKey, onlyGoalId);
      } else if (goalsRes.goals.length > 1) {
        // Multiple goals, no saved pick — prompt user to choose
        setSelectedGoalId(null);
        setGoalPickerOpen(true);
      }

      // Auto-generate tasks if none exist and user has goals
      if (
        tasksRes.dailyTasks.length === 0 &&
        goalsRes.goals.length > 0 &&
        !tasksRes.restDay &&
        !hasAutoGenerated.current
      ) {
        hasAutoGenerated.current = true;
        setGenerating(true);
        try {
          const genRes = await tasksApi.generate();
          if (genRes.restDay) {
            setRestDay(true);
          } else {
            setDailyTasks(genRes.dailyTasks);
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message?.includes("pro_required")) {
            setProExpired(true);
          }
          // Silently fail auto-generate — user can retry
        } finally {
          setGenerating(false);
        }
      }
    } catch {
      showToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Detect mobile for app nudge banner
  useEffect(() => {
    setIsMobile(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }, []);

  // Welcome to Pro popup (shown once after first registration)
  useEffect(() => {
    if (loading || !user) return;
    const key = `threely_welcome_shown_${user.id}`;
    if (!sessionStorage.getItem(key) && !localStorage.getItem(key)) {
      setWelcomeProVisible(true);
      localStorage.setItem(key, "true");
      sessionStorage.setItem(key, "true");
    }
  }, [loading, user]);

  // Refetch when tab becomes visible (sync across devices)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const displayedTasks = (() => {
    if (selectedGoalId === null) return [];
    if (selectedGoalId === "all") {
      const result: { dt: DailyTask; task: TaskItem }[] = [];
      let round = 0;
      while (result.length < 3) {
        let addedThisRound = 0;
        for (const dt of dailyTasks) {
          const items = dt.tasks.slice(-3);
          if (items[round]) {
            result.push({ dt, task: items[round] });
            addedThisRound++;
            if (result.length >= 3) break;
          }
        }
        if (addedThisRound === 0) break;
        round++;
      }
      return result;
    }
    const dt = dailyTasks.find(d => d.goalId === selectedGoalId);
    if (!dt) return [];
    return dt.tasks.slice(-3).map(task => ({ dt, task }));
  })();

  const displayedItems = displayedTasks.map(x => x.task);
  const allDisplayedItems = displayedItems;
  const completedCount = allDisplayedItems.filter(t => t.isCompleted).length;
  const totalCount = allDisplayedItems.length;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalEstimatedMinutes = allDisplayedItems
    .filter(t => !t.isCompleted)
    .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  function pickGoal(val: "all" | string) {
    setSelectedGoalId(val);
    setGoalPickerOpen(false);
    sessionStorage.setItem(`threely_focus_${new Date().toISOString().slice(0, 10)}`, val);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await tasksApi.generate();
      setDailyTasks(res.dailyTasks);

    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("pro_required")) {
        setProExpired(true);
      } else {
        showToast("Failed to generate tasks", "error");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggle(dailyTaskId: string, taskItemId: string, isCompleted: boolean) {
    try {
      const res = await tasksApi.toggleTask(dailyTaskId, taskItemId, isCompleted);
      const newDailyTasks = dailyTasks.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt);
      setDailyTasks(newDailyTasks);

      // Check if all displayed tasks are now complete to trigger confetti
      if (isCompleted) {
        const currentDisplayed = (() => {
          if (selectedGoalId === null) return [];
          if (selectedGoalId === "all") {
            const result: TaskItem[] = [];
            let round = 0;
            while (result.length < 3) {
              let addedThisRound = 0;
              for (const dt of newDailyTasks) {
                const items = dt.tasks.slice(-3);
                if (items[round]) {
                  result.push(items[round]);
                  addedThisRound++;
                  if (result.length >= 3) break;
                }
              }
              if (addedThisRound === 0) break;
              round++;
            }
            return result;
          }
          const dt = newDailyTasks.find(d => d.goalId === selectedGoalId);
          return dt ? dt.tasks.slice(-3) : [];
        })();
        const allNowDone = currentDisplayed.length > 0 && currentDisplayed.every(t => t.isCompleted);
        if (allNowDone) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }
      }
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

  async function handleCompleteAll() {
    const incomplete = displayedTasks.filter(x => !x.task.isCompleted && !x.task.isSkipped);
    if (incomplete.length < 2) return;
    setCompletingAll(true);
    try {
      await Promise.all(
        incomplete.map(({ dt, task }) => tasksApi.toggleTask(dt.id, task.id, true))
      );
      // Reload to get fresh state
      const tasksRes = await tasksApi.today(false);
      setDailyTasks(tasksRes.dailyTasks);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      showToast("All tasks completed!", "success");
    } catch {
      showToast("Failed to complete all tasks", "error");
    } finally {
      setCompletingAll(false);
    }
  }

  function handleGiveMore() {
    const dt = selectedGoalId !== "all"
      ? dailyTasks.find(d => d.goalId === selectedGoalId)
      : dailyTasks[0];
    if (dt) {
      setReviewDailyTaskId(dt.id);
      setShowReview(true);
    }
  }

  async function handleReviewComplete(generatedInsight: string) {
    setShowReview(false);
    setInsight(generatedInsight);

    setGenerating(true);
    try {
      const goalId = selectedGoalId && selectedGoalId !== "all" ? selectedGoalId : undefined;
      const res = await tasksApi.generate({ postReview: true, goalId });
      setDailyTasks(res.dailyTasks);

    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("pro_required")) {
        setProExpired(true);
      } else {
        showToast("Failed to generate next tasks", "error");
      }
    } finally {
      setGenerating(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  // Computed: how many incomplete tasks remain
  const incompleteCount = displayedItems.filter(t => !t.isCompleted && !t.isSkipped).length;

  if (loading) {
    return (
      <div className="page-inner">
        <div style={{ marginBottom: "1.75rem" }}>
          <div className="skeleton" style={{ width: 160, height: 14, marginBottom: 8, borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ width: 220, height: 28, borderRadius: "var(--radius-sm)" }} />
        </div>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner">
      <Confetti active={showConfetti} />

      {/* Mobile app nudge banner */}
      {isMobile && !appNudgeDismissed && (
        <div className="card fade-in" style={{
          padding: "0.75rem 1rem",
          background: "var(--primary-light)",
          border: "1px solid rgba(99,91,255,0.2)",
          marginBottom: "1.25rem",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: "0.875rem", color: "var(--text)", flex: 1 }}>
            For the best experience, use the Threely app
          </span>
          <a
            href="#"
            style={{
              padding: "5px 12px",
              background: "var(--primary)", color: "#fff",
              borderRadius: 6, fontSize: "0.8rem", fontWeight: 600,
              textDecoration: "none", flexShrink: 0,
            }}
          >
            Get App
          </a>
          <button
            onClick={() => setAppNudgeDismissed(true)}
            style={{ fontSize: 16, color: "var(--muted)", padding: "2px 4px", lineHeight: 1 }}
          >
            {"✕"}
          </button>
        </div>
      )}

      {/* Welcome to Pro modal */}
      {welcomeProVisible && (
        <div className="modal-overlay" onClick={() => setWelcomeProVisible(false)}>
          <div className="modal-box fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: "center", padding: "2.5rem 2rem" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>✦</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
              You&apos;ve got Pro!
            </h2>
            <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 20 }}>
              Enjoy full access to Threely Pro for 3 days — completely free, no credit card needed.
            </p>
            <div style={{ textAlign: "left", display: "inline-flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>✦  AI-powered daily tasks</span>
              <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>✦  Personalized coaching insights</span>
              <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>✦  Unlimited goals & tracking</span>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: 20 }}>
              Love it? Pick a plan anytime to keep going.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setWelcomeProVisible(false)}
              style={{ width: "100%", height: 46, fontSize: "1rem" }}
            >
              Let&apos;s go!
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 4 }}>{todayStr()}</p>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em" }}>
          {greeting()}, {(() => {
            const raw = getNickname() || user?.email?.split("@")[0] || "";
            const first = raw.split(/\s+/)[0] || "there";
            return first.charAt(0).toUpperCase() + first.slice(1);
          })()} {"👋"}
        </h1>
      </div>

      {/* Pro expired banner */}
      {proExpired && (
        <a href="/pricing" className="card fade-in" style={{
          padding: "1rem 1.25rem",
          background: "var(--primary-light)",
          border: "1.5px solid var(--primary)",
          marginBottom: "1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          textDecoration: "none", gap: "1rem",
        }}>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
              Your free trial has ended
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--subtext)" }}>
              Subscribe to keep your momentum going
            </div>
          </div>
          <span style={{
            fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)",
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            Subscribe →
          </span>
        </a>
      )}

      {/* No goals — prompt to create one */}
      {goals.length === 0 && (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"🎯"}</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Get started
          </h2>
          <p style={{ color: "var(--subtext)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Create your first goal and we'll generate daily tasks to help you achieve it.
          </p>
          <a
            href="/goals?add=true"
            className="btn btn-primary"
            style={{ fontSize: "1rem", padding: "0.75rem 2rem", textDecoration: "none" }}
          >
            Create your first goal {"→"}
          </a>
        </div>
      )}

      {/* Has goals but no selection yet — auto-open picker */}
      {goals.length > 0 && selectedGoalId === null && !goalPickerOpen && dailyTasks.length === 0 && (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"🎯"}</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
            What do you want to work on today?
          </h2>
          <p style={{ color: "var(--subtext)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Pick a goal to focus on and we{"'"}ll generate your tasks.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setGoalPickerOpen(true)}
            style={{ fontSize: "1rem", padding: "0.75rem 2rem" }}
          >
            Choose a goal
          </button>
        </div>
      )}

      {/* Rest day */}
      {goals.length > 0 && restDay && !generating && (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"😌"}</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
            No goals scheduled for today
          </h2>
          <p style={{ color: "var(--subtext)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Enjoy your rest day. You{"'"}ll be back at it tomorrow!
          </p>
        </div>
      )}

      {/* Loading skeleton during auto-generate */}
      {goals.length > 0 && generating && dailyTasks.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {goals.length > 0 && dailyTasks.length > 0 && selectedGoalId !== null && (
        <>
          {/* Goal selector + progress */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.875rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>
                  {selectedGoalId === null ? "Select a goal" : selectedGoalId === "all" ? "Mix all goals" : goals.find(g => g.id === selectedGoalId)?.title ?? "Select goal"}
                </span>
                <button
                  onClick={() => setGoalPickerOpen(true)}
                  style={{
                    fontSize: "0.75rem", fontWeight: 600,
                    color: "var(--primary)", background: "var(--primary-light)",
                    border: "none", borderRadius: 20, padding: "3px 10px",
                    cursor: "pointer",
                  }}
                >
                  {goals.length > 1 ? "Change" : "Select"}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {totalEstimatedMinutes > 0 && (
                  <span style={{
                    fontSize: "0.75rem", fontWeight: 600,
                    color: "var(--primary)",
                    background: "var(--primary-light)",
                    borderRadius: 20, padding: "2px 10px",
                  }}>
                    ~{formatMinutes(totalEstimatedMinutes)}
                  </span>
                )}
                <span style={{
                  fontSize: "0.85rem", fontWeight: 600,
                  color: allDone ? "var(--success)" : "var(--subtext)",
                }}>
                  {completedCount}/{totalCount} tasks complete
                </span>
              </div>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%`, background: allDone ? "var(--success)" : undefined }} />
            </div>
          </div>

          {/* Coach note card */}
          {insight && (
            <div className="card fade-in" style={{
              padding: "1.25rem",
              background: "rgba(99,91,255,0.08)",
              border: "1px solid rgba(99,91,255,0.2)",
              marginBottom: "1.25rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)", margin: 0 }}>
                  ✦ Coach note
                </p>
                <button
                  onClick={() => setInsight(null)}
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--primary)",
                    background: "rgba(99,91,255,0.12)",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 12px",
                    cursor: "pointer",
                  }}
                >
                  Got it
                </button>
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.6, margin: 0 }}>
                {insight}
              </p>
              {generating && (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 8, margin: 0 }}>
                  <span className="spinner" style={{ marginRight: 6 }} />Generating next tasks...
                </p>
              )}
            </div>
          )}

          {/* Today's tasks */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
            marginBottom: "1.25rem",
          }}>
            {displayedTasks.map(({ dt, task }, i) => (
              <div key={task.id} className="slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <TaskCard
                  task={task}
                  onToggle={(taskItemId, isCompleted) =>
                    handleToggle(dt.id, taskItemId, isCompleted)
                  }
                  onSkip={(taskItemId) =>
                    handleSkipToday(dt.id, taskItemId)
                  }
                  onReschedule={(taskItemId) =>
                    handleRescheduleToday(dt.id, taskItemId)
                  }
                  onRefine={(taskItemId, userRequest) =>
                    handleRefineTask(dt.id, taskItemId, userRequest)
                  }
                />
              </div>
            ))}
          </div>

          {/* Actions bar */}
          {allDone && !insight ? (
            <div className="give-more-bar unlocked">
              <button
                onClick={handleGiveMore}
                disabled={generating}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#fff", color: "var(--primary)",
                  fontWeight: 700, fontSize: "0.95rem",
                  padding: "0.7rem 1.5rem", borderRadius: "var(--radius)",
                  border: "none", cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  transition: "transform 0.15s",
                }}
              >
                {generating ? <><span className="spinner spinner-dark" style={{ width: 18, height: 18 }} /> Loading...</> : "🚀 Give me more"}
              </button>
              <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                All done! Ready for the next challenge?
              </span>
            </div>
          ) : !insight && totalCount > 0 ? (
            <div className="give-more-bar locked">
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--bg)", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
              }}>
                {"🔒"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                  Complete all {totalCount} tasks to unlock more
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {completedCount}/{totalCount} done — {totalCount - completedCount} remaining
                </div>
              </div>
              {incompleteCount >= 2 && (
                <button
                  className="btn btn-outline"
                  onClick={handleCompleteAll}
                  disabled={completingAll}
                  style={{ fontSize: "0.8rem", flexShrink: 0 }}
                >
                  {completingAll ? <><span className="spinner" style={{ width: 14, height: 14 }} /> ...</> : "✓ Complete all"}
                </button>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* Review modal */}
      {showReview && reviewDailyTaskId && (
        <ReviewModal
          dailyTaskId={reviewDailyTaskId}
          onComplete={handleReviewComplete}
          onClose={() => setShowReview(false)}
        />
      )}

      {/* Goal picker modal (with metadata) */}
      {goalPickerOpen && (
        <div className="modal-overlay" onClick={() => { if (selectedGoalId !== null) setGoalPickerOpen(false); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
              What are you working on today?
            </h2>
            <p style={{ color: "var(--subtext)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              Pick a goal to focus on
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {goals.map(g => {
                const isSelected = selectedGoalId === g.id;
                const stat = goalStats.find(s => s.goalId === g.id);
                const days = daysSince(stat?.lastWorkedAt ?? null);
                return (
                  <button
                    key={g.id}
                    onClick={() => pickGoal(g.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.875rem 1rem", borderRadius: "var(--radius)",
                      border: `2px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                      background: isSelected ? "var(--primary-light)" : "var(--card)",
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 500, color: isSelected ? "var(--primary)" : "var(--text)", fontSize: "0.95rem" }}>
                        {g.title}
                      </span>
                      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.72rem", color: stalenessColor(days) }}>
                          {stalenessLabel(days)}
                        </span>
                      </div>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {stat && stat.overdueCount > 0 && (
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 600,
                          color: "var(--warning)", background: "var(--warning-light)",
                          borderRadius: 20, padding: "2px 8px",
                        }}>
                          {stat.overdueCount} overdue
                        </span>
                      )}
                      {g.dailyTimeMinutes && (
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 600,
                          color: "var(--primary)", background: "var(--primary-light)",
                          borderRadius: 20, padding: "2px 8px",
                        }}>
                          ~{formatMinutes(g.dailyTimeMinutes)}/day
                        </span>
                      )}
                      {isSelected && <span style={{ color: "var(--primary)", fontWeight: 700 }}>{"✓"}</span>}
                    </span>
                  </button>
                );
              })}
              {goals.length > 1 && (
                <button
                  onClick={() => pickGoal("all")}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.875rem 1rem", borderRadius: "var(--radius)",
                    border: `2px solid ${selectedGoalId === "all" ? "var(--primary)" : "var(--border)"}`,
                    background: selectedGoalId === "all" ? "var(--primary-light)" : "var(--card)",
                    cursor: "pointer", textAlign: "left", marginTop: 4,
                  }}
                >
                  <span style={{ fontWeight: 500, color: selectedGoalId === "all" ? "var(--primary)" : "var(--text)", fontSize: "0.95rem" }}>
                    {"✦"} Mix all goals
                  </span>
                  {selectedGoalId === "all" && <span style={{ color: "var(--primary)", fontWeight: 700 }}>{"✓"}</span>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
