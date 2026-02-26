"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { markOnboarded, saveNickname } from "@/lib/auth-context";
import { goalsApi, profileApi, tasksApi, type ParsedGoal, type TaskItem, type GoalChatMessage, type GoalChatResult } from "@/lib/api-client";
import GoalTemplatesComponent from "@/components/GoalTemplates";
import type { GoalCategory } from "@/lib/goal-templates";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5; // name, goal, deadline, time, intensity

const TIME_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
];

const CUSTOM_HOURS = Array.from({ length: 12 }, (_, i) => i + 3); // 3–14 hours

const INTENSITY_OPTIONS = [
  {
    level: 1 as const,
    emoji: "🌱",
    label: "Building the habit",
    description: "Steady, sustainable progress. Short daily wins.",
  },
  {
    level: 2 as const,
    emoji: "🎯",
    label: "Making real progress",
    description: "Committed and consistent. This is getting done.",
  },
  {
    level: 3 as const,
    emoji: "🚀",
    label: "All in",
    description: "Maximum effort. Push limits every day.",
  },
];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const CATEGORY_EMOJI: Record<string, string> = {
  fitness: "💪", business: "💼", learning: "📚", creative: "🎨",
  financial: "💰", health: "🌱", relationships: "🤝", productivity: "⚡",
  other: "🎯",
};

// ─── Step Dots ─────────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  const pct = Math.min(step / TOTAL_STEPS, 1) * 100;
  return (
    <div style={{ padding: "0 1.5rem", marginTop: 8 }}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p style={{
        fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6,
      }}>
        Step {step} of {TOTAL_STEPS}
      </p>
    </div>
  );
}

