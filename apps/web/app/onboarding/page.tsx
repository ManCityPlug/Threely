"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isOnboarded, markOnboarded, saveNickname } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase-client";
import { goalsApi, profileApi, tasksApi, type ParsedGoal, type GoalChatMessage, type GoalChatResult } from "@/lib/api-client";
import GoalTemplatesComponent from "@/components/GoalTemplates";
import type { GoalCategory } from "@/lib/goal-templates";
import { formatDisplayName } from "@/lib/format-name";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 1; // goal + AI chat (name asked in chat, config handled by AI)

// ─── Building Progress (rotating status messages) ─────────────────────────────

const BUILDING_STEPS = [
  "Analyzing your goal…",
  "Crafting your personalized roadmap…",
  "Generating 3 perfect tasks to start with…",
  "Almost there — putting the finishing touches…",
];

function BuildingProgress() {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, BUILDING_STEPS.length - 1));
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "2rem 0",
    }}>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>
        Threely Intelligence is building your plan…
      </h2>
      <p style={{ fontSize: "0.9rem", color: "#8898aa", marginBottom: 16, minHeight: 24, transition: "opacity 0.3s" }}>
        {BUILDING_STEPS[stepIdx]}
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {BUILDING_STEPS.map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: i <= stepIdx ? "#D4A843" : "rgba(255,255,255,0.15)",
            transition: "background-color 0.3s",
          }} />
        ))}
      </div>
      <span className="spinner spinner-dark" />
    </div>
  );
}

