"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, getNickname } from "@/lib/auth-context";
import { formatDisplayName } from "@/lib/format-name";
import {
  tasksApi, goalsApi, reviewsApi, insightsApi, statsApi,
  type DailyTask, type TaskItem, type Goal, type GoalStat,
} from "@/lib/api-client";
import { SkeletonCard } from "@/components/Skeleton";
import Confetti from "@/components/Confetti";
import { useToast } from "@/components/ToastProvider";
import { useSubscription } from "@/lib/subscription-context";

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

const DIFFICULTY_OPTIONS = [
  { value: "too_easy", label: "Too easy" },
  { value: "just_right", label: "Just right" },
  { value: "challenging", label: "Challenging" },
  { value: "overwhelming", label: "Overwhelming" },
];

// ─── Task Card ────────────────────────────────────────────────────────────────

const RESOURCE_ICONS_WEB: Record<string, string> = {
  youtube_channel: "\u25B6",
  tool: "\u2699",
  website: "\uD83D\uDD17",
  book: "\uD83D\uDCD6",
  app: "\uD83D\uDCF1",
};

function TaskCard({
  task, onToggle, onSkip, onReschedule, onRefine, onAsk, readonly = false, overdue = false,
}: {
  task: TaskItem;
  onToggle?: (id: string, done: boolean) => void;
  onSkip?: (id: string) => void;
  onReschedule?: (id: string) => void;
  onRefine?: (id: string, userRequest: string) => void;
  onAsk?: (id: string, messages: { role: "user" | "assistant"; content: string }[]) => Promise<string>;
  readonly?: boolean;
  overdue?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [refineMode, setRefineMode] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ask mode state
  const [askMode, setAskMode] = useState(false);
  const [askMessages, setAskMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const askEndRef = useRef<HTMLDivElement>(null);
  const askInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    askEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [askMessages, askLoading]);

  // Focus input when modal opens
  useEffect(() => {
    if (askMode) setTimeout(() => askInputRef.current?.focus(), 100);
  }, [askMode]);

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
    setAskMode(false);
  }

  function handleStartAsk() {
    setMenuOpen(false);
    setAskMode(true);
    setAskMessages([]);
    setAskInput("");
    setRefineMode(false);
  }

  async function handleSubmitRefine() {
    if (!refineInput.trim()) return;
    setRefining(true);
    onRefine?.(task.id, refineInput.trim());
    setRefining(false);
    setRefineMode(false);
  }

  async function handleSendAsk() {
    if (!askInput.trim() || askLoading || !onAsk) return;
    const userMsg = { role: "user" as const, content: askInput.trim() };
    const newMessages = [...askMessages, userMsg];
    setAskMessages(newMessages);
    setAskInput("");
    setAskLoading(true);
    try {
      const answer = await onAsk(task.id, newMessages);
      setAskMessages(prev => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setAskMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setAskLoading(false);
    }
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
        flexDirection: "column",
        gap: "0.5rem",
        borderColor: overdue ? "var(--warning)" : undefined,
      }}
    >
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        {!readonly && (
          <button
            className={`task-checkbox${task.isCompleted ? " checked" : ""}`}
            onClick={() => onToggle?.(task.id, !task.isCompleted)}
            style={{ marginTop: 2 }}
          >
            {task.isCompleted && "\u2713"}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  color: task.isCompleted ? "var(--muted)" : "var(--text)",
                  textDecoration: task.isCompleted ? "line-through" : "none",
                  lineHeight: 1.4,
                }}>
                  {task.task}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  <span style={{
                    fontSize: "0.72rem", fontWeight: 600,
                    color: "var(--muted)", background: "var(--bg)",
                    borderRadius: 20, padding: "2px 8px",
                    whiteSpace: "nowrap",
                  }}>
                    {task.estimated_minutes}m
                  </span>
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
              </div>
              <div style={{ fontSize: "0.84rem", color: "var(--subtext)", marginTop: 4, lineHeight: 1.5 }}>
                {task.description}
              </div>
              {/* Resources */}
              {task.resources && task.resources.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {task.resources.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <span style={{ fontSize: "0.8rem", flexShrink: 0, marginTop: 1 }}>
                        {RESOURCE_ICONS_WEB[r.type] ?? "\uD83D\uDD17"}
                      </span>
                      <div>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>{r.name}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--subtext)", marginLeft: 4 }}>{r.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Visible Ask AI button */}
              {showMenu && onAsk && !askMode && (
                <button
                  onClick={handleStartAsk}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    marginTop: 10, padding: "5px 12px",
                    fontSize: "0.8rem", fontWeight: 600,
                    color: "var(--primary)", background: "var(--primary-light)",
                    border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                    borderRadius: 20, cursor: "pointer",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--primary) 15%, transparent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--primary-light)"; }}
                >
                  <span style={{ fontSize: "0.75rem" }}>&#10022;</span>
                  Ask AI
                </button>
              )}
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
                {onAsk && (
                  <button onClick={handleStartAsk} style={menuItemStyle}>
                    Ask about this
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

      {/* Ask AI modal overlay */}
      {askMode && onAsk && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => { setAskMode(false); setAskMessages([]); setAskInput(""); }}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
              zIndex: 1000, backdropFilter: "blur(2px)",
            }}
          />
          {/* Modal */}
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(480px, 92vw)",
            maxHeight: "min(600px, 80vh)",
            background: "var(--card)",
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px var(--border)",
            zIndex: 1001,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, color: "var(--primary)" }}>&#10022;</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--primary)" }}>Threely Intelligence</span>
              </div>
              <button
                onClick={() => { setAskMode(false); setAskMessages([]); setAskInput(""); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "1.1rem", color: "var(--muted)", padding: "4px 8px",
                  borderRadius: 6, lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
              >
                &#x2715;
              </button>
            </div>

            {/* Task context pill */}
            <div style={{
              padding: "10px 20px",
              background: "var(--bg)",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: "0.78rem", color: "var(--subtext)" }}>
                Asking about: <strong style={{ color: "var(--text)" }}>{task.task}</strong>
              </span>
            </div>

            {/* Chat messages */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "16px 20px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* AI greeting */}
              <div style={{
                alignSelf: "flex-start", maxWidth: "85%",
                padding: "10px 14px", borderRadius: 14,
                background: "var(--bg)", border: "1px solid var(--border)",
                fontSize: "0.86rem", lineHeight: 1.55, color: "var(--text)",
              }}>
                Hey! What would you like to know about this task? I can help with approach, tips, resources, or anything else.
              </div>

              {askMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius: 14,
                    fontSize: "0.86rem",
                    lineHeight: 1.55,
                    ...(msg.role === "user"
                      ? { background: "var(--primary)", color: "#fff" }
                      : { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }),
                  }}
                >
                  {msg.content}
                </div>
              ))}
              {askLoading && (
                <div style={{
                  alignSelf: "flex-start", padding: "10px 14px", borderRadius: 14,
                  background: "var(--bg)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  <span style={{ fontSize: "0.8rem", color: "var(--subtext)" }}>Thinking...</span>
                </div>
              )}
              <div ref={askEndRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: "12px 20px 16px",
              borderTop: "1px solid var(--border)",
              display: "flex", gap: 8,
            }}>
              <input
                ref={askInputRef}
                className="field-input"
                value={askInput}
                onChange={e => setAskInput(e.target.value)}
                placeholder="Type your question..."
                onKeyDown={e => e.key === "Enter" && handleSendAsk()}
                style={{ flex: 1, fontSize: "0.88rem", padding: "10px 14px", borderRadius: 10 }}
                disabled={askLoading}
              />
              <button
                className="btn btn-primary"
                onClick={handleSendAsk}
                disabled={askLoading || !askInput.trim()}
                style={{ fontSize: "0.85rem", padding: "8px 18px", borderRadius: 10 }}
              >
                Send
              </button>
            </div>
          </div>
        </>
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
  const { hasPro, showPaywall } = useSubscription();
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [reviewDailyTaskId, setReviewDailyTaskId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWorkAhead, setShowWorkAhead] = useState(false);
  const [completingAll, setCompletingAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [appNudgeDismissed, setAppNudgeDismissed] = useState(false);
  const [showGenLimit, setShowGenLimit] = useState(false);
  const [restDay, setRestDay] = useState(false);
  const hasAutoGenerated = useRef(false);
  const recentlyToggledRef = useRef<Set<string>>(new Set());
  const [sortTrigger, setSortTrigger] = useState(0);

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

      // Restore saved focus or auto-select
      const todayKey = `threely_focus_${new Date().toLocaleDateString("en-CA")}`;
      const saved = localStorage.getItem(todayKey);
      const savedIsValid = saved !== null && saved !== "all" && goalsRes.goals.some(g => g.id === saved);
      if (saved && savedIsValid) {
        setSelectedGoalId(saved);
      } else if (goalsRes.goals.length === 1) {
        const onlyGoalId = goalsRes.goals[0].id;
        setSelectedGoalId(onlyGoalId);
        localStorage.setItem(todayKey, onlyGoalId);
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
            showPaywall();
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

  // Trial paywall (shown once after first registration)
  useEffect(() => {
    if (loading || !user) return;
    const key = `threely_show_trial_paywall_${user.id}`;
    const flag = localStorage.getItem(key);
    if (flag) {
      localStorage.removeItem(key);
      showPaywall("fullscreen");
    }
  }, [loading, user, showPaywall]);

  // Refetch when tab becomes visible (sync across devices)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _sort = sortTrigger; // subscribe to sort trigger for delayed reorder

  const displayedTasks = (() => {
    if (selectedGoalId === null) return [];
    const dt = dailyTasks.find(d => d.goalId === selectedGoalId);
    if (!dt) return [];
    const items = dt.tasks.slice(-3).map(task => ({ dt, task }));

    // Sort: incomplete first, completed last (recently toggled stay in place)
    const incomplete = items.filter(x => !x.task.isCompleted || recentlyToggledRef.current.has(x.task.id));
    const completed = items.filter(x => x.task.isCompleted && !recentlyToggledRef.current.has(x.task.id));
    return [...incomplete, ...completed];
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

  function pickGoal(val: string) {
    setSelectedGoalId(val);
    setGoalPickerOpen(false);
    localStorage.setItem(`threely_focus_${new Date().toLocaleDateString("en-CA")}`, val);
  }

  function handlePickGoalWithOffDayCheck(goalId: string) {
    const stat = goalStats.find(s => s.goalId === goalId);
    const offDay = stat && !isWorkDay(stat.workDays);
    if (offDay) {
      const dayNames = formatWorkDaysList(stat.workDays);
      if (!window.confirm(`This goal is scheduled for ${dayNames}. Would you like to work on it today?`)) return;
    }
    pickGoal(goalId);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!hasPro) { showPaywall(); return; }
    setGenerating(true);
    try {
      const res = await tasksApi.generate();
      setDailyTasks(res.dailyTasks);

    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("pro_required")) {
        showPaywall();
      } else {
        showToast("Failed to generate tasks", "error");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggle(dailyTaskId: string, taskItemId: string, isCompleted: boolean) {
    // Delay sort when completing (so user sees checkmark first); sort immediately when unchecking
    if (isCompleted) {
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

      // Check if all displayed tasks are now complete to trigger confetti
      if (isCompleted) {
        const currentDisplayed = (() => {
          if (selectedGoalId === null) return [];
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

  async function handleAskAboutTask(dailyTaskId: string, taskItemId: string, messages: { role: "user" | "assistant"; content: string }[]) {
    const res = await tasksApi.askAboutTask(dailyTaskId, taskItemId, messages);
    return res.answer;
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
    if (incomplete.length === 0) return;
    setCompletingAll(true);
    try {
      // Sequential to avoid race condition — each PATCH reads/writes the same JSON array
      for (const { dt, task } of incomplete) {
        await tasksApi.toggleTask(dt.id, task.id, true);
      }
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
    if (!hasPro) { showPaywall(); return; }
    setShowWorkAhead(true);
  }

  function confirmWorkAhead() {
    setShowWorkAhead(false);
    const dt = dailyTasks.find(d => d.goalId === selectedGoalId);
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
      const goalId = selectedGoalId ?? undefined;
      const res = await tasksApi.generate({ postReview: true, goalId });
      setDailyTasks(res.dailyTasks);

    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("pro_required")) {
        showPaywall();
      } else if (err instanceof Error && err.message?.includes("generation_limit_reached")) {
        setShowGenLimit(true);
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

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 4 }}>{todayStr()}</p>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em" }}>
          {greeting()}, {(() => {
            const raw = getNickname() || user?.email?.split("@")[0] || "";
            const formatted = formatDisplayName(raw);
            const first = formatted.split(" ")[0] || "there";
            return first;
          })()} {"👋"}
        </h1>
      </div>

      {/* Limited mode banner */}
      {!hasPro && (
        <button onClick={() => showPaywall()} className="card fade-in" style={{
          padding: "1rem 1.25rem",
          background: "var(--primary-light)",
          border: "1.5px solid var(--primary)",
          marginBottom: "1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          textDecoration: "none", gap: "1rem", width: "100%", cursor: "pointer",
          textAlign: "left",
        }}>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
              Unlock Threely Pro
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--subtext)" }}>
              Start your free trial for AI-powered tasks
            </div>
          </div>
          <span style={{
            fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)",
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            Try Free {"\u2192"}
          </span>
        </button>
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
          <p style={{ textAlign: "center", marginTop: "0.5rem", color: "var(--subtext)", fontSize: "0.875rem", lineHeight: 1.6 }}>
            <strong>This can take a couple of minutes.</strong>
            <br />
            Feel free to leave this page — your tasks will be ready when you come back.
          </p>
        </div>
      )}

      {goals.length > 0 && dailyTasks.length > 0 && selectedGoalId !== null && (
        <>
          {/* Goal selector + progress */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            {/* Goal selector row */}
            <div
              onClick={() => { if (goals.length > 1) setGoalPickerOpen(true); }}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                marginBottom: "0.875rem",
                cursor: goals.length > 1 ? "pointer" : "default",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius)",
                background: goals.length > 1 ? "var(--bg)" : "transparent",
                border: goals.length > 1 ? "1px solid var(--border)" : "none",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { if (goals.length > 1) e.currentTarget.style.borderColor = "var(--primary)"; }}
              onMouseLeave={e => { if (goals.length > 1) e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", flex: 1, minWidth: 0 }}>
                {selectedGoalId === null ? "Select a goal" : goals.find(g => g.id === selectedGoalId)?.title ?? "Select goal"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
                  {completedCount}/{totalCount}
                </span>
              </div>
              {goals.length > 1 && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {/* Progress bar */}
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%`, background: allDone ? "var(--success)" : undefined }} />
            </div>
          </div>

          {/* Complete all bar — shown above tasks when not all done */}
          {!allDone && !insight && totalCount > 0 && (
            <div className="give-more-bar locked" style={{ marginBottom: "1.25rem" }}>
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
              {incompleteCount >= 1 && (
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
          )}

          {/* Give me more bar — shown above tasks when all done */}
          {allDone && !insight && (
            <div className="give-more-bar unlocked" data-walkthrough="get-more-button" style={{ marginBottom: "1.25rem" }}>
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
                {generating ? <><span className="spinner spinner-dark" style={{ width: 18, height: 18 }} /> Generating...</> : "🚀 Get more tasks"}
              </button>
              <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                {generating ? <><strong>This can take a couple of minutes.</strong> Hang tight!</> : "Great work! Review and get your next steps."}
              </span>
            </div>
          )}

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
              <div key={task.id} className="slide-up" style={{ animationDelay: `${i * 0.08}s` }} {...(i === 0 ? { "data-walkthrough": "first-task-card" } : {})}>
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
                  onAsk={(taskItemId, messages) =>
                    handleAskAboutTask(dt.id, taskItemId, messages)
                  }
                />
              </div>
            ))}
          </div>

        </>
      )}

      {/* Work Ahead confirmation modal */}
      {showWorkAhead && (
        <div className="modal-overlay" onClick={() => setShowWorkAhead(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: "center", padding: "2rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Work Ahead?
            </h2>
            <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              We automatically create new tasks for you each day. Are you sure you want to generate more now?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={confirmWorkAhead}
                style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }}
              >
                Generate More
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowWorkAhead(false)}
                style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generation limit modal */}
      {showGenLimit && (
        <div className="modal-overlay" onClick={() => setShowGenLimit(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, padding: "2rem" }}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <span style={{ fontSize: "2rem" }}>🚀</span>
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center", marginBottom: 8 }}>
              You&apos;re on a roll!
            </h2>
            <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.6, textAlign: "center", marginBottom: "1.5rem" }}>
              You&apos;ve already gotten extra tasks for this goal today. Instead of generating more, try these:
            </p>

            <div style={{ textAlign: "left", marginBottom: "1.5rem" }}>
              <p style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>
                ✦ Refine a task
              </p>
              <p style={{ color: "var(--subtext)", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "1rem" }}>
                Click on any task to expand it, then hit the <span style={{ fontWeight: 700, color: "var(--primary)" }}>✦ Refine</span> button and tell the AI what to change. Need it harder? Shorter? More specific? Just ask.
              </p>

              <p style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>
                ⚙ Adjust your plan
              </p>
              <p style={{ color: "var(--subtext)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                Increase your daily time or intensity in goal settings for automatically tougher, more in-depth tasks tomorrow.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowGenLimit(false);
                  window.location.href = "/goals";
                }}
                style={{ flex: 1, padding: "0.75rem", fontSize: "0.9rem" }}
              >
                Adjust my plan
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowGenLimit(false)}
                style={{ flex: 1, padding: "0.75rem", fontSize: "0.9rem" }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
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
                const offDay = stat ? !isWorkDay(stat.workDays) : false;
                return (
                  <button
                    key={g.id}
                    onClick={() => handlePickGoalWithOffDayCheck(g.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.875rem 1rem", borderRadius: "var(--radius)",
                      border: `2px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                      background: isSelected ? "var(--primary-light)" : "var(--card)",
                      cursor: "pointer", textAlign: "left",
                      opacity: offDay && !isSelected ? 0.5 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 500, color: offDay && !isSelected ? "var(--muted)" : isSelected ? "var(--primary)" : "var(--text)", fontSize: "0.95rem" }}>
                        {g.title}
                      </span>
                      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.72rem", color: stalenessColor(days) }}>
                          {stalenessLabel(days)}
                        </span>
                      </div>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {offDay && stat?.nextWorkDay ? (
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 600,
                          color: "var(--primary)", background: "var(--primary-light)",
                          borderRadius: 20, padding: "2px 8px",
                        }}>
                          Next: {stat.nextWorkDay}
                        </span>
                      ) : stat && stat.overdueCount > 0 ? (
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 600,
                          color: "var(--warning)", background: "var(--warning-light)",
                          borderRadius: 20, padding: "2px 8px",
                        }}>
                          {stat.overdueCount} overdue
                        </span>
                      ) : null}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
