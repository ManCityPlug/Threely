"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { goalsApi, profileApi, tasksApi, type Goal, type ParsedGoal, type TaskItem } from "@/lib/api-client";
import { SkeletonCard } from "@/components/Skeleton";
import BuildingProgress from "@/components/BuildingProgress";
import { useToast } from "@/components/ToastProvider";
import { useSubscription } from "@/lib/subscription-context";
import { MOCK_TUTORIAL_GOAL } from "@/lib/mock-tutorial-data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  fitness: "\uD83D\uDCAA", business: "\uD83D\uDCBC", learning: "\uD83D\uDCDA", creative: "\uD83C\uDFA8",
  financial: "\uD83D\uDCB0", health: "\uD83C\uDF31", relationships: "\uD83E\uDD1D", productivity: "\u26A1",
  spiritual: "\uD83D\uDE4F", religion: "\uD83D\uDE4F", mindfulness: "\uD83E\uDDE0", career: "\uD83D\uDCBC",
  wealth: "\uD83D\uDCB0", other: "\uD83C\uDFAF",
};

function CategoryBadge({ category }: { category: string | null }) {
  const cat = category ?? "other";
  return (
    <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {CATEGORY_EMOJI[cat] ?? "\uD83C\uDFAF"} {cat}
    </span>
  );
}

function formatWorkDays(days: number[] | undefined | null): string {
  if (!days || days.length === 0 || days.length === 7) return "Every day";
  const sorted = [...days].sort();
  const key = sorted.join(",");
  if (key === "1,2,3,4,5") return "Weekdays";
  if (key === "6,7") return "Weekends";
  if (key === "1,3,5") return "Mon, Wed, Fri";
  if (key === "2,4") return "Tue, Thu";
  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return sorted.map(d => names[d]).join(", ");
}

// ─── 3-Step Funnel for "Add Goal" (same as /start) ───────────────────────────

type FunnelCategory = "business" | "health" | "other";

interface StepConfig {
  question: string;
  buttons?: string[];
  isTextInput?: boolean;
  placeholder?: string;
  skippable?: boolean;
  continueButton?: string;
}

const FUNNEL_STEPS: Record<FunnelCategory, StepConfig[]> = {
  business: [
    { question: "How much do you want to make per month?", buttons: ["$500", "$1K-$5K", "$10K+"] },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Got a business idea?", isTextInput: true, placeholder: "Enter your idea...", skippable: true },
  ],
  health: [
    { question: "What do you want?", buttons: ["Lose weight", "Glow up", "Gain more muscle"] },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Do you have a specific target goal?", isTextInput: true, placeholder: "Enter my goal...", skippable: true },
  ],
  other: [
    { question: "What's your goal?", isTextInput: true, placeholder: "Describe your goal...", continueButton: "Continue" },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Anything specific?", isTextInput: true, placeholder: "Enter details...", skippable: true },
  ],
};

function buildGoalText(category: FunnelCategory, answers: string[]): string {
  switch (category) {
    case "business":
      return `I want to make ${answers[0]} per month. I can put in ${answers[1].toLowerCase()} work. ${answers[2] ? `My business idea: ${answers[2]}` : "I need help finding a business idea."}`;
    case "health":
      return `I want to ${answers[0].toLowerCase()}. I can put in ${answers[1].toLowerCase()} work. ${answers[2] ? `My target: ${answers[2]}` : ""}`.trim();
    case "other":
      return `My goal: ${answers[0]}. I can put in ${answers[1].toLowerCase()} work. ${answers[2] ? `Details: ${answers[2]}` : ""}`.trim();
  }
}

const EFFORT_TO_MINUTES: Record<string, number> = {
  mild: 30,
  moderate: 60,
  heavy: 120,
};

const EFFORT_TO_INTENSITY: Record<string, number> = {
  mild: 1,
  moderate: 2,
  heavy: 3,
};

