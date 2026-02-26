"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
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
  task, onToggle, onSkip, onReschedule, onEdit, onRefine, readonly = false, overdue = false,
}: {
  task: TaskItem;
  onToggle?: (id: string, done: boolean) => void;
  onSkip?: (id: string) => void;
  onReschedule?: (id: string) => void;
  onEdit?: (id: string, data: { task?: string; description?: string }) => void;
  onRefine?: (id: string, userRequest: string) => void;
  readonly?: boolean;
  overdue?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [refineMode, setRefineMode] = useState(false);
  const [editName, setEditName] = useState(task.task);
  const [editDesc, setEditDesc] = useState(task.description);
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

  function handleStartEdit() {
    setMenuOpen(false);
    setEditName(task.task);
    setEditDesc(task.description);
    setEditMode(true);
  }

  function handleSaveEdit() {
    onEdit?.(task.id, { task: editName, description: editDesc });
    setEditMode(false);
  }

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
      className="card"
      style={{
        padding: "1rem 1.25rem",
        opacity: task.isCompleted || task.isSkipped ? 0.7 : 1,
        transition: "opacity 0.2s",
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
        {editMode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              className="field-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Task name"
              style={{ fontSize: "0.9rem", padding: "6px 10px" }}
            />
            <input
              className="field-input"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Description"
              style={{ fontSize: "0.85rem", padding: "6px 10px" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-primary" onClick={handleSaveEdit} style={{ fontSize: "0.8rem", padding: "4px 12px" }}>
                Save
              </button>
              <button className="btn btn-outline" onClick={() => setEditMode(false)} style={{ fontSize: "0.8rem", padding: "4px 12px" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : refineMode ? (
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
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: "0.75rem", color: "var(--muted)",
              background: "var(--bg)", borderRadius: 20,
              padding: "2px 8px",
            }}>
              {"⏱"} {task.estimated_minutes} min
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
              {onEdit && (
                <button onClick={handleStartEdit} style={menuItemStyle}>
                  Edit task
                </button>
              )}
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
  const [overdueTasks, setOverdueTasks] = useState<DailyTask[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<"all" | string | null>(null);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [reviewDailyTaskId, setReviewDailyTaskId] = useState<string | null>(null);
  const [overdueBannerDismissed, setOverdueBannerDismissed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [completingAll, setCompletingAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [appNudgeDismissed, setAppNudgeDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tasksRes, goalsRes, statsRes] = await Promise.all([
        tasksApi.today(true),
        goalsApi.list(),
        statsApi.get(),
      ]);
      setDailyTasks(tasksRes.dailyTasks);
      setOverdueTasks(tasksRes.overdueTasks ?? []);
      setGoals(goalsRes.goals);
      setGoalStats(statsRes.goalStats ?? []);

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

      // Restore overdue banner dismissal
      const bannerKey = `threely_overdue_banner_${new Date().toISOString().slice(0, 10)}`;
      if (sessionStorage.getItem(bannerKey)) setOverdueBannerDismissed(true);
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
    if (selectedGoalId === "overdue") return [];
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

  // Overdue tasks for current goal
  const displayedOverdue = (() => {
    if (selectedGoalId === null) return [];
    const tasks: { dt: DailyTask; task: TaskItem }[] = [];
    const relevantOverdue = selectedGoalId === "all" || selectedGoalId === "overdue"
      ? overdueTasks
      : overdueTasks.filter(dt => dt.goalId === selectedGoalId);
    for (const dt of relevantOverdue) {
      for (const task of dt.tasks) {
        if (!task.isCompleted && !task.isSkipped) {
          tasks.push({ dt, task });
        }
      }
    }
    return tasks;
  })();

  // Overdue count on OTHER goals (for banner)
  const otherGoalsOverdueCount = (() => {
    if (selectedGoalId === "all" || selectedGoalId === "overdue") return 0;
    return overdueTasks
      .filter(dt => dt.goalId !== selectedGoalId)
      .reduce((sum, dt) => {
        return sum + dt.tasks.filter(t => !t.isCompleted && !t.isSkipped).length;
      }, 0);
  })();

  const displayedItems = displayedTasks.map(x => x.task);
  const displayedOverdueItems = displayedOverdue.slice(0, 3).map(x => x.task);
  const allDisplayedItems = [...displayedOverdueItems, ...displayedItems];
  const completedCount = allDisplayedItems.filter(t => t.isCompleted).length;
  const totalCount = allDisplayedItems.length;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalEstimatedMinutes = allDisplayedItems
    .filter(t => !t.isCompleted)
    .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  const totalOverdueCount = overdueTasks.reduce((sum, dt) => {
    return sum + dt.tasks.filter(t => !t.isCompleted && !t.isSkipped).length;
  }, 0);

  function pickGoal(val: "all" | string) {
    setSelectedGoalId(val);
    setGoalPickerOpen(false);
    sessionStorage.setItem(`threely_focus_${new Date().toISOString().slice(0, 10)}`, val);
  }

  function dismissOverdueBanner() {
    setOverdueBannerDismissed(true);
    const bannerKey = `threely_overdue_banner_${new Date().toISOString().slice(0, 10)}`;
    sessionStorage.setItem(bannerKey, "1");
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await tasksApi.generate();
      setDailyTasks(res.dailyTasks);

    } catch {
      showToast("Failed to generate tasks", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggle(dailyTaskId: string, taskItemId: string, isCompleted: boolean) {
    try {
      const res = await tasksApi.toggleTask(dailyTaskId, taskItemId, isCompleted);
      // Update in both today and overdue lists
      const newDailyTasks = dailyTasks.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt);
      setDailyTasks(newDailyTasks);
      setOverdueTasks(prev =>
        prev.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt)
      );

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

  async function handleSkip(dailyTaskId: string, taskItemId: string) {
    try {
      const res = await tasksApi.skip(dailyTaskId, taskItemId);
      setOverdueTasks(prev =>
        prev.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt)
      );
    } catch {
      showToast("Failed to skip task", "error");
    }
  }

  async function handleReschedule(dailyTaskId: string, taskItemId: string) {
    try {
      const res = await tasksApi.reschedule(dailyTaskId, taskItemId);
      setOverdueTasks(prev =>
        prev.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt)
      );
      showToast("Task moved to tomorrow", "success");
    } catch {
      showToast("Failed to reschedule task", "error");
    }
  }

  async function handleEditTask(dailyTaskId: string, taskItemId: string, editData: { task?: string; description?: string }) {
    try {
      const res = await tasksApi.editItem(dailyTaskId, taskItemId, editData);
      setDailyTasks(prev =>
        prev.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt)
      );
      setOverdueTasks(prev =>
        prev.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt)
      );
      showToast("Task updated", "success");
    } catch {
      showToast("Failed to edit task", "error");
    }
  }

  async function handleRefineTask(dailyTaskId: string, taskItemId: string, userRequest: string) {
    try {
      const res = await tasksApi.refineItem(dailyTaskId, taskItemId, userRequest);
      setDailyTasks(prev =>
        prev.map(dt => dt.id === dailyTaskId ? { ...dt, tasks: res.dailyTask.tasks } : dt)
      );
      setOverdueTasks(prev =>
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
      const tasksRes = await tasksApi.today(true);
      setDailyTasks(tasksRes.dailyTasks);
      setOverdueTasks(tasksRes.overdueTasks ?? []);
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
    const dt = selectedGoalId !== "all" && selectedGoalId !== "overdue"
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
      const goalId = selectedGoalId && selectedGoalId !== "all" && selectedGoalId !== "overdue" ? selectedGoalId : undefined;
      const res = await tasksApi.generate({ postReview: true, goalId });
      setDailyTasks(res.dailyTasks);

    } catch {
      showToast("Failed to generate next tasks", "error");
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

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 4 }}>{todayStr()}</p>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
          {greeting()} {"👋"}
        </h1>
      </div>

      {/* Overdue banner for other goals */}
      {otherGoalsOverdueCount > 0 && !overdueBannerDismissed && (
        <div className="card fade-in" style={{
          padding: "0.875rem 1.25rem",
          background: "var(--warning-light)",
          border: "1px solid var(--warning)",
          marginBottom: "1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "0.875rem", color: "var(--text)" }}>
            You have <strong>{otherGoalsOverdueCount}</strong> overdue task{otherGoalsOverdueCount > 1 ? "s" : ""} on other goals
          </span>
          <button
            onClick={dismissOverdueBanner}
            style={{ fontSize: 16, color: "var(--muted)", padding: "2px 6px" }}
          >
            {"✕"}
          </button>
        </div>
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

      {/* Has goals but no tasks yet */}
      {goals.length > 0 && selectedGoalId !== null && displayedTasks.length === 0 && displayedOverdue.length === 0 && (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"✨"}</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Ready to get started?
          </h2>
          <p style={{ color: "var(--subtext)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Generate your first 3 tasks for today.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
            style={{ fontSize: "1rem", padding: "0.75rem 2rem" }}
          >
            {generating ? <><span className="spinner" /> Generating...</> : "Generate today's tasks ✨"}
          </button>
        </div>
      )}

      {goals.length > 0 && (dailyTasks.length > 0 || overdueTasks.length > 0) && (selectedGoalId !== null || goalPickerOpen) && (
        <>
          {/* Goal selector + progress */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.875rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>
                  {selectedGoalId === null ? "Select a goal" : selectedGoalId === "overdue" ? "Overdue tasks" : selectedGoalId === "all" ? "Mix all goals" : goals.find(g => g.id === selectedGoalId)?.title ?? "Select goal"}
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

          {/* Insight card */}
          {insight && (
            <div className="card fade-in" style={{
              padding: "1.25rem",
              background: "var(--success-light)",
              border: "1px solid rgba(62,207,142,0.25)",
              marginBottom: "1.25rem",
            }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--success)", marginBottom: 6 }}>
                Coach insight
              </p>
              <p style={{ fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.6 }}>
                {insight}
              </p>
              {generating && (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 8 }}>
                  <span className="spinner" style={{ marginRight: 6 }} />Generating next tasks...
                </p>
              )}
            </div>
          )}

          {/* Overdue tasks section (paginated, 3 at a time) */}
          {displayedOverdue.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: "0.75rem",
              }}>
                <span style={{
                  fontSize: "0.8rem", fontWeight: 700, color: "var(--warning)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  Overdue
                </span>
                <span style={{
                  fontSize: "0.7rem", fontWeight: 600,
                  color: "var(--warning)", background: "var(--warning-light)",
                  borderRadius: 20, padding: "1px 8px",
                }}>
                  {displayedOverdue.length}
                </span>
              </div>
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
              }}>
                {displayedOverdue.slice(0, 3).map(({ dt, task }, i) => (
                  <div key={task.id} className="slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
                    <TaskCard
                      task={task}
                      overdue
                      onToggle={(taskItemId, isCompleted) =>
                        handleToggle(dt.id, taskItemId, isCompleted)
                      }
                      onSkip={(taskItemId) =>
                        handleSkip(dt.id, taskItemId)
                      }
                      onReschedule={(taskItemId) =>
                        handleReschedule(dt.id, taskItemId)
                      }
                      onEdit={(taskItemId, data) =>
                        handleEditTask(dt.id, taskItemId, data)
                      }
                      onRefine={(taskItemId, userRequest) =>
                        handleRefineTask(dt.id, taskItemId, userRequest)
                      }
                    />
                  </div>
                ))}
              </div>
              {displayedOverdue.length > 3 && (
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 8, textAlign: "center" }}>
                  +{displayedOverdue.length - 3} more overdue &mdash; handle these to see the rest
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
                  onEdit={(taskItemId, data) =>
                    handleEditTask(dt.id, taskItemId, data)
                  }
                  onRefine={(taskItemId, userRequest) =>
                    handleRefineTask(dt.id, taskItemId, userRequest)
                  }
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {/* Complete All button — shown when 2+ tasks remain incomplete */}
            {incompleteCount >= 2 && !allDone && (
              <button
                className="btn btn-outline"
                onClick={handleCompleteAll}
                disabled={completingAll}
                style={{ fontSize: "0.85rem" }}
              >
                {completingAll ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Completing...</> : "\u2713 Complete all"}
              </button>
            )}

            {allDone && !insight ? (
              <button
                className="btn btn-primary"
                onClick={handleGiveMore}
                disabled={generating}
                style={{ fontSize: "0.9rem" }}
              >
                {generating ? <><span className="spinner" /> Loading...</> : "🚀 Give me more"}
              </button>
            ) : !insight && totalCount > 0 && (
              <>
                <button
                  className="btn btn-outline"
                  disabled
                  style={{ fontSize: "0.9rem", opacity: 0.5, cursor: "not-allowed" }}
                >
                  {"🔒"} Give me more
                </button>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  Complete all {totalCount} tasks to unlock
                </span>
              </>
            )}
          </div>
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
              {totalOverdueCount > 0 && (
                <button
                  onClick={() => pickGoal("overdue")}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.875rem 1rem", borderRadius: "var(--radius)",
                    border: `2px solid ${selectedGoalId === "overdue" ? "var(--warning)" : "var(--warning)"}`,
                    background: selectedGoalId === "overdue" ? "var(--warning-light)" : "var(--warning-light)",
                    cursor: "pointer", textAlign: "left", marginTop: 4,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--warning)", fontSize: "0.95rem" }}>
                    Overdue tasks
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 600,
                      color: "#fff", background: "var(--warning)",
                      borderRadius: 20, padding: "2px 8px",
                    }}>
                      {totalOverdueCount} overdue
                    </span>
                    {selectedGoalId === "overdue" && <span style={{ color: "var(--warning)", fontWeight: 700 }}>{"✓"}</span>}
                  </span>
                </button>
              )}
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