// ─── Onboarding Page ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);

  // Step 1 — Name
  const [nameInput, setNameInput] = useState("");

  // Step 2 — Goal input + parse
  const [rawGoalInput, setRawGoalInput] = useState("");
  const [parsedGoal, setParsedGoal] = useState<ParsedGoal | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // Step 2 — Category picker
  const [showTemplates, setShowTemplates] = useState(true);

  // Step 2 — AI Plan chat
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; text: string; options?: string[] }>>([]);
  const [chatMessages, setChatMessages] = useState<GoalChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const [chatGoalText, setChatGoalText] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Step 3 — Deadline (default: 1 month from today)
  const now = new Date();
  const defaultDeadline = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [hasDeadline, setHasDeadline] = useState(true);
  const [deadlineMonth, setDeadlineMonth] = useState(defaultDeadline.getMonth());
  const [deadlineDay, setDeadlineDay] = useState(defaultDeadline.getDate());
  const [deadlineYear, setDeadlineYear] = useState(defaultDeadline.getFullYear());

  // Step 4 — Daily time
  const [timeMinutes, setTimeMinutes] = useState<number | null>(null);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customHours, setCustomHours] = useState(3);

  // Step 5 — Intensity
  const [intensityLevel, setIntensityLevel] = useState<1 | 2 | 3 | null>(null);

  // Step 6 — Magic moment
  const [generatedTasks, setGeneratedTasks] = useState<TaskItem[]>([]);
  const [coachNote, setCoachNote] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [revealedCount, setRevealedCount] = useState(0);

  // ─── Navigation ────────────────────────────────────────────────────────────

  function advanceStep(next: number) {
    setStep(next);
  }

  // ─── Step 2: Goal parse ────────────────────────────────────────────────────

  async function handleParseGoal() {
    if (!rawGoalInput.trim()) return;
    setParsing(true);
    setParseError("");
    try {
      const result = await goalsApi.parse(rawGoalInput.trim());
      setParsedGoal(result);
      // Auto-fill deadline if detected
      if (result.deadline_detected) {
        const d = new Date(result.deadline_detected + "T12:00:00");
        setHasDeadline(true);
        setDeadlineMonth(d.getMonth());
        setDeadlineDay(d.getDate());
        setDeadlineYear(d.getFullYear());
      }
      // Auto-fill daily time if detected
      if (result.daily_time_detected && result.daily_time_detected > 0) {
        const mins = result.daily_time_detected;
        setTimeMinutes(mins);
        const preset = TIME_OPTIONS.find((o) => o.value === mins);
        if (preset) {
          setShowCustomTime(false);
        } else {
          // Round to nearest hour for custom picker (min 3hrs)
          const hrs = Math.max(3, Math.min(14, Math.round(mins / 60)));
          setCustomHours(hrs);
          setTimeMinutes(hrs * 60);
          setShowCustomTime(true);
        }
      }
      setShowConfirmation(true);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to analyze goal. Try again.");
    } finally {
      setParsing(false);
    }
  }

  function handleEditGoal() {
    setShowConfirmation(false);
  }

  function handleAddMoreDetail() {
    setShowConfirmation(false);
  }

  // ─── Step 2: Category selection → opens AI chat ─────────────────────────

  function handleCategorySelect(category: GoalCategory) {
    setShowTemplates(false);
    startAiChatWithMessage(category.starterMessage);
  }

  // ─── Step 2: AI Plan chat ─────────────────────────────────────────────────

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
    const userEntry = { role: "user" as const, text: answer };
    setChatHistory((prev) => [...prev, userEntry]);
    setCustomInput("");
    setChatLoading(true);

    const newMessages: GoalChatMessage[] = [...chatMessages, { role: "user", content: answer }];
    setChatMessages(newMessages);

    try {
      const result = await goalsApi.chat(newMessages);
      const assistantMsg: GoalChatMessage = { role: "assistant", content: result.raw_reply };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: result.message, options: result.done ? [] : result.options },
      ]);
      if (result.done) {
        setChatDone(true);
        setChatGoalText(result.goal_text);
      }
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: "Something went wrong. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleEditChatGoal() {
    setChatDone(false);
    setChatGoalText(null);
    sendChatAnswer("I'd like to change something about my goal.");
  }

  async function handleUseGoal() {
    if (!chatGoalText) return;
    setRawGoalInput(chatGoalText);
    setShowAiChat(false);
    // Auto-parse and advance to step 3
    setParsing(true);
    setParseError("");
    try {
      const result = await goalsApi.parse(chatGoalText.trim());
      setParsedGoal(result);
      if (result.deadline_detected) {
        const d = new Date(result.deadline_detected + "T12:00:00");
        setHasDeadline(true);
        setDeadlineMonth(d.getMonth());
        setDeadlineDay(d.getDate());
        setDeadlineYear(d.getFullYear());
      }
      if (result.daily_time_detected && result.daily_time_detected > 0) {
        const mins = result.daily_time_detected;
        setTimeMinutes(mins);
        const preset = TIME_OPTIONS.find((o) => o.value === mins);
        if (preset) {
          setShowCustomTime(false);
        } else {
          const hrs = Math.max(3, Math.min(14, Math.round(mins / 60)));
          setCustomHours(hrs);
          setTimeMinutes(hrs * 60);
          setShowCustomTime(true);
        }
      }
      // Skip steps that AI Plan already covered
      let nextStep = 3;
      if (result.deadline_detected) nextStep = 4; // skip deadline step
      if (result.daily_time_detected && result.daily_time_detected > 0) nextStep = 5; // skip time step too
      advanceStep(nextStep);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to analyze goal. Try again.");
    } finally {
      setParsing(false);
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  // ─── Step 3: Deadline helpers ──────────────────────────────────────────────

  const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() + i);
  const daysInCurrentMonth = DAYS_IN_MONTH[deadlineMonth];
  const dayOptions = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  function getDeadlineISO(): string | undefined {
    if (!hasDeadline) return undefined;
    const month = String(deadlineMonth + 1).padStart(2, "0");
    const day = String(Math.min(deadlineDay, daysInCurrentMonth)).padStart(2, "0");
    return `${deadlineYear}-${month}-${day}`;
  }

  // ─── Build (Magic Moment) ──────────────────────────────────────────────────

  async function handleBuild() {
    setBuildError("");
    setBuilding(true);
    setRevealedCount(0);
    advanceStep(TOTAL_STEPS + 1);

    try {
      const goalTitle =
        parsedGoal?.structured_summary?.replace(/^You want to /i, "").replace(/\.$/, "") ??
        rawGoalInput.trim();

      // Save display name
      const name = nameInput.trim() || user?.email?.split("@")[0] || "Champion";
      saveNickname(name);

      // Save profile
      await profileApi.save({
        dailyTimeMinutes: timeMinutes ?? 60,
        intensityLevel: intensityLevel ?? 2,
      });

      // Create goal with all parsed data + per-goal settings
      const goalResult = await goalsApi.create({
        title: goalTitle.slice(0, 80),
        rawInput: rawGoalInput.trim(),
        structuredSummary: parsedGoal?.structured_summary,
        category: parsedGoal?.category,
        deadline: parsedGoal?.deadline_detected ?? getDeadlineISO() ?? null,
        dailyTimeMinutes: timeMinutes ?? undefined,
        intensityLevel: intensityLevel ?? undefined,
      });

      // Generate tasks
      const tasksResult = await tasksApi.generate({ goalId: goalResult.goal.id });

      const allTasks = tasksResult.dailyTasks.flatMap((dt) => dt.tasks).slice(0, 3);
      setGeneratedTasks(allTasks);
      if (tasksResult.coachNote) setCoachNote(tasksResult.coachNote);
      setBuilding(false);

      // Staggered reveal
      allTasks.forEach((_, i) => {
        setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), i * 350);
      });

      // Mark onboarded
      if (user) markOnboarded(user.id);
    } catch (e: unknown) {
      setBuildError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBuilding(false);
    }
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  const isMagicMoment = step > TOTAL_STEPS;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: "1rem",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 500,
        background: "var(--card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        flexDirection: "column",
        minHeight: isMagicMoment ? 420 : undefined,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", padding: "2rem 2rem 0" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "var(--primary)", color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700,
          }}>3</div>
        </div>

        {/* Progress bar */}
        {!isMagicMoment && (
          <div style={{ padding: "12px 2rem 0" }}>
            <ProgressBar step={step} />
          </div>
        )}

        {/* Back button */}
        {step > 1 && !isMagicMoment && (
          <div style={{ padding: "8px 2rem 0" }}>
            <button
              onClick={() => advanceStep(step - 1)}
              style={{
                fontSize: "0.9rem", color: "var(--subtext)", fontWeight: 500,
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              ‹ Back
            </button>
          </div>
        )}

        {/* ── Step 1: Name ── */}
        {step === 1 && (
          <div className="fade-in" style={{ padding: "1.5rem 2rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
                What should we call you?
              </h2>
              <p style={{ color: "var(--subtext)", fontSize: "0.9rem" }}>
                This appears in your daily greeting.
              </p>
            </div>
            <input
              className="field-input"
              placeholder="Your first name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && nameInput.trim() && advanceStep(2)}
              autoFocus
              style={{ height: 50, fontSize: "1.1rem", fontWeight: 600 }}
            />
            <button
              className="btn btn-primary"
              onClick={() => nameInput.trim() && advanceStep(2)}
              disabled={!nameInput.trim()}
              style={{ height: 50, width: "100%" }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Goal ── */}
        {step === 2 && (
          <div className="fade-in" style={{ padding: "1.5rem 2rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {showTemplates ? (
              <GoalTemplatesComponent
                onSelect={handleCategorySelect}
                onClose={() => advanceStep(1)}
                onOther={() => {
                  setShowTemplates(false);
                  startAiChatWithMessage("Help me define my goal.");
                }}
              />
            ) : null}

            {parseError && (
              <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{parseError}</p>
            )}
          </div>
        )}

        {/* ── Step 3: Deadline ── */}
        {step === 3 && (
          <div className="fade-in" style={{ padding: "1.5rem 2rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
                Do you have a deadline?
              </h2>
              <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                A deadline helps Threely Intelligence pace your tasks. If you skip this, we'll use a 90-day rolling horizon.
              </p>
            </div>

            {/* Toggle */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "var(--card)", borderRadius: "var(--radius-lg)",
              border: "1.5px solid var(--border)", padding: "0.875rem 1rem",
              boxShadow: "var(--shadow-sm)",
            }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--text)" }}>
                I have a target date
              </span>
              <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={hasDeadline}
                  onChange={(e) => setHasDeadline(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: "absolute", inset: 0, borderRadius: 12,
                  background: hasDeadline ? "var(--primary)" : "var(--border)",
                  transition: "background 0.2s",
                }}>
                  <span style={{
                    position: "absolute", top: 2, left: hasDeadline ? 22 : 2,
                    width: 20, height: 20, borderRadius: 10,
                    background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    transition: "left 0.2s",
                  }} />
                </span>
              </label>
            </div>

            {/* Date picker */}
            {hasDeadline && (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, textAlign: "center",
                  }}>Month</label>
                  <select
                    value={deadlineMonth}
                    onChange={(e) => setDeadlineMonth(Number(e.target.value))}
                    className="field-input"
                    style={{ textAlign: "center", fontSize: "1rem", fontWeight: 600, height: 48, cursor: "pointer" }}
                  >
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, textAlign: "center",
                  }}>Day</label>
                  <select
                    value={deadlineDay}
                    onChange={(e) => setDeadlineDay(Number(e.target.value))}
                    className="field-input"
                    style={{ textAlign: "center", fontSize: "1rem", fontWeight: 600, height: 48, cursor: "pointer" }}
                  >
                    {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, textAlign: "center",
                  }}>Year</label>
                  <select
                    value={deadlineYear}
                    onChange={(e) => setDeadlineYear(Number(e.target.value))}
                    className="field-input"
                    style={{ textAlign: "center", fontSize: "1rem", fontWeight: 600, height: 48, cursor: "pointer" }}
                  >
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() => advanceStep(4)}
              style={{ height: 50, width: "100%" }}
            >
              {hasDeadline
                ? `Set deadline: ${MONTHS[deadlineMonth]} ${deadlineDay}, ${deadlineYear}`
                : "No deadline →"}
            </button>
          </div>
        )}

        {/* ── Step 4: Time ── */}
        {step === 4 && (
          <div className="fade-in" style={{ padding: "1.5rem 2rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
                How much time can you dedicate daily?
              </h2>
              <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                Threely Intelligence will size your tasks to fit this window. You can change it anytime.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {TIME_OPTIONS.map((opt) => {
                const isSelected = !showCustomTime && timeMinutes === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setTimeMinutes(opt.value); setShowCustomTime(false); }}
                    style={{
                      flex: "1 1 calc(50% - 5px)", minWidth: 120,
                      padding: "14px 0", borderRadius: "var(--radius-lg)",
                      border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                      background: isSelected ? "var(--primary-light)" : "var(--card)",
                      color: isSelected ? "var(--primary)" : "var(--text)",
                      fontSize: "0.95rem", fontWeight: 600, cursor: "pointer",
                      boxShadow: "var(--shadow-sm)", textAlign: "center",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setShowCustomTime(true);
                  setTimeMinutes(customHours * 60);
                }}
                style={{
                  flex: "1 1 calc(50% - 5px)", minWidth: 120,
                  padding: "14px 0", borderRadius: "var(--radius-lg)",
                  border: `1.5px solid ${showCustomTime ? "var(--primary)" : "var(--border)"}`,
                  background: showCustomTime ? "var(--primary-light)" : "var(--card)",
                  color: showCustomTime ? "var(--primary)" : "var(--text)",
                  fontSize: "0.95rem", fontWeight: 600, cursor: "pointer",
                  boxShadow: "var(--shadow-sm)", textAlign: "center",
                }}
              >
                {showCustomTime ? `${customHours} hrs` : "+ Custom"}
              </button>
            </div>

            {showCustomTime && (
              <div>
                <select
                  value={customHours}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setCustomHours(h);
                    setTimeMinutes(h * 60);
                  }}
                  className="field-input"
                  style={{ textAlign: "center", fontSize: "1.1rem", fontWeight: 600, height: 52, cursor: "pointer" }}
                >
                  {CUSTOM_HOURS.map((h) => (
                    <option key={h} value={h}>{h} hours</option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() => timeMinutes !== null && advanceStep(5)}
              disabled={timeMinutes === null}
              style={{ height: 50, width: "100%" }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 5: Intensity ── */}
        {step === 5 && (
          <div className="fade-in" style={{ padding: "1.5rem 2rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
                What's your pace?
              </h2>
              <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                This shapes how ambitious Threely Intelligence makes your daily tasks.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {INTENSITY_OPTIONS.map((opt) => {
                const isSelected = intensityLevel === opt.level;
                return (
                  <button
                    key={opt.level}
                    onClick={() => setIntensityLevel(opt.level)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "1rem", borderRadius: "var(--radius-lg)",
                      border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                      background: isSelected ? "var(--primary-light)" : "var(--card)",
                      cursor: "pointer", textAlign: "left",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{opt.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: "0.95rem", fontWeight: 600,
                        color: isSelected ? "var(--primary)" : "var(--text)",
                      }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--subtext)", marginTop: 2 }}>
                        {opt.description}
                      </div>
                    </div>
                    {isSelected && (
                      <span style={{ fontSize: "0.95rem", color: "var(--primary)", fontWeight: 700 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              className="btn btn-primary"
              onClick={intensityLevel ? handleBuild : undefined}
              disabled={!intensityLevel}
              style={{ height: 50, width: "100%" }}
            >
              Build my plan →
            </button>
          </div>
        )}

        {/* ── Magic Moment ── */}
        {isMagicMoment && (
          <div style={{ padding: "2rem", flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Building state */}
            {building && !buildError && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                textAlign: "center", padding: "2rem 0",
              }}>
                <span style={{ fontSize: 48, color: "var(--primary)", marginBottom: 20 }}>✦</span>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>
                  Threely Intelligence is building your plan…
                </h2>
                <p style={{ color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Analyzing your goal and crafting<br />3 perfect tasks to start with.
                </p>
                <div style={{ marginTop: 24 }}>
                  <span className="spinner spinner-dark" />
                </div>
              </div>
            )}

            {/* Error state */}
            {buildError && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                textAlign: "center", padding: "2rem 0",
              }}>
                <span style={{ fontSize: 48, marginBottom: 20 }}>⚠</span>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>
                  Something went wrong
                </h2>
                <p style={{ color: "var(--danger)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  {buildError}
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleBuild}
                  style={{ marginTop: 20, height: 46, padding: "0 2rem" }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* Tasks revealed */}
            {!building && !buildError && generatedTasks.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <h2 style={{
                  fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em",
                  textAlign: "center", marginBottom: 6,
                }}>
                  Your plan is ready ✦
                </h2>

                {coachNote && (
                  <p style={{
                    color: "var(--subtext)", fontSize: "0.9rem", lineHeight: 1.5,
                    fontStyle: "italic", textAlign: "center", marginBottom: 20,
                  }}>
                    {coachNote}
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                  {generatedTasks.map((task, i) => (
                    <div
                      key={task.id}
                      style={{
                        background: "var(--card)", borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border)", padding: "1rem",
                        boxShadow: "var(--shadow-sm)",
                        opacity: revealedCount > i ? 1 : 0,
                        transform: revealedCount > i ? "translateY(0)" : "translateY(16px)",
                        transition: "opacity 0.4s ease, transform 0.4s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>
                            {task.task}
                          </p>
                        </div>
                        {task.estimated_minutes > 0 && (
                          <span style={{
                            background: "var(--primary-light)", borderRadius: 20,
                            padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600,
                            color: "var(--primary)", whiteSpace: "nowrap", flexShrink: 0,
                          }}>
                            ~{task.estimated_minutes}m
                          </span>
                        )}
                      </div>
                      {task.why && (
                        <p style={{
                          fontSize: "0.8rem", color: "var(--subtext)", lineHeight: 1.5,
                          fontStyle: "italic", marginTop: 6,
                        }}>
                          {task.why}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "auto" }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => router.replace("/dashboard")}
                    style={{ height: 50, width: "100%" }}
                  >
                    Let's go →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── AI Plan Chat Modal ── */}
      {showAiChat && (
        <div className="modal-overlay" onClick={() => { setShowAiChat(false); setShowTemplates(true); }}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", padding: 0, maxHeight: "85vh" }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, color: "var(--primary)" }}>✦</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>
                  Threely Intelligence
                </span>
              </div>
              <button
                onClick={() => { setShowAiChat(false); setShowTemplates(true); }}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg)", border: "1px solid var(--border)",
                  cursor: "pointer", fontSize: 16, color: "var(--subtext)",
                }}
              >
                ×
              </button>
            </div>

            {/* Chat area */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {chatHistory.map((entry, i) => (
                <div key={i}>
                  {entry.role === "assistant" ? (
                    <div style={{
                      background: "var(--primary-light)", borderRadius: "14px 14px 14px 4px",
                      padding: "0.75rem 1rem", maxWidth: "85%",
                      fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.5,
                    }}>
                      {entry.text}
                    </div>
                  ) : (
                    <div style={{
                      display: "flex", justifyContent: "flex-end",
                    }}>
                      <div style={{
                        background: "var(--primary)", borderRadius: "14px 14px 4px 14px",
                        padding: "0.75rem 1rem", maxWidth: "85%",
                        fontSize: "0.9rem", color: "#fff", lineHeight: 1.5,
                      }}>
                        {entry.text}
                      </div>
                    </div>
                  )}

                  {/* Option buttons for assistant messages */}
                  {entry.role === "assistant" && entry.options && entry.options.length > 0 && !chatLoading && i === chatHistory.length - 1 && !chatDone && (
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10,
                    }}>
                      {entry.options.map((opt, j) => (
                        <button
                          key={j}
                          onClick={() => sendChatAnswer(opt)}
                          style={{
                            padding: "8px 16px", borderRadius: 20,
                            border: "1.5px solid rgba(99,91,255,0.25)",
                            background: "var(--card)", color: "var(--primary)",
                            fontSize: "0.85rem", fontWeight: 600,
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--primary-light)";
                            e.currentTarget.style.borderColor = "var(--primary)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "var(--card)";
                            e.currentTarget.style.borderColor = "rgba(99,91,255,0.25)";
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {chatLoading && (
                <div style={{
                  background: "var(--primary-light)", borderRadius: "14px 14px 14px 4px",
                  padding: "0.75rem 1rem", maxWidth: 80,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <span className="spinner spinner-dark" style={{ width: 16, height: 16 }} />
                </div>
              )}

              {/* Done state — goal preview */}
              {chatDone && chatGoalText && (
                <div style={{
                  background: "var(--card)", borderRadius: "var(--radius-lg)",
                  border: "1.5px solid rgba(99,91,255,0.27)", padding: "1rem",
                  marginTop: 8, boxShadow: "var(--shadow-sm)",
                }}>
                  <p style={{
                    fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
                  }}>
                    Your goal
                  </p>
                  <p style={{ fontSize: "0.95rem", color: "var(--text)", lineHeight: 1.5, fontWeight: 500 }}>
                    {chatGoalText}
                  </p>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Bottom area */}
            <div style={{
              padding: "1rem 1.5rem", borderTop: "1px solid var(--border)",
              flexShrink: 0,
            }}>
              {chatDone ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleUseGoal}
                    style={{ height: 46, width: "100%" }}
                  >
                    Use this goal →
                  </button>
                  <button
                    onClick={handleEditChatGoal}
                    style={{
                      fontSize: "0.85rem", color: "var(--subtext)",
                      textDecoration: "underline", background: "none", border: "none",
                      cursor: "pointer", padding: "6px 0", textAlign: "center",
                    }}
                  >
                    Edit goal
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="field-input"
                    placeholder="Type your own answer…"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customInput.trim() && !chatLoading) {
                        sendChatAnswer(customInput.trim());
                      }
                    }}
                    disabled={chatLoading}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => customInput.trim() && !chatLoading && sendChatAnswer(customInput.trim())}
                    disabled={!customInput.trim() || chatLoading}
                    style={{ padding: "0 16px", flexShrink: 0 }}
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