function AddGoalFlow({ onDone, onClose }: { onDone: (goal: Goal) => void; onClose: () => void }) {
  const [category, setCategory] = useState<FunnelCategory | null>(null);
  const [funnelStep, setFunnelStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [textValue, setTextValue] = useState("");
  const [fadeKey, setFadeKey] = useState(0);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");

  function animateStep(newStep: number) {
    setFadeKey(k => k + 1);
    setFunnelStep(newStep);
  }

  function handleCategorySelect(cat: FunnelCategory) {
    setCategory(cat);
    setAnswers([]);
    setTextValue("");
    animateStep(1);
  }

  function handleButtonAnswer(answer: string) {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    setTextValue("");
    if (newAnswers.length >= 3) {
      startBuild(category!, newAnswers);
    } else {
      animateStep(funnelStep + 1);
    }
  }

  function handleTextSubmit(value: string) {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);
    setTextValue("");
    if (newAnswers.length >= 3) {
      startBuild(category!, newAnswers);
    } else {
      animateStep(funnelStep + 1);
    }
  }

  function handleSkip() {
    handleTextSubmit("");
  }

  function handleBack() {
    if (funnelStep === 1) {
      setCategory(null);
      setAnswers([]);
      animateStep(0);
    } else if (funnelStep > 1) {
      setAnswers(prev => prev.slice(0, -1));
      animateStep(funnelStep - 1);
    }
  }

  async function startBuild(cat: FunnelCategory, allAnswers: string[]) {
    setBuilding(true);
    setBuildError("");
    const goalText = buildGoalText(cat, allAnswers);
    // Determine effort from the "Level of work?" answer (always index 1 for business/health, index 1 for other)
    const effortAnswer = cat === "other" ? allAnswers[1] : allAnswers[1];
    const effortKey = effortAnswer.toLowerCase();
    const dailyMinutes = EFFORT_TO_MINUTES[effortKey] ?? 60;
    const intensity = EFFORT_TO_INTENSITY[effortKey] ?? 2;

    try {
      // 1. Parse the goal
      const parsed = await goalsApi.parse(goalText);

      // 2. Save profile preferences
      await profileApi.save({ dailyTimeMinutes: dailyMinutes, intensityLevel: intensity });

      // 3. Create the goal
      const { goal } = await goalsApi.create({
        title: parsed.short_title ?? goalText.slice(0, 40),
        rawInput: goalText,
        structuredSummary: parsed.structured_summary,
        category: parsed.category,
        deadline: parsed.deadline_detected ?? null,
        dailyTimeMinutes: dailyMinutes,
        intensityLevel: intensity,
        workDays: parsed.work_days_detected && parsed.work_days_detected.length > 0
          ? parsed.work_days_detected
          : [1, 2, 3, 4, 5, 6, 7],
      });

      // 4. Generate tasks
      await tasksApi.generate({ goalId: goal.id });

      // Done — close modal and return the goal
      onDone(goal);
    } catch (e) {
      if (e instanceof Error && e.message?.includes("pro_required")) {
        onClose();
      } else {
        setBuildError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
        setBuilding(false);
      }
    }
  }

  const currentStepConfig = category && funnelStep >= 1 && funnelStep <= 3
    ? FUNNEL_STEPS[category][funnelStep - 1]
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(1rem, 4vw, 2rem)",
        overflowY: "auto",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560 }}>

        {/* Building state */}
        {building && (
          <div className="fade-in">
            <BuildingProgress />
            {buildError && (
              <p style={{ color: "var(--danger)", textAlign: "center", marginTop: 16, fontSize: "0.9rem" }}>
                {buildError}
              </p>
            )}
          </div>
        )}

        {/* Step 0: Category picker */}
        {!building && funnelStep === 0 && (
          <div key={`fade-${fadeKey}`} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.85)",
                cursor: "pointer", fontSize: "1rem", padding: "4px 0",
                alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 6, minHeight: 48,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 8 }}>
                What do you want to achieve?
              </h1>
              <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.85)" }}>
                Pick a category to get started
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              {([
                { id: "business" as FunnelCategory, label: "\uD83E\uDD11 Business", subtitle: "Start or grow a business" },
                { id: "health" as FunnelCategory, label: "\uD83D\uDCAA Health", subtitle: "Transform your body" },
                { id: "other" as FunnelCategory, label: "Other", subtitle: "Set any goal" },
              ]).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  style={{
                    padding: "1.5rem 1.25rem", borderRadius: 16,
                    border: "1.5px solid var(--border)", background: "var(--card)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    minHeight: 80, display: "flex", flexDirection: "column", justifyContent: "center",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D4A843"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)", marginBottom: 4 }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
                    {cat.subtitle}
                  </div>
                </button>
              ))}
            </div>

            {buildError && (
              <p style={{ color: "var(--danger)", textAlign: "center", fontSize: "0.9rem" }}>{buildError}</p>
            )}
          </div>
        )}

        {/* Steps 1-3: Funnel questions */}
        {!building && funnelStep >= 1 && funnelStep <= 3 && currentStepConfig && (
          <div key={`fade-${fadeKey}`} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <button
              onClick={handleBack}
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.85)",
                cursor: "pointer", fontSize: "1rem", padding: "4px 0",
                alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, minHeight: 48,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.75rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 8 }}>
                {currentStepConfig.question}
              </h2>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
                {[1, 2, 3].map((dot) => (
                  <div key={dot} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: dot <= funnelStep ? "#D4A843" : "var(--border)",
                    transition: "background 0.2s",
                  }} />
                ))}
              </div>
            </div>

            {currentStepConfig.buttons && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {currentStepConfig.buttons.map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleButtonAnswer(btn)}
                    style={{
                      padding: "1rem 1.25rem", borderRadius: 14,
                      border: "1.5px solid var(--border)", background: "var(--card)",
                      color: "var(--text)", fontSize: "1rem", fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s", minHeight: 56, textAlign: "center",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D4A843"; e.currentTarget.style.color = "#D4A843"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                  >
                    {btn}
                  </button>
                ))}
              </div>
            )}

            {currentStepConfig.isTextInput && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  className="field-input"
                  placeholder={currentStepConfig.placeholder}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && textValue.trim()) handleTextSubmit(textValue.trim()); }}
                  autoFocus
                  style={{
                    fontSize: "1rem", padding: "1rem 1.25rem", borderRadius: 14, minHeight: 56,
                    background: "var(--card)", border: "1.5px solid var(--border)", color: "var(--text)",
                  }}
                />
                {currentStepConfig.continueButton && (
                  <button
                    onClick={() => textValue.trim() && handleTextSubmit(textValue.trim())}
                    disabled={!textValue.trim()}
                    style={{
                      padding: "1rem 1.25rem", borderRadius: 14, border: "none",
                      background: textValue.trim()
                        ? "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)"
                        : "var(--border)",
                      color: textValue.trim() ? "#000" : "rgba(255,255,255,0.5)",
                      fontSize: "1rem", fontWeight: 700,
                      cursor: textValue.trim() ? "pointer" : "default",
                      minHeight: 56, transition: "all 0.15s",
                    }}
                  >
                    {currentStepConfig.continueButton}
                  </button>
                )}
                {currentStepConfig.skippable && (
                  <button
                    onClick={handleSkip}
                    style={{
                      background: "none", border: "none", color: "rgba(255,255,255,0.85)",
                      cursor: "pointer", fontSize: "0.95rem", fontWeight: 600,
                      padding: "0.75rem", minHeight: 48,
                      textDecoration: "underline", textUnderlineOffset: 3,
                    }}
                  >
                    Skip
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeInUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, onDeleted, onUpdated }: { goal: Goal; onDeleted: () => void; onUpdated: (goal: Goal) => void }) {
  const goalRouter = useRouter();
  const { hasPro } = useSubscription();
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  async function handleDelete() {
    setShowMenu(false);
    if (!hasPro) { return; }
    if (!confirm("Delete this goal and all its tasks?")) return;
    setDeleting(true);
    try {
      await goalsApi.delete(goal.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  async function handleTogglePause() {
    setToggling(true);
    try {
      const { goal: updated } = await goalsApi.update(goal.id, { isPaused: !goal.isPaused } as Partial<Goal>);
      onUpdated(updated);
      setShowMenu(false);
    } catch {
      // silently fail
    } finally {
      setToggling(false);
    }
  }

  async function handleMarkComplete() {
    setShowMenu(false);
    if (!confirm(`Mark "${goal.title}" as complete? It will be removed from your active goals.`)) return;
    setCompleting(true);
    try {
      await goalsApi.update(goal.id, { isActive: false } as Partial<Goal>);
      onDeleted();
    } catch {
      setCompleting(false);
    }
  }

  const daysLeft = goal.deadline
    ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)
    : null;

  // Build badge array like mobile
  const badges: { label: string; color: string; bg: string }[] = [];
  if (!goal.isPaused) {
    // Schedule badge
    badges.push({ label: formatWorkDays(goal.workDays), color: "#D97706", bg: "#FFFBEB" });
    // Daily time badge
    if (goal.dailyTimeMinutes) {
      const h = Math.floor(goal.dailyTimeMinutes / 60);
      const m = goal.dailyTimeMinutes % 60;
      const timeLabel = h > 0 && m > 0 ? `${h}h ${m}m/day` : h > 0 ? `${h}h/day` : `${m}m/day`;
      badges.push({ label: timeLabel, color: "#0891B2", bg: "#ECFEFF" });
    }
    // Days left badge
    if (daysLeft !== null) {
      badges.push({
        label: daysLeft > 0 ? `${daysLeft}d left` : "Overdue",
        color: daysLeft < 14 ? "var(--danger)" : "#D97706",
        bg: daysLeft < 14 ? "var(--danger-light)" : "#FFFBEB",
      });
    }
    // Status badge
    badges.push({ label: "Active", color: "var(--success)", bg: "rgba(34,197,94,0.08)" });
  } else {
    badges.push({ label: "Paused", color: "var(--muted)", bg: "var(--bg)" });
  }

  return (
    <div className="card" style={{ padding: "1.25rem", opacity: goal.isPaused ? 0.7 : 1, display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* Top row: category + title + menu */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flex: 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <CategoryBadge category={goal.category} />
          </div>
          <h3 style={{
            fontWeight: 600, fontSize: "0.95rem",
            color: goal.isPaused ? "var(--muted)" : "var(--text)",
            lineHeight: 1.4, margin: 0,
          }}>
            {goal.title}
          </h3>
          {goal.structuredSummary && (
            <p style={{ fontSize: "0.82rem", color: "var(--subtext)", lineHeight: 1.5, marginTop: 4, marginBottom: 0 }}>
              {goal.structuredSummary}
            </p>
          )}
        </div>

        {/* Menu button */}
        <div ref={menuRef} data-walkthrough="goal-menu-button" style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setShowMenu(v => !v)}
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "var(--bg)", color: "var(--subtext)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, cursor: "pointer", border: "none",
            }}
          >
            &#x22EF;
          </button>
          {showMenu && (
            <div
              data-walkthrough="goal-menu-button-dropdown"
              style={{
                position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 50,
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                minWidth: 160, maxWidth: "calc(100vw - 3rem)", overflow: "hidden",
              }}
            >
              <button
                onClick={handleTogglePause}
                disabled={toggling}
                style={{
                  display: "block", width: "100%", padding: "0.6rem 0.875rem",
                  textAlign: "left", color: "var(--warning)", fontSize: "0.875rem",
                  fontWeight: 500, cursor: "pointer", background: "none", border: "none",
                }}
              >
                {toggling ? "..." : goal.isPaused ? "\u25B6 Resume goal" : "\u23F8 Pause goal"}
              </button>
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                style={{
                  display: "block", width: "100%", padding: "0.6rem 0.875rem",
                  textAlign: "left", color: "var(--success)", fontSize: "0.875rem",
                  fontWeight: 500, cursor: "pointer", background: "none", border: "none",
                }}
              >
                {completing ? "..." : "\u2705 Mark as complete"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  display: "block", width: "100%", padding: "0.6rem 0.875rem",
                  textAlign: "left", color: "var(--danger)", fontSize: "0.875rem",
                  fontWeight: 500, cursor: "pointer", background: "none", border: "none",
                }}
              >
                {deleting ? "Deleting..." : "\uD83D\uDDD1 Delete goal"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Badge row — even columns like mobile */}
      <div style={{ display: "flex", gap: 6 }}>
        {badges.map((b, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: "block", textAlign: "center",
              fontSize: "0.7rem", fontWeight: 600,
              color: b.color, background: b.bg,
              borderRadius: 20, padding: "3px 6px",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>

      {/* Footer: date + view tasks button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
          Added {new Date(goal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
        {!goal.isPaused && (
          <button
            onClick={() => {
              const todayKey = `threely_focus_${new Date().toLocaleDateString("en-CA")}`;
              localStorage.setItem(todayKey, goal.id);
              goalRouter.push("/dashboard");
            }}
            style={{
              fontSize: "0.78rem", fontWeight: 600, color: "var(--primary-text)",
              background: "var(--primary)", textDecoration: "none",
              padding: "5px 12px", borderRadius: 6,
              display: "inline-flex", alignItems: "center",
              border: "none", cursor: "pointer",
            }}
          >
            View tasks
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Goals Page ───────────────────────────────────────────────────────────────

export default function GoalsPage() {
  return (
    <Suspense>
      <GoalsPageInner />
    </Suspense>
  );
}

function GoalsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { hasPro, walkthroughActive } = useSubscription();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(searchParams.get("add") === "true");
  const [showGoalLimit, setShowGoalLimit] = useState(false);

  // During tutorial walkthrough, always use mock data for consistent spotlight targets
  const effectiveGoals = walkthroughActive ? [MOCK_TUTORIAL_GOAL as Goal] : goals;

  const load = useCallback(async () => {
    try {
      const { goals } = await goalsApi.list(true);
      setGoals(goals);
    } catch {
      showToast("Failed to load goals", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function handleTryAddGoal() {
    // Allow first goal free — only gate if user already has goals
    const activeCount = goals.filter(g => !g.isPaused).length;
    if (!hasPro && activeCount > 0) {
      router.push("/checkout?plan=yearly");
      return;
    }
    if (activeCount >= 3) { setShowGoalLimit(true); return; }
    setShowAdd(true);
  }

  function handleGoalAdded(goal: Goal) {
    setShowAdd(false);
    setGoals(prev => [...prev, goal]);
    localStorage.setItem(`threely_focus_${new Date().toLocaleDateString("en-CA")}`, goal.id);
    router.push("/dashboard");
  }

  function handleGoalDeleted(id: string) {
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  function handleGoalUpdated(updated: Goal) {
    setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
  }

  const activeGoals = effectiveGoals.filter(g => !g.isPaused);
  const pausedGoals = effectiveGoals.filter(g => g.isPaused);

  if (loading) {
    return (
      <div className="page-inner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
          <div>
            <div className="skeleton" style={{ width: 100, height: 28, marginBottom: 6, borderRadius: "var(--radius-sm)" }} />
            <div className="skeleton" style={{ width: 120, height: 14, borderRadius: "var(--radius-sm)" }} />
          </div>
          <div className="skeleton" style={{ width: 100, height: 38, borderRadius: "var(--radius)" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.875rem" }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Goals</h1>
          <p style={{ color: "var(--subtext)", fontSize: "0.875rem", marginTop: 2 }}>
            {activeGoals.length} active goal{activeGoals.length !== 1 ? "s" : ""}
            {pausedGoals.length > 0 && ` \u00B7 ${pausedGoals.length} paused`}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleTryAddGoal}
          style={{ fontSize: "0.875rem" }}
        >
          + Add goal
        </button>
      </div>

      {/* Goals list */}
      {effectiveGoals.length === 0 ? (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"\uD83C\uDFAF"}</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>What will you achieve?</h2>
          <p style={{ color: "var(--subtext)", marginBottom: "1rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
            Set a goal and your AI coach will break it into 3 small daily tasks — the proven way to make real progress.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--subtext)" }}>AI-powered tasks</span>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{"·"}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--subtext)" }}>Daily coaching</span>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{"·"}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--subtext)" }}>Progress tracking</span>
          </div>
          <button className="btn btn-primary" onClick={handleTryAddGoal} style={{ fontSize: "0.95rem", padding: "0.75rem 2rem" }}>
            Create your first goal {"\u2192"}
          </button>
        </div>
      ) : (
        <>
          {/* Active goals */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.875rem" }}>
            {activeGoals.map((goal, i) => (
              <div key={goal.id} className="slide-up" style={{ animationDelay: `${i * 0.08}s` }} {...(i === 0 ? { "data-walkthrough": "first-goal-card" } : {})}>
                <GoalCard
                  goal={goal}
                  onDeleted={() => handleGoalDeleted(goal.id)}
                  onUpdated={handleGoalUpdated}
                />
              </div>
            ))}
          </div>

          {/* Paused goals */}
          {pausedGoals.length > 0 && (
            <div style={{ marginTop: "2rem" }}>
              <h2 style={{
                fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)",
                textTransform: "uppercase", letterSpacing: "0.05em",
                marginBottom: "0.75rem",
              }}>
                Paused
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.875rem" }}>
                {pausedGoals.map((goal, i) => (
                  <div key={goal.id} className="slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
                    <GoalCard
                      goal={goal}
                      onDeleted={() => handleGoalDeleted(goal.id)}
                      onUpdated={handleGoalUpdated}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <AddGoalFlow
          onDone={handleGoalAdded}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* 3-goal limit modal */}
      {showGoalLimit && (
        <div className="modal-overlay" onClick={() => setShowGoalLimit(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{"\uD83C\uDFAF"}</div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>
              3 Goals. Total Focus.
            </h2>
            <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>
              Threely gives you 3 tasks per goal, per day &mdash; designed for deep focus and real progress. More than 3 active goals spreads you too thin.
              <br /><br />
              Pause or complete a goal to make room for a new one.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setShowGoalLimit(false)}
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
