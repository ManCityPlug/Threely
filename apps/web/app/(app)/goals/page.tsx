"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { goalsApi, profileApi, tasksApi, type Goal } from "@/lib/api-client";
import { SkeletonCard } from "@/components/Skeleton";
import BuildingProgress from "@/components/BuildingProgress";
import { useToast } from "@/components/ToastProvider";
import { useSubscription } from "@/lib/subscription-context";
import { MOCK_TUTORIAL_GOAL } from "@/lib/mock-tutorial-data";

// ─── 3-Step Funnel for "Add Goal" (same as /start) ───────────────────────────

type FunnelCategory = "business" | "daytrading" | "health" | "other";

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
  daytrading: [
    { question: "How much do you want to make per month?", buttons: ["$500", "$1K-$5K", "$10K+"] },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Any previous experience?", isTextInput: true, placeholder: "e.g. traded stocks for 6 months, complete beginner...", skippable: true },
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
    case "daytrading":
      return `I want to day trade to make ${answers[0]} per month. I can put in ${answers[1].toLowerCase()} work. ${answers[2] ? `Previous experience: ${answers[2]}` : "I'm a complete beginner with no day trading experience."}`;
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
        title: cat === "business"
          ? `Make ${allAnswers[0]} per month`
          : cat === "daytrading"
          ? `Day trade to ${allAnswers[0]}/mo`
          : cat === "health"
          ? allAnswers[0]
          : allAnswers[0]?.slice(0, 40) || "My Goal",
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
                { id: "daytrading" as FunnelCategory, label: "\uD83D\uDCC8 Day Trading", subtitle: "Grow a trading account" },
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
                  // No autoFocus — users see Skip before the keyboard pops.
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-1p-ignore
                  data-lpignore="true"
                  name="goalText"
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

// ─── Goal Card (simplified: title + delete) ──────────────────────────────────

function GoalCard({ goal, onDeleted }: { goal: Goal; onDeleted: () => void }) {
  const goalRouter = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await goalsApi.delete(goal.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        data-walkthrough="first-goal-card"
        onClick={() => {
          const todayKey = `threely_focus_${new Date().toLocaleDateString("en-CA")}`;
          localStorage.setItem(todayKey, goal.id);
          goalRouter.push("/dashboard");
        }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "1rem 1.25rem",
          cursor: "pointer", transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D4A843"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
      >
        <h3 style={{
          fontWeight: 600, fontSize: "0.95rem", color: "var(--text)",
          lineHeight: 1.4, margin: 0, flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {goal.title}
        </h3>

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
          disabled={deleting}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.25)", padding: 6, marginLeft: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 6, transition: "color 0.15s", flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
          aria-label="Delete goal"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Delete confirmation dialog */}
      {showConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowConfirm(false)}
          style={{ zIndex: 300 }}
        >
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, textAlign: "center", padding: "2rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Delete this goal?
            </h2>
            <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              This can&apos;t be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1, padding: "0.7rem", borderRadius: "var(--radius)",
                  border: "1px solid var(--border)", background: "var(--card)",
                  color: "var(--text)", fontSize: "0.9rem", fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: "0.7rem", borderRadius: "var(--radius)",
                  border: "none", background: "var(--danger)", color: "#fff",
                  fontSize: "0.9rem", fontWeight: 600, cursor: "pointer",
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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

  const activeGoals = effectiveGoals;

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
        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: "1rem" }}>{"🚀"}</div>
          <button
            onClick={handleTryAddGoal}
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {activeGoals.map((goal, i) => (
            <div key={goal.id} className="slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <GoalCard
                goal={goal}
                onDeleted={() => handleGoalDeleted(goal.id)}
              />
            </div>
          ))}
        </div>
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
