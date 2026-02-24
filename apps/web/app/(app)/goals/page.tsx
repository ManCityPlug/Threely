"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { goalsApi, tasksApi, type Goal, type ParsedGoal, type GoalChatMessage, type GoalChatResult, type TaskItem } from "@/lib/api-client";
import { SkeletonCard } from "@/components/Skeleton";
import ProgressRing from "@/components/ProgressRing";
import GoalTemplatesComponent from "@/components/GoalTemplates";
import type { GoalCategory } from "@/lib/goal-templates";
import { useToast } from "@/components/ToastProvider";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  fitness: "💪", business: "💼", learning: "📚", creative: "🎨",
  financial: "💰", health: "🌱", relationships: "🤝", productivity: "⚡",
  other: "🎯",
};

function CategoryBadge({ category }: { category: string | null }) {
  const cat = category ?? "other";
  return (
    <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {CATEGORY_EMOJI[cat] ?? "🎯"} {cat}
    </span>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Add Goal Flow (full-screen, matches mobile onboarding) ──────────────────

type FlowStep = "goal" | "confirm" | "deadline" | "time" | "intensity" | "building" | "done";

const TOTAL_STEPS = 5;

const TIME_OPTIONS_WEB = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "Custom", value: -1 },
];

const INTENSITY_OPTIONS_WEB = [
  { level: 1, emoji: "\uD83C\uDF31", label: "Building the habit", description: "Steady, sustainable progress. Short daily wins." },
  { level: 2, emoji: "\uD83C\uDFAF", label: "Making real progress", description: "Committed and consistent. This is getting done." },
  { level: 3, emoji: "\uD83D\uDE80", label: "All in", description: "Maximum effort. Push limits every day." },
];