// ─── Onboarding Page ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect already-onboarded users to dashboard
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (isOnboarded(user.id)) router.replace("/dashboard");
  }, [user, loading, router]);

  const [step, setStep] = useState(1);

  // Name (asked in AI chat if not available from OAuth)
  const [nameInput, setNameInput] = useState("");
  const [awaitingName, setAwaitingName] = useState(false);
  const [pendingStarterMessage, setPendingStarterMessage] = useState<string | null>(null);

  // Goal input
  const [rawGoalInput, setRawGoalInput] = useState("");
  const [parsedGoal, setParsedGoal] = useState<ParsedGoal | null>(null);

  // Category picker
  const [showTemplates, setShowTemplates] = useState(true);

  // AI Plan chat
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; text: string; options?: string[] }>>([]);
  const [chatMessages, setChatMessages] = useState<GoalChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const [chatGoalText, setChatGoalText] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Build state
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");

  // ─── Navigation ────────────────────────────────────────────────────────────

  function advanceStep(next: number) {
    setStep(next);
  }

  // ─── Name helpers ──────────────────────────────────────────────────────────

  function getUserDisplayName(): string | null {
    if (nameInput.trim()) return nameInput.trim();
    const meta = user?.user_metadata;
    if (meta?.display_name) return meta.display_name;
    if (meta?.full_name) return meta.full_name;
    if (meta?.name) return meta.name;
    return null;
  }

  function handleNameSubmit() {
    if (!nameInput.trim() || !pendingStarterMessage) return;
    setAwaitingName(false);
    startAiChatWithMessage(pendingStarterMessage);
    setPendingStarterMessage(null);
  }

  // ─── Category selection → opens AI chat (or name input first) ──────────────

  function handleCategorySelect(category: GoalCategory) {
    const name = getUserDisplayName();
    setShowTemplates(false);
    if (!name) {
      setPendingStarterMessage(category.starterMessage);
      setAwaitingName(true);
      setShowAiChat(true);
      return;
    }
    startAiChatWithMessage(category.starterMessage);
  }

  function handleOther() {
    const name = getUserDisplayName();
    setShowTemplates(false);
    if (!name) {
      setPendingStarterMessage("Help me define my goal.");
      setAwaitingName(true);
      setShowAiChat(true);
      return;
    }
    startAiChatWithMessage("Help me define my goal.");
  }

  // ─── AI Plan chat ─────────────────────────────────────────────────────────

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
    setSelectedOptions(new Set());
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
      if (result.name) {
        setNameInput(result.name);
      }
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
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }

  function handleEditChatGoal() {
    setChatDone(false);
    setChatGoalText(null);
    sendChatAnswer("I'd like to change something about my goal.");
  }

  async function handleUseGoal() {
    if (!chatGoalText) return;
    const goalText = chatGoalText.trim();
    setRawGoalInput(goalText);
    setShowAiChat(false);
    setBuildError("");
    setBuilding(true);
    advanceStep(TOTAL_STEPS + 1);

    try {
      const result = await goalsApi.parse(goalText);
      setParsedGoal(result);

      const goalTitle = result.short_title ?? goalText.slice(0, 40);
      const detectedTime = result.daily_time_detected && result.daily_time_detected > 0
        ? result.daily_time_detected : null;

      // Save display name
      const name = formatDisplayName(
        nameInput.trim() || user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Champion"
      );
      saveNickname(name);
      getSupabase().auth.updateUser({ data: { display_name: name } }).catch(() => {});

      // Save profile
      await profileApi.save({
        dailyTimeMinutes: detectedTime ?? 60,
        intensityLevel: 2,
      });

      // Create goal with AI-parsed data + sensible defaults
      const detectedWorkDays = (result.work_days_detected && result.work_days_detected.length > 0)
        ? result.work_days_detected : [1, 2, 3, 4, 5, 6, 7];
      const goalResult = await goalsApi.create({
        title: goalTitle.slice(0, 80),
        rawInput: goalText,
        structuredSummary: result.structured_summary,
        category: result.category,
        deadline: result.deadline_detected ?? null,
        dailyTimeMinutes: detectedTime ?? 60,
        intensityLevel: 2,
        workDays: detectedWorkDays,
        onboarding: true,
      });

      // Generate tasks
      await tasksApi.generate({ goalId: goalResult.goal.id, onboarding: true });

      // Mark onboarded and go straight to dashboard
      if (user) markOnboarded(user.id);
      router.replace("/dashboard?welcome=1");
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Something went wrong");
      setBuilding(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 200);
    return () => clearTimeout(t);
  }, [chatHistory, chatLoading, selectedOptions.size]);

  // ─── Render ────────────────────────────────────────────────────────────────

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
        <div style={{ textAlign: "center", padding: "1.5rem clamp(1rem, 5vw, 2rem) 0" }}>
          <img src="/favicon.png" alt="Threely" width={44} height={44} style={{ borderRadius: 12 }} />
        </div>

        {/* ── Step 1: Goal ── */}
        {step === 1 && (
          <div className="fade-in" style={{ padding: "1.5rem clamp(1rem, 5vw, 2rem) 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {showTemplates ? (
              <GoalTemplatesComponent
                onSelect={handleCategorySelect}
                onClose={() => {}}
                onOther={handleOther}
              />
            ) : null}
          </div>
        )}

        {/* ── Magic Moment ── */}
        {isMagicMoment && (
          <div style={{ padding: "clamp(1rem, 5vw, 2rem)", flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Building state with rotating progress messages */}
            {building && !buildError && (
              <BuildingProgress />
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
                  onClick={handleUseGoal}
                  style={{ marginTop: 20, height: 46, padding: "0 2rem" }}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── AI Plan Chat Modal ── */}
      {showAiChat && (
        <div className="modal-overlay" onClick={() => { setShowAiChat(false); setShowTemplates(true); setAwaitingName(false); setPendingStarterMessage(null); }}>
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
                                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>
                  Threely Intelligence
                </span>
              </div>
              <button
                onClick={() => { setShowAiChat(false); setShowTemplates(true); setAwaitingName(false); setPendingStarterMessage(null); }}
                style={{
                  width: 40, height: 40, minHeight: 44, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg)", border: "1px solid var(--border)",
                  cursor: "pointer", fontSize: 16, color: "var(--subtext)",
                }}
              >
                ×
              </button>
            </div>

            {/* Name-asking phase */}
            {awaitingName ? (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                padding: "1.25rem clamp(1rem, 4vw, 1.5rem)",
                gap: 12,
              }}>
                <div style={{
                  background: "var(--primary-light)", borderRadius: "14px 14px 14px 4px",
                  padding: "0.75rem 1rem", maxWidth: "90%",
                  fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.5,
                }}>
                  Hey! Before we get started — what should I call you?
                </div>
                <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                  <input
                    className="field-input"
                    placeholder="Your first name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && nameInput.trim()) handleNameSubmit();
                    }}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleNameSubmit}
                    disabled={!nameInput.trim()}
                    style={{ padding: "0 16px", flexShrink: 0 }}
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Chat area */}
                <div style={{
                  flex: 1, overflowY: "auto", padding: "1.25rem clamp(1rem, 4vw, 1.5rem) 2rem",
                  display: "flex", flexDirection: "column", gap: 12,
                }}>
                  {chatHistory.map((entry, i) => (
                    <div key={i}>
                      {entry.role === "assistant" ? (
                        <div style={{
                          background: "var(--primary-light)", borderRadius: "14px 14px 14px 4px",
                          padding: "0.75rem 1rem", maxWidth: "90%",
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
                            padding: "0.75rem 1rem", maxWidth: "90%",
                            fontSize: "0.9rem", color: "#fff", lineHeight: 1.5,
                          }}>
                            {entry.text}
                          </div>
                        </div>
                      )}

                      {/* Option buttons for assistant messages — multi-select toggle */}
                      {entry.role === "assistant" && entry.options && entry.options.length > 0 && !chatLoading && i === chatHistory.length - 1 && !chatDone && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{
                            display: "flex", flexWrap: "wrap", gap: 8,
                          }}>
                            {entry.options.map((opt, j) => {
                              const isSelected = selectedOptions.has(opt);
                              return (
                                <button
                                  key={j}
                                  onClick={() => {
                                    setSelectedOptions((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(opt)) next.delete(opt);
                                      else next.add(opt);
                                      return next;
                                    });
                                  }}
                                  style={{
                                    padding: "10px 16px", borderRadius: 20,
                                    border: `1.5px solid ${isSelected ? "var(--primary)" : "rgba(212,168,67,0.25)"}`,
                                    background: isSelected ? "var(--primary)" : "var(--card)",
                                    color: isSelected ? "#fff" : "var(--primary)",
                                    fontSize: "0.85rem", fontWeight: 600,
                                    cursor: "pointer", transition: "all 0.15s",
                                  }}
                                >
                                  {isSelected ? `✓ ${opt}` : opt}
                                </button>
                              );
                            })}
                            {/* Type my own button */}
                            <button
                              onClick={() => chatInputRef.current?.focus()}
                              style={{
                                padding: "10px 16px", borderRadius: 20,
                                border: "1px solid var(--border)",
                                background: "var(--bg)", color: "var(--subtext)",
                                fontSize: "0.85rem", fontWeight: 600,
                                cursor: "pointer", transition: "all 0.15s",
                              }}
                            >
                              Type my own
                            </button>
                          </div>
                          {selectedOptions.size > 0 && (
                            <button
                              onClick={() => sendChatAnswer(Array.from(selectedOptions).join(" + "))}
                              className="btn btn-primary"
                              style={{
                                marginTop: 10, height: 38, width: "100%",
                                fontSize: "0.85rem", fontWeight: 700,
                              }}
                            >
                              Continue with {selectedOptions.size} selected →
                            </button>
                          )}
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
                      border: "1.5px solid rgba(212,168,67,0.27)", padding: "1rem",
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
                        ref={chatInputRef}
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
