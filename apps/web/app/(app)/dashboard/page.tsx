"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth, getNickname } from "@/lib/auth-context";
import { formatDisplayName } from "@/lib/format-name";
import {
  tasksApi, goalsApi, reviewsApi, insightsApi, statsApi, focusApi,
  type DailyTask, type TaskItem, type Goal, type GoalStat,
} from "@/lib/api-client";
import { SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";
import { useSubscription } from "@/lib/subscription-context";
import { MOCK_TUTORIAL_GOAL, MOCK_TUTORIAL_DAILY_TASK } from "@/lib/mock-tutorial-data";

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
  website: "\u2197",
  book: "\u2261",
  app: "\u25A0",
};

function TaskCard({
  task, onToggle, onSkip, onReschedule, onRefine, onAsk, readonly = false, overdue = false, hasPro = true,
}: {
  task: TaskItem;
  onToggle?: (id: string, done: boolean) => void;
  onSkip?: (id: string) => void;
  onReschedule?: (id: string) => void;
  onRefine?: (id: string, userRequest: string) => void;
  onAsk?: (id: string, messages: { role: "user" | "assistant"; content: string }[]) => Promise<{ answer: string; options: string[] }>;
  readonly?: boolean;
  overdue?: boolean;
  hasPro?: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [refineMode, setRefineMode] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  // Ask mode state
  const [askMode, setAskMode] = useState(false);
  const [askMessages, setAskMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askOptions, setAskOptions] = useState<string[]>([]);
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

  // Menu close is handled by the portal backdrop's onClick

  function handleStartRefine() {
    if (!hasPro) { router.push("/checkout?plan=yearly"); return; }
    setMenuOpen(false);
    setRefineInput("");
    setRefineMode(true);
    setAskMode(false);
  }

  function handleStartAsk() {
    if (!hasPro) { router.push("/checkout?plan=yearly"); return; }
    setMenuOpen(false);
    setAskMode(true);
    setAskMessages([]);
    setAskInput("");
    setAskOptions([]);
    setRefineMode(false);
  }

  async function handleSubmitRefine() {
    if (!refineInput.trim()) return;
    setRefining(true);
    onRefine?.(task.id, refineInput.trim());
    setRefining(false);
    setRefineMode(false);
  }

  async function handleSendAsk(messageText?: string) {
    const text = messageText ?? askInput.trim();
    if (!text || askLoading || !onAsk) return;
    const userMsg = { role: "user" as const, content: text };
    const newMessages = [...askMessages, userMsg];
    setAskMessages(newMessages);
    setAskInput("");
    setAskOptions([]);
    setAskLoading(true);
    try {
      const result = await onAsk(task.id, newMessages);
      setAskMessages(prev => [...prev, { role: "assistant", content: result.answer }]);
      setAskOptions(result.options ?? []);
    } catch {
      setAskMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
      setAskOptions([]);
    } finally {
      setAskLoading(false);
    }
  }

  const showMenu = !readonly && !task.isCompleted && !task.isSkipped;

  return (
    <div
      className={`card${!task.isCompleted && !task.isSkipped ? " task-card-hover" : ""}`}
      style={{
        padding: "1.125rem 1.25rem",
        opacity: task.isCompleted || task.isSkipped ? 0.7 : 1,
        transition: "opacity 0.2s, transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        borderColor: overdue ? "var(--warning)" : undefined,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        {!readonly && (
          <button
            className={`task-checkbox${task.isCompleted ? " checked" : ""}${task.isSkipped ? " skipped" : ""}`}
            onClick={() => !task.isSkipped && onToggle?.(task.id, !task.isCompleted)}
            style={{ marginTop: 2, cursor: task.isSkipped ? "not-allowed" : undefined }}
            disabled={task.isSkipped}
          >
            {task.isCompleted && "\u2713"}
            {task.isSkipped && "\u2715"}
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
                  fontSize: "1rem",
                  color: task.isCompleted ? "var(--muted)" : "var(--text)",
                  textDecoration: task.isCompleted ? "line-through" : "none",
                  lineHeight: 1.45,
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
                  data-walkthrough="ask-ai-button"
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
          <div data-walkthrough="task-menu-button" style={{ position: "relative", flexShrink: 0 }}>
            <button
              ref={menuBtnRef}
              onClick={() => {
                if (!menuOpen && menuBtnRef.current) {
                  const rect = menuBtnRef.current.getBoundingClientRect();
                  setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                }
                setMenuOpen(o => !o);
              }}
              style={{
                fontSize: "1.25rem", lineHeight: 1, padding: "8px 10px",
                color: "var(--muted)", cursor: "pointer",
                borderRadius: 4, border: "none", background: "transparent",
              }}
            >
              {"\u22EF"}
            </button>
            {menuOpen && menuPos && typeof document !== "undefined" && createPortal(
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
                <div data-walkthrough="task-menu-button-dropdown" style={{
                  position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999,
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  minWidth: 180, maxWidth: "calc(100vw - 20px)", overflow: "hidden",
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
              </>,
              document.body
            )}
          </div>
        )}
      </div>

      {/* Ask AI modal overlay — rendered via portal to escape transform stacking context */}
      {askMode && onAsk && typeof document !== "undefined" && createPortal(
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
            width: "calc(100vw - 2rem)", maxWidth: 640,
            maxHeight: "min(700px, 85vh)",
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
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>Threely Intelligence</span>
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
              minHeight: 0,
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

              {/* Suggestion chips (shown when no messages yet) */}
              {askMessages.length === 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {["How do I start?", "Break it down", "Tips & resources", "Why this task?"].map(s => (
                    <button
                      key={s}
                      onClick={() => handleSendAsk(s)}
                      style={{
                        padding: "10px 16px", borderRadius: 20,
                        border: "1.5px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                        background: "var(--primary-light)",
                        fontSize: "0.8rem", fontWeight: 600,
                        color: "var(--primary)", cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--primary) 12%, transparent)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "var(--primary-light)"; }}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    onClick={() => askInputRef.current?.focus()}
                    style={{
                      padding: "10px 16px", borderRadius: 20,
                      border: "1.5px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "0.8rem", fontWeight: 600,
                      color: "var(--subtext)", cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--card)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--bg)"; }}
                  >
                    Type my own
                  </button>
                </div>
              )}

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
                      ? { background: "var(--primary)", color: "var(--primary-text)" }
                      : { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }),
                  }}
                >
                  {msg.content}
                </div>
              ))}

              {/* Option buttons after AI response */}
              {!askLoading && askOptions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                  {askOptions.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleSendAsk(opt)}
                      style={{
                        padding: "10px 16px", borderRadius: 20,
                        border: "1.5px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                        background: "var(--primary-light)",
                        fontSize: "0.8rem", fontWeight: 600,
                        color: "var(--primary)", cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--primary) 12%, transparent)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "var(--primary-light)"; }}
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    onClick={() => askInputRef.current?.focus()}
                    style={{
                      padding: "10px 16px", borderRadius: 20,
                      border: "1.5px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "0.8rem", fontWeight: 600,
                      color: "var(--subtext)", cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--card)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--bg)"; }}
                  >
                    Type my own
                  </button>
                </div>
              )}

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
                onClick={() => handleSendAsk()}
                disabled={askLoading || !askInput.trim()}
                style={{ fontSize: "0.85rem", padding: "8px 18px", borderRadius: 10 }}
              >
                Send
              </button>
            </div>
          </div>
        </>,
        document.body
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
  return (
    <Suspense>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { hasPro, refreshSubscription, walkthroughActive } = useSubscription();
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [showWorkAhead, setShowWorkAhead] = useState(false);
  const [completingAll, setCompletingAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [appNudgeDismissed, setAppNudgeDismissed] = useState(false);
  const [showGenLimit, setShowGenLimit] = useState(false);
  const [restDay, setRestDay] = useState(false);
  const [restDayPickerOpen, setRestDayPickerOpen] = useState(false);
  const hasAutoGenerated = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recentlyToggledRef = useRef<Set<string>>(new Set());
  const [sortTrigger, setSortTrigger] = useState(0);

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
      // Check if any generate is in progress (user may have closed tab / switched tabs)
      const todayStr = new Date().toLocaleDateString("en-CA");
      const restGenFlag = localStorage.getItem(`threely_restday_gen_${todayStr}`);
      const moreGenFlag = localStorage.getItem(`threely_generating_${todayStr}`);
      const activeGenFlag = restGenFlag || moreGenFlag;
      const flagKey = restGenFlag ? `threely_restday_gen_${todayStr}` : `threely_generating_${todayStr}`;

      if (activeGenFlag && !pollingRef.current) {
        const startedAt = parseInt(activeGenFlag, 10);
        const elapsed = Date.now() - startedAt;
        if (elapsed < 90_000) {
          // Show loading and poll for new tasks
          setGenerating(true);
          setRestDay(false);
          const prevTaskCount = tasksRes.dailyTasks.length;
          pollingRef.current = setInterval(async () => {
            try {
              const poll = await tasksApi.today(false);
              // New tasks arrived: either more tasks than before, or tasks appeared from zero
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
              // Refetch final state
              tasksApi.today(false).then(r => {
                setDailyTasks(r.dailyTasks);
                setRestDay(r.restDay ?? false);
              }).catch(() => {});
            }
          }, Math.max(0, 90_000 - elapsed));
        } else {
          // Flag is stale (>90s old), clear it
          localStorage.removeItem(flagKey);
          setRestDay(tasksRes.restDay ?? false);
        }
      } else {
        setRestDay(tasksRes.restDay ?? false);
      }

      // Restore saved focus: prefer server, fallback to localStorage
      const todayKey = `threely_focus_${new Date().toLocaleDateString("en-CA")}`;
      const serverFocus = focusRes.focus?.focusGoalId ?? null;
      const localFocus = localStorage.getItem(todayKey);
      const restoredFocus = serverFocus ?? localFocus;
      const activeGoalIds = new Set(goalsRes.goals.map(g => g.id));
      const isValidFocus = restoredFocus && restoredFocus !== "all" && activeGoalIds.has(restoredFocus);
      if (isValidFocus) {
        setSelectedGoalId(restoredFocus);
        // Sync localStorage with server if server had focus but local didn't
        if (serverFocus && !localFocus) {
          localStorage.setItem(todayKey, serverFocus);
        }
      } else if (goalsRes.goals.length === 1) {
        const onlyGoalId = goalsRes.goals[0].id;
        setSelectedGoalId(onlyGoalId);
        localStorage.setItem(todayKey, onlyGoalId);
      } else if (goalsRes.goals.length > 1) {
        // Multiple goals, no saved pick — prompt user to choose (skip during tutorial)
        setSelectedGoalId(null);
        if (!walkthroughActive) setGoalPickerOpen(true);
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
        localStorage.setItem(flagKey, String(Date.now()));
        try {
          const genRes = await tasksApi.generate();
          localStorage.removeItem(flagKey);
          if (genRes.restDay) {
            setRestDay(true);
          } else {
            setDailyTasks(genRes.dailyTasks);
          }
        } catch (err: unknown) {
          localStorage.removeItem(flagKey);
          // pro_required or other errors — silently fail auto-generate, user can retry via fallback UI
        } finally {
          setGenerating(false);
        }
      }
    } catch {
      showToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, walkthroughActive]);

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

  // Refetch when tab becomes visible (sync across devices) — skip if generating
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
  const _sort = sortTrigger; // subscribe to sort trigger for delayed reorder

  // During tutorial walkthrough, always use mock data for consistent spotlight targets
  const effectiveGoals = walkthroughActive ? [MOCK_TUTORIAL_GOAL] : goals;
  const effectiveDailyTasks = walkthroughActive ? [MOCK_TUTORIAL_DAILY_TASK] : dailyTasks;
  const effectiveSelectedGoalId = walkthroughActive ? MOCK_TUTORIAL_GOAL.id : selectedGoalId;

  const displayedTasks = (() => {
    if (effectiveSelectedGoalId === null) return [];
    const dt = effectiveDailyTasks.find(d => d.goalId === effectiveSelectedGoalId);
    if (!dt) return [];
    const items = dt.tasks.slice(-3).map(task => ({ dt, task }));

    // Sort: incomplete first, completed last (recently toggled stay in place)
    const incomplete = items.filter(x => !x.task.isCompleted || recentlyToggledRef.current.has(x.task.id));
    const completed = items.filter(x => x.task.isCompleted && !recentlyToggledRef.current.has(x.task.id));
    return [...incomplete, ...completed];
  })();

  const displayedItems = displayedTasks.map(x => x.task);
  const allDisplayedItems = displayedItems;
  const completedCount = allDisplayedItems.filter(t => t.isCompleted || t.isSkipped).length;
  const totalCount = allDisplayedItems.length;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalEstimatedMinutes = allDisplayedItems
    .filter(t => !t.isCompleted && !t.isSkipped)
    .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  function pickGoal(val: string) {
    setSelectedGoalId(val);
    setGoalPickerOpen(false);
    localStorage.setItem(`threely_focus_${new Date().toLocaleDateString("en-CA")}`, val);
    focusApi.save(val).catch(() => {});
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

  async function handleGenerate(goalId?: string, isRestDayGen = false) {
    if (!hasPro) { router.push("/checkout?plan=yearly"); return; }
    setGenerating(true);
    // Set a flag so if user closes tab / refreshes, we know to poll on return
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
      // Clear any stale generation state so completed tasks show properly (not skeletons)
      setGenerating(false);
      const todayStr = new Date().toLocaleDateString("en-CA");
      localStorage.removeItem(`threely_generating_${todayStr}`);
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      showToast("All tasks completed!", "success");
    } catch {
      showToast("Failed to complete all tasks", "error");
    } finally {
      setCompletingAll(false);
    }
  }

  function handleGiveMore() {
    if (!hasPro) { router.push("/checkout?plan=yearly"); return; }
    // Pre-check: if tasks already have > 3 items, this goal already got extra tasks today
    const dt = dailyTasks.find(d => d.goalId === selectedGoalId);
    if (dt) {
      const taskCount = Array.isArray(dt.tasks) ? dt.tasks.length : 0;
      if (taskCount > 3) {
        setShowGenLimit(true);
        return;
      }
    }
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
    const todayStr = new Date().toLocaleDateString("en-CA");
    localStorage.setItem(`threely_generating_${todayStr}`, String(Date.now()));
    try {
      const goalId = selectedGoalId ?? undefined;
      const res = await tasksApi.generate({ postReview: true, goalId });
      setDailyTasks(res.dailyTasks);
      localStorage.removeItem(`threely_generating_${todayStr}`);
    } catch (err: unknown) {
      localStorage.removeItem(`threely_generating_${todayStr}`);
      if (err instanceof Error && err.message?.includes("generation_limit_reached")) {
        setShowGenLimit(true);
      } else if (!(err instanceof Error && err.message?.includes("pro_required"))) {
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
            href={/Android/i.test(navigator.userAgent) ? "https://play.google.com/store/apps/details?id=com.threely" : "https://apps.apple.com/app/threely/id6759625661"}
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

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 4 }}>{todayStr()}</p>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em" }}>
          {greeting()}, {(() => {
            const raw = getNickname() || user?.email?.split("@")[0] || "";
            const formatted = formatDisplayName(raw);
            const first = formatted.split(" ")[0] || "there";
            return first;
          })()}
        </h1>
      </div>

      {/* Limited mode banner */}
      {!hasPro && (
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
              Try Free →
            </div>
          </div>
        </a>
      )}

      {/* No goals — prompt to create one */}
      {effectiveGoals.length === 0 && (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"✦"}</div>
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
      {effectiveGoals.length > 0 && effectiveSelectedGoalId === null && !goalPickerOpen && effectiveDailyTasks.length === 0 && (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"✦"}</div>
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
      {effectiveGoals.length > 0 && restDay && !generating && !walkthroughActive && (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"✦"}</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
            No goals scheduled for today
          </h2>
          <p style={{ color: "var(--subtext)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
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
            <p style={{ color: "var(--subtext)", fontSize: "0.875rem", marginBottom: "1rem", lineHeight: 1.5 }}>
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
      {effectiveGoals.length > 0 && generating && effectiveDailyTasks.length === 0 && (
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

      {/* Fallback: goal selected but no tasks generated yet — let user retry */}
      {effectiveGoals.length > 0 && effectiveSelectedGoalId !== null && effectiveDailyTasks.length === 0 && !generating && !restDay && (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: "1rem" }}>{"⚡"}</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Ready to get started?
          </h2>
          <p style={{ color: "var(--subtext)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Generate today{"'"}s tasks for your goal.
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

      {effectiveGoals.length > 0 && effectiveDailyTasks.length > 0 && effectiveSelectedGoalId !== null && (
        <>
          {/* Goal selector + progress */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            {/* Goal selector row */}
            <div
              onClick={() => { if (effectiveGoals.length > 1) setGoalPickerOpen(true); }}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                marginBottom: "0.875rem",
                cursor: effectiveGoals.length > 1 ? "pointer" : "default",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius)",
                background: effectiveGoals.length > 1 ? "var(--bg)" : "transparent",
                border: effectiveGoals.length > 1 ? "1px solid var(--border)" : "none",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { if (effectiveGoals.length > 1) e.currentTarget.style.borderColor = "var(--primary)"; }}
              onMouseLeave={e => { if (effectiveGoals.length > 1) e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", flex: 1, minWidth: 0 }}>
                {effectiveSelectedGoalId === null ? "Select a goal" : effectiveGoals.find(g => g.id === effectiveSelectedGoalId)?.title ?? "Select goal"}
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
              {effectiveGoals.length > 1 && (
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

          {/* Locked hint — shown above tasks when not all done */}
          {!allDone && !insight && totalCount > 0 && (
            <div data-walkthrough="unlock-more-bar" style={{ marginBottom: "1rem", textAlign: "center", padding: "0.75rem 0" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                Complete all tasks to unlock more  ·  {completedCount}/{totalCount} done
              </div>
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
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)", margin: 0, marginBottom: 6 }}>
                ✦ Coach note
              </p>
              <p style={{ fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.6, margin: 0 }}>
                {insight}
              </p>
              {generating && (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 8, margin: 0 }}>
                  <span className="spinner" style={{ marginRight: 6 }} />Generating next tasks...
                </p>
              )}
              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <button
                  onClick={() => setInsight(null)}
                  className="btn btn-primary"
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    padding: "0.5rem 1.5rem",
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          )}

          {/* Give me more — shown when all done */}
          {allDone && (
            <div data-walkthrough="get-more-button" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleGiveMore}
                disabled={generating}
                className="btn btn-primary"
                style={{
                  fontWeight: 700, fontSize: "0.95rem",
                  padding: "0.75rem 2.5rem",
                  borderRadius: 9999,
                }}
              >
                {generating ? <><span className="spinner" style={{ width: 18, height: 18 }} /> Generating...</> : "Get more tasks"}
              </button>
            </div>
          )}

          {/* Today's tasks — show skeletons while generating next batch */}
          {generating && allDone ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginBottom: "1.25rem" }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <p style={{ textAlign: "center", marginTop: "0.5rem", color: "var(--subtext)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                <strong>Generating your next tasks...</strong>
                <br />
                This can take a couple of minutes. Feel free to leave — your tasks will be ready when you come back.
              </p>
            </div>
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
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
                    hasPro={hasPro}
                  />
                </div>
              ))}
            </div>
          )}

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
              <span style={{ fontSize: "2rem" }}>{"✦"}</span>
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

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowGenLimit(false);
                  window.location.href = "/goals";
                }}
                style={{ flex: "1 1 140px", padding: "0.75rem", fontSize: "0.9rem" }}
              >
                Adjust my plan
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowGenLimit(false)}
                style={{ flex: "1 1 140px", padding: "0.75rem", fontSize: "0.9rem" }}
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

      {/* Goal picker modal (with metadata) — hidden during tutorial */}
      {goalPickerOpen && !walkthroughActive && (
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