function AddGoalFlow({ onDone, onClose }: { onDone: (goal: Goal) => void; onClose: () => void }) {
  const [step, setStep] = useState<FlowStep>("goal");
  const [showTemplates, setShowTemplates] = useState(false);

  // Goal input
  const [rawInput, setRawInput] = useState("");
  const [parsed, setParsed] = useState<ParsedGoal | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // AI Plan chat
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant" | "loading" | "goal"; text: string; options?: string[] }>>([]);
  const [chatMessages, setChatMessages] = useState<GoalChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const [chatGoalText, setChatGoalText] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Deadline (default: 1 month from today)
  const [hasDeadline, setHasDeadline] = useState(true);
  const now = new Date();
  const defaultDeadline = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [deadlineYear, setDeadlineYear] = useState(defaultDeadline.getFullYear());
  const [deadlineMonth, setDeadlineMonth] = useState(defaultDeadline.getMonth() + 1);
  const [deadlineDay, setDeadlineDay] = useState(defaultDeadline.getDate());
  const currentYear = now.getFullYear();

  // Time & intensity (per-goal)
  const [timeMinutes, setTimeMinutes] = useState<number | null>(null);
  const [intensityLevel, setIntensityLevel] = useState<number | null>(null);

  // Building
  const [buildError, setBuildError] = useState("");
  const [builtTasks, setBuiltTasks] = useState<TaskItem[]>([]);
  const [coachNote, setCoachNote] = useState("");
  const [savedGoal, setSavedGoal] = useState<Goal | null>(null);

  // Progress
  const stepIndex = step === "goal" ? 1 : step === "confirm" ? 2 : step === "deadline" ? 3 : step === "time" ? 4 : step === "intensity" ? 5 : 5;
  const progressPercent = step === "building" || step === "done" ? 100 : Math.round((stepIndex / TOTAL_STEPS) * 100);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  // ─── Category selection → opens AI chat ─────────────────────────────────

  function handleCategorySelect(category: GoalCategory) {
    setShowTemplates(false);
    startAiChatWithMessage(category.starterMessage);
  }

  // ─── Parse goal ────────────────────────────────────────────────────────────

  async function handleParse() {
    const text = rawInput.trim();
    if (!text) return;
    setParsing(true);
    setParseError("");
    try {
      const result = await goalsApi.parse(text);
      setParsed(result);
      if (result.deadline_detected) {
        const d = new Date(result.deadline_detected + "T12:00:00");
        setHasDeadline(true);
        setDeadlineYear(d.getFullYear());
        setDeadlineMonth(d.getMonth() + 1);
        setDeadlineDay(d.getDate());
      }
      setStep("confirm");
    } catch {
      setParseError("Failed to analyze your goal. Please try again.");
    } finally {
      setParsing(false);
    }
  }

  // ─── AI Plan chat ──────────────────────────────────────────────────────────

  async function startAiChat() {
    startAiChatWithMessage("Help me define my goal.");
  }

  async function startAiChatWithMessage(initialMessage: string) {
    setShowAiChat(true);
    setChatHistory([]);
    setChatMessages([]);
    setChatDone(false);
    setChatGoalText(null);
    setCustomInput("");
    setChatLoading(true);
    try {
      const seedMessages: GoalChatMessage[] = [{ role: "user", content: initialMessage }];
      const result = await goalsApi.chat(seedMessages);
      setChatMessages([
        { role: "user", content: initialMessage },
        { role: "assistant", content: result.raw_reply },
      ]);
      setChatHistory([
        { role: "user", text: initialMessage },
        { role: "assistant", text: result.message, options: result.options },
      ]);
      if (result.done) {
        setChatDone(true);
        setChatGoalText(result.goal_text);
      }
    } catch {
      setChatHistory([{ role: "assistant", text: "Something went wrong. Please close and try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function sendChatAnswer(answer: string) {
    setChatHistory(prev => [...prev, { role: "user", text: answer }]);
    setCustomInput("");
    setChatLoading(true);

    const newMessages: GoalChatMessage[] = [...chatMessages, { role: "user", content: answer }];
    setChatMessages(newMessages);

    try {
      const result = await goalsApi.chat(newMessages);
      setChatMessages(prev => [...prev, { role: "assistant", content: result.raw_reply }]);
      setChatHistory(prev => [
        ...prev,
        { role: "assistant", text: result.message, options: result.done ? [] : result.options },
      ]);
      if (result.done) {
        setChatDone(true);
        setChatGoalText(result.goal_text);
      }
    } catch {
      setChatHistory(prev => [...prev, { role: "assistant", text: "Something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleUseGoal() {
    if (!chatGoalText) return;
    setRawInput(chatGoalText);
    setShowAiChat(false);
    // Auto-parse
    setParsing(true);
    setParseError("");
    try {
      const result = await goalsApi.parse(chatGoalText.trim());
      setParsed(result);
      if (result.deadline_detected) {
        const d = new Date(result.deadline_detected + "T12:00:00");
        setHasDeadline(true);
        setDeadlineYear(d.getFullYear());
        setDeadlineMonth(d.getMonth() + 1);
        setDeadlineDay(d.getDate());
      }
      // Skip to deadline step (or confirm if needs more context)
      if (result.needs_more_context) {
        setStep("confirm");
      } else {
        setStep("deadline");
      }
    } catch {
      setParseError("Failed to analyze goal. Try again.");
      setStep("goal");
    } finally {
      setParsing(false);
    }
  }

  // ─── Build (save goal + generate tasks) ────────────────────────────────────

  async function handleBuild() {
    setBuildError("");
    setStep("building");
    try {
      const goalTitle = parsed?.short_title ?? rawInput.trim().slice(0, 40);
      const deadline = hasDeadline
        ? `${deadlineYear}-${String(deadlineMonth).padStart(2, "0")}-${String(deadlineDay).padStart(2, "0")}`
        : null;

      const { goal } = await goalsApi.create({
        title: goalTitle,
        rawInput: rawInput.trim(),
        structuredSummary: parsed?.structured_summary,
        category: parsed?.category,
        deadline,
        dailyTimeMinutes: timeMinutes ?? undefined,
        intensityLevel: intensityLevel ?? undefined,
      });
      setSavedGoal(goal);

      const result = await tasksApi.generate({ goalId: goal.id });
      const tasks = result.dailyTasks.flatMap(dt => dt.tasks).slice(0, 3);
      setBuiltTasks(tasks);
      if (result.coachNote) setCoachNote(result.coachNote);
      setStep("done");
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Something went wrong.");
      setStep("intensity");
    }
  }

  // ─── Render: Goal input step ───────────────────────────────────────────────

  function renderGoalStep() {
    if (showTemplates) {
      return (
        <GoalTemplatesComponent
          onSelect={handleCategorySelect}
          onClose={() => setShowTemplates(false)}
          onOther={() => {
            setShowTemplates(false);
            startAiChatWithMessage("Help me define my goal.");
          }}
        />
      );
    }

    return (
      <>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
          What are you working toward?
        </h2>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Describe your goal and where you're at. More context means a better plan from Threely Intelligence.
        </p>

        <textarea
          className="field-input"
          rows={5}
          placeholder="e.g. I want to launch my freelance design business and land my first 3 clients within 3 months. I have 2 years of hobby experience..."
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          autoFocus
          disabled={parsing}
          style={{ resize: "vertical", marginBottom: "0.75rem", opacity: parsing ? 0.6 : 1 }}
        />

        {parseError && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{parseError}</p>}

        {parsed?.needs_more_context && parsed.recommendations && step === "goal" && (
          <div style={{
            background: "var(--primary-light)", borderRadius: "var(--radius)",
            padding: "1rem", border: "1px solid rgba(99,91,255,0.15)", marginBottom: "1rem",
          }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--primary)", marginBottom: 6 }}>
              Things that would strengthen your plan
            </p>
            <p style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {parsed.recommendations}
            </p>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleParse}
          disabled={!rawInput.trim() || parsing}
          style={{ width: "100%", padding: "0.75rem", marginBottom: "0.75rem" }}
        >
          {parsing ? (
            <><span className="spinner" style={{ width: 18, height: 18 }} /> Analyzing your goal...</>
          ) : (
            "Analyze my goal \u2192"
          )}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0.25rem 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <div style={{ position: "relative", width: "100%", marginTop: "0.75rem" }}>
          <span style={{
            position: "absolute", top: -9, right: 12,
            background: "var(--primary)", color: "#fff",
            fontSize: "0.65rem", fontWeight: 700,
            padding: "2px 8px", borderRadius: 20,
            letterSpacing: "0.03em", zIndex: 1,
            boxShadow: "0 1px 4px rgba(99,91,255,0.3)",
          }}>Recommended</span>
          <button
            className="btn btn-outline"
            onClick={() => setShowTemplates(true)}
            disabled={parsing}
            style={{
              width: "100%", padding: "0.75rem",
              borderColor: "rgba(99,91,255,0.25)", color: "var(--primary)", fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 14 }}>&#10022;</span> AI Plan &mdash; let Threely guide you
          </button>
        </div>
      </>
    );
  }

  // ─── Render: Confirmation step ─────────────────────────────────────────────

  function renderConfirmStep() {
    if (!parsed) return null;
    return (
      <>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "1.25rem" }}>
          Review your goal
        </h2>

        <div className="card" style={{ padding: "1.25rem", background: "var(--bg)", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16, color: "var(--primary)" }}>&#10022;</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Threely Intelligence read your goal
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <CategoryBadge category={parsed.category} />
            {parsed.deadline_detected && (
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                📅 {new Date(parsed.deadline_detected + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>

          <p style={{ fontSize: "0.95rem", color: "var(--text)", lineHeight: 1.6 }}>
            {parsed.structured_summary}
          </p>
        </div>

        {parsed.needs_more_context && parsed.recommendations && (
          <div style={{
            background: "#FFF8EC", borderRadius: "var(--radius)",
            padding: "1rem", border: "1px solid rgba(245,166,35,0.3)", marginBottom: "1rem",
          }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#B45309", marginBottom: 6 }}>
              ⚠ Your plan could be more personalized
            </p>
            <p style={{ fontSize: "0.85rem", color: "#92400E", lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {parsed.recommendations}
            </p>
          </div>
        )}

        {parsed.needs_more_context ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "0.5rem" }}>
            <button className="btn btn-primary" onClick={() => { setStep("goal"); }} style={{ width: "100%", padding: "0.75rem" }}>
              Add more detail &#8594;
            </button>
            <button
              onClick={() => setStep("deadline")}
              style={{
                display: "block", margin: "0.25rem auto 0", fontSize: "0.8rem",
                color: "var(--muted)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer",
              }}
            >
              Continue anyway
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => setStep("deadline")} style={{ width: "100%", padding: "0.75rem", marginTop: "0.5rem" }}>
            Looks good &#8594;
          </button>
        )}
      </>
    );
  }

  // ─── Render: Deadline step ─────────────────────────────────────────────────

  function renderDeadlineStep() {
    return (
      <>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Do you have a deadline?
        </h2>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          A deadline helps Threely Intelligence pace your tasks. If you skip this, we'll use a 90-day rolling horizon.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: "1rem" }}>
          <input
            type="checkbox"
            checked={hasDeadline}
            onChange={e => setHasDeadline(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>I have a target date</span>
        </label>

        {hasDeadline && (
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
            <select
              className="field-input"
              value={deadlineMonth}
              onChange={e => setDeadlineMonth(Number(e.target.value))}
              style={{ flex: 2 }}
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              className="field-input"
              value={deadlineDay}
              onChange={e => setDeadlineDay(Number(e.target.value))}
              style={{ flex: 1 }}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              className="field-input"
              value={deadlineYear}
              onChange={e => setDeadlineYear(Number(e.target.value))}
              style={{ flex: 2 }}
            >
              {[currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {buildError && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{buildError}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setStep("confirm")} style={{ flex: 1 }}>
            &#8592; Back
          </button>
          <button className="btn btn-primary" onClick={() => setStep("time")} style={{ flex: 2 }}>
            {hasDeadline
              ? `Set deadline & continue \u2192`
              : "No deadline \u2014 continue \u2192"}
          </button>
        </div>
      </>
    );
  }

  // ─── Render: Time step ───────────────────────────────────────────────────

  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customHours, setCustomHours] = useState(3);

  function renderTimeStep() {
    const isCustomSelected = showCustomTime;
    const effectiveTime = isCustomSelected ? customHours * 60 : timeMinutes;

    return (
      <>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
          How much time daily for this goal?
        </h2>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Threely Intelligence will size your tasks to fit this window.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: showCustomTime ? "0.75rem" : "1.5rem" }}>
          {TIME_OPTIONS_WEB.map(opt => {
            const isSelected = opt.value === -1
              ? showCustomTime
              : !showCustomTime && timeMinutes === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === -1) {
                    setShowCustomTime(true);
                    setTimeMinutes(customHours * 60);
                  } else {
                    setShowCustomTime(false);
                    setTimeMinutes(opt.value);
                  }
                }}
                style={{
                  padding: "0.6rem 1.25rem", borderRadius: 20, fontSize: "0.875rem", fontWeight: 600,
                  border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                  background: isSelected ? "var(--primary-light)" : "var(--card)",
                  color: isSelected ? "var(--primary)" : "var(--subtext)", cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {showCustomTime && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select
                className="field-input"
                value={customHours}
                onChange={e => {
                  const h = Number(e.target.value);
                  setCustomHours(h);
                  setTimeMinutes(h * 60);
                }}
                style={{ width: 120 }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 3).map(h => (
                  <option key={h} value={h}>{h} hours</option>
                ))}
              </select>
              <span style={{ fontSize: "0.85rem", color: "var(--subtext)" }}>per day</span>
            </label>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setStep("deadline")} style={{ flex: 1 }}>
            &#8592; Back
          </button>
          <button
            className="btn btn-primary"
            onClick={() => effectiveTime && setStep("intensity")}
            disabled={!effectiveTime}
            style={{ flex: 2, opacity: effectiveTime ? 1 : 0.5 }}
          >
            Continue &#8594;
          </button>
        </div>
      </>
    );
  }

  // ─── Render: Intensity step ─────────────────────────────────────────────────

  function renderIntensityStep() {
    return (
      <>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
          What's your pace for this goal?
        </h2>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          This shapes how ambitious Threely Intelligence makes your tasks.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.5rem" }}>
          {INTENSITY_OPTIONS_WEB.map(opt => {
            const isSelected = intensityLevel === opt.level;
            return (
              <button
                key={opt.level}
                onClick={() => setIntensityLevel(opt.level)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "1rem 1.25rem", borderRadius: "var(--radius-lg)", cursor: "pointer",
                  border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                  background: isSelected ? "var(--primary-light)" : "var(--card)",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 28, flexShrink: 0 }}>{opt.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.95rem", color: isSelected ? "var(--primary)" : "var(--text)", marginBottom: 2 }}>
                    {opt.label}
                  </p>
                  <p style={{ fontSize: "0.82rem", color: "var(--subtext)", lineHeight: 1.4 }}>
                    {opt.description}
                  </p>
                </div>
                {isSelected && <span style={{ color: "var(--primary)", fontWeight: 700 }}>&#10003;</span>}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setStep("time")} style={{ flex: 1 }}>
            &#8592; Back
          </button>
          <button
            className="btn btn-primary"
            onClick={() => intensityLevel && handleBuild()}
            disabled={!intensityLevel}
            style={{ flex: 2, opacity: intensityLevel ? 1 : 0.5 }}
          >
            Build my plan &#8594;
          </button>
        </div>
      </>
    );
  }

  // ─── Render: Building step ─────────────────────────────────────────────────

  function renderBuildingStep() {
    return (
      <div style={{ textAlign: "center", padding: "3rem 0" }}>
        <div style={{ fontSize: 40, color: "var(--primary)", marginBottom: "1rem" }}>&#10022;</div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8 }}>
          Threely Intelligence is building your plan...
        </h2>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          Analyzing your goal and crafting 3 perfect tasks to start with.
        </p>
        <span className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  // ─── Render: Done step (task reveal) ───────────────────────────────────────

  function renderDoneStep() {
    return (
      <>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Your plan is ready &#10022;
        </h2>
        {coachNote && (
          <p style={{ fontSize: "0.9rem", color: "var(--subtext)", fontStyle: "italic", lineHeight: 1.6, marginBottom: "1.25rem" }}>
            {coachNote}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.5rem" }}>
          {builtTasks.map((task, i) => (
            <div
              key={task.id}
              className="card fade-in"
              style={{ padding: "1rem 1.25rem", animationDelay: `${i * 0.15}s` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)", lineHeight: 1.4 }}>
                  {task.task}
                </p>
                {task.estimated_minutes > 0 && (
                  <span className="badge" style={{ flexShrink: 0 }}>~{task.estimated_minutes}m</span>
                )}
              </div>
              {task.why && (
                <p style={{ fontSize: "0.82rem", color: "var(--subtext)", fontStyle: "italic", marginTop: 6, lineHeight: 1.5 }}>
                  {task.why}
                </p>
              )}
            </div>
          ))}
        </div>

        <button
          className="btn btn-primary"
          onClick={() => { if (savedGoal) onDone(savedGoal); }}
          style={{ width: "100%", padding: "0.75rem" }}
        >
          Done &#8594;
        </button>
      </>
    );
  }

  // ─── Render: AI Chat modal ─────────────────────────────────────────────────

  function renderAiChat() {
    if (!showAiChat) return null;
    return (
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", inset: 0, background: "rgba(10,37,64,0.35)", backdropFilter: "blur(2px)",
          zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }}
      >
        <div style={{
          background: "var(--card)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)",
          width: "100%", maxWidth: 520, maxHeight: "85vh", display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, color: "var(--primary)" }}>&#10022;</span>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Threely Intelligence</span>
            </div>
            <button
              onClick={() => setShowAiChat(false)}
              style={{
                width: 30, height: 30, borderRadius: "var(--radius-sm)",
                background: "var(--bg)", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: "var(--subtext)", cursor: "pointer",
              }}
            >
              &#x2715;
            </button>
          </div>

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 12 }}>
            {chatHistory.map((msg, i) => {
              const isAssistant = msg.role === "assistant";
              const isLastAssistant = isAssistant && i === chatHistory.length - 1;
              return (
                <div key={i}>
                  <div style={{
                    maxWidth: "85%", padding: "0.65rem 1rem", borderRadius: 14,
                    ...(isAssistant
                      ? { background: "var(--primary-light)", borderBottomLeftRadius: 4, alignSelf: "flex-start" }
                      : { background: "var(--primary)", color: "#fff", borderBottomRightRadius: 4, alignSelf: "flex-end", marginLeft: "auto" }),
                    fontSize: "0.9rem", lineHeight: 1.6,
                  }}>
                    {msg.text}
                  </div>
                  {isLastAssistant && msg.options && msg.options.length > 0 && !chatLoading && !chatDone && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {msg.options.map((opt, j) => (
                        <button
                          key={j}
                          onClick={() => sendChatAnswer(opt)}
                          style={{
                            padding: "0.45rem 0.85rem", borderRadius: 20,
                            border: "1.5px solid rgba(99,91,255,0.25)", background: "var(--card)",
                            fontSize: "0.82rem", fontWeight: 600, color: "var(--primary)",
                            cursor: "pointer",
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {chatLoading && (
              <div style={{
                background: "var(--primary-light)", borderRadius: 14, borderBottomLeftRadius: 4,
                padding: "0.65rem 1rem", maxWidth: "85%", alignSelf: "flex-start",
              }}>
                <span className="spinner spinner-dark" style={{ width: 18, height: 18 }} />
              </div>
            )}
            {chatDone && chatGoalText && (
              <div style={{
                background: "var(--card)", borderRadius: "var(--radius-lg)",
                border: "1.5px solid rgba(99,91,255,0.25)", padding: "1rem", marginTop: 4,
              }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Your goal
                </p>
                <p style={{ fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.6 }}>
                  {chatGoalText}
                </p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Footer */}
          <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border)", background: "var(--card)" }}>
            {chatDone ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-primary" onClick={handleUseGoal} style={{ width: "100%", padding: "0.7rem" }}>
                  Use this goal &#8594;
                </button>
                <button
                  onClick={() => {
                    setChatDone(false);
                    setChatGoalText(null);
                    sendChatAnswer("I'd like to change something about my goal.");
                  }}
                  style={{
                    fontSize: "0.8rem", color: "var(--subtext)", textDecoration: "underline",
                    background: "none", border: "none", cursor: "pointer", textAlign: "center",
                  }}
                >
                  Edit goal
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="field-input"
                  placeholder="Type your own answer..."
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  disabled={chatLoading}
                  onKeyDown={e => {
                    if (e.key === "Enter" && customInput.trim() && !chatLoading) {
                      sendChatAnswer(customInput.trim());
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => customInput.trim() && !chatLoading && sendChatAnswer(customInput.trim())}
                  disabled={!customInput.trim() || chatLoading}
                  style={{ padding: "0.65rem 1rem" }}
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 560, padding: 0, overflow: "hidden" }}
      >
        {/* Progress bar */}
        {step !== "building" && step !== "done" && (
          <div style={{ padding: "1.5rem 2rem 0" }}>
            <div className="progress-track" style={{ marginBottom: 4 }}>
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Step {stepIndex} of {TOTAL_STEPS}
              </span>
              <button
                onClick={onClose}
                style={{ fontSize: 18, color: "var(--muted)", padding: 4, cursor: "pointer", background: "none", border: "none" }}
              >
                &#x2715;
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "1.25rem 2rem 2rem" }}>
          {step === "goal" && renderGoalStep()}
          {step === "confirm" && renderConfirmStep()}
          {step === "deadline" && renderDeadlineStep()}
          {step === "time" && renderTimeStep()}
          {step === "intensity" && renderIntensityStep()}
          {step === "building" && renderBuildingStep()}
          {step === "done" && renderDoneStep()}
        </div>
      </div>

      {renderAiChat()}
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, onDeleted, onUpdated }: { goal: Goal; onDeleted: () => void; onUpdated: (goal: Goal) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function handleDelete() {
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

  const daysLeft = goal.deadline
    ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)
    : null;

  // Progress ring: days elapsed vs total days
  const progressPercent = (() => {
    if (!goal.deadline) return 0;
    const created = new Date(goal.createdAt).getTime();
    const deadline = new Date(goal.deadline).getTime();
    const totalDays = Math.max(1, (deadline - created) / 86400000);
    const elapsed = (Date.now() - created) / 86400000;
    return Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
  })();

  return (
    <div className="card" style={{ padding: "1.25rem", opacity: goal.isPaused ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <CategoryBadge category={goal.category} />
            {goal.isPaused && (
              <span style={{
                fontSize: "0.7rem", fontWeight: 600,
                color: "var(--muted)", background: "var(--bg)",
                borderRadius: 20, padding: "2px 8px",
              }}>
                Paused
              </span>
            )}
            {daysLeft !== null && !goal.isPaused && (
              <span style={{
                fontSize: "0.72rem", fontWeight: 600,
                color: daysLeft < 14 ? "var(--danger)" : "var(--muted)",
                background: daysLeft < 14 ? "var(--danger-light)" : "var(--bg)",
                borderRadius: 20, padding: "2px 8px",
              }}>
                {daysLeft > 0 ? `${daysLeft}d left` : "Overdue"}
              </span>
            )}
          </div>
          <h3 style={{
            fontWeight: 600, fontSize: "0.95rem",
            color: goal.isPaused ? "var(--muted)" : "var(--text)",
            lineHeight: 1.4, marginBottom: 4,
          }}>
            {goal.title}
          </h3>
          {goal.structuredSummary && (
            <p style={{ fontSize: "0.82rem", color: "var(--subtext)", lineHeight: 1.5, marginBottom: 6 }}>
              {goal.structuredSummary}
            </p>
          )}
          <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Added {new Date(goal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
          {/* Progress ring */}
          {goal.deadline && !goal.isPaused && (
            <ProgressRing percentage={progressPercent} size={36} strokeWidth={3} />
          )}

          {/* Menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMenu(v => !v)}
              style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "var(--bg)", color: "var(--subtext)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, cursor: "pointer",
              }}
            >
              &#x22EF;
            </button>
            {showMenu && (
              <div
                style={{
                  position: "absolute", right: 0, top: 36, zIndex: 20,
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)",
                  minWidth: 160, overflow: "hidden",
                }}
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  onClick={handleTogglePause}
                  disabled={toggling}
                  style={{
                    display: "block", width: "100%", padding: "0.6rem 0.875rem",
                    textAlign: "left", color: "var(--subtext)", fontSize: "0.875rem",
                    fontWeight: 500, cursor: "pointer", background: "none", border: "none",
                  }}
                >
                  {toggling ? "..." : goal.isPaused ? "\u25B6 Resume goal" : "\u23F8 Pause goal"}
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
      </div>
    </div>
  );
}

// ─── Goals Page ───────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(searchParams.get("add") === "true");

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

  function handleGoalAdded(goal: Goal) {
    setShowAdd(false);
    setGoals(prev => [...prev, goal]);
  }

  function handleGoalDeleted(id: string) {
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  function handleGoalUpdated(updated: Goal) {
    setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
  }

  const activeGoals = goals.filter(g => !g.isPaused);
  const pausedGoals = goals.filter(g => g.isPaused);

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
          onClick={() => setShowAdd(true)}
          style={{ fontSize: "0.875rem" }}
        >
          + Add goal
        </button>
      </div>

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"\uD83C\uDFAF"}</div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>No goals yet</h2>
          <p style={{ color: "var(--subtext)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            Add your first goal and get AI-powered daily tasks.
          </p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            Add your first goal &#8594;
          </button>
        </div>
      ) : (
        <>
          {/* Active goals */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.875rem" }}>
            {activeGoals.map((goal, i) => (
              <div key={goal.id} className="slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
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
    </div>
  );
}
