"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase-client";
import { goalsApi, profileApi, tasksApi, type ParsedGoal, type GoalChatMessage, type TaskItem } from "@/lib/api-client";
import GoalTemplatesComponent from "@/components/GoalTemplates";
import SharedBuildingProgress from "@/components/BuildingProgress";
import type { GoalCategory } from "@/lib/goal-templates";

interface ChatEntry {
  role: "user" | "assistant";
  text: string;
  options?: string[];
}

export default function StartPage() {
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");

  // ── Anon session setup ──
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();

        // Already signed in (real account) — go to dashboard
        if (session?.user && !session.user.is_anonymous) {
          router.replace("/dashboard");
          return;
        }

        // Already anon — reuse session
        if (session?.user?.is_anonymous) {
          setInitializing(false);
          return;
        }

        // Create new anon session
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) {
          setError("Couldn't start session. Please refresh and try again.");
          setInitializing(false);
          return;
        }
        setInitializing(false);
      } catch {
        setError("Something went wrong. Please refresh.");
        setInitializing(false);
      }
    })();
  }, [router]);

  // ── State ──
  const [showTemplates, setShowTemplates] = useState(true);
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<GoalChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const [chatGoalText, setChatGoalText] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [nameInput, setNameInput] = useState("");
  const [awaitingName, setAwaitingName] = useState(false);
  const [pendingStarterMessage, setPendingStarterMessage] = useState<string | null>(null);

  const [building, setBuilding] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<TaskItem[]>([]);
  const [generatedGoalTitle, setGeneratedGoalTitle] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // ── Category select ──
  function handleCategorySelect(category: GoalCategory) {
    setShowTemplates(false);
    if (!nameInput.trim()) {
      setPendingStarterMessage(category.starterMessage);
      setAwaitingName(true);
      setShowAiChat(true);
      return;
    }
    startAiChatWithMessage(category.starterMessage);
  }

  function handleOther() {
    setShowTemplates(false);
    if (!nameInput.trim()) {
      setPendingStarterMessage("Help me define my goal.");
      setAwaitingName(true);
      setShowAiChat(true);
      return;
    }
    startAiChatWithMessage("Help me define my goal.");
  }

  async function handleNameSubmit() {
    if (!nameInput.trim() || !pendingStarterMessage) return;
    const trimmed = nameInput.trim();
    setAwaitingName(false);
    try {
      await getSupabase().auth.updateUser({
        data: { display_name: trimmed, full_name: trimmed },
      });
    } catch { /* ignore */ }
    startAiChatWithMessage(pendingStarterMessage);
    setPendingStarterMessage(null);
  }

  // ── AI chat ──
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
    setChatHistory((prev) => [...prev, { role: "user", text: answer }]);
    setCustomInput("");
    setSelectedOptions(new Set());
    setChatLoading(true);
    const newMessages: GoalChatMessage[] = [...chatMessages, { role: "user", content: answer }];
    setChatMessages(newMessages);
    try {
      const result = await goalsApi.chat(newMessages);
      setChatMessages((prev) => [...prev, { role: "assistant", content: result.raw_reply }]);
      setChatHistory((prev) => [...prev, { role: "assistant", text: result.message, options: result.done ? [] : result.options }]);
      if (result.name) setNameInput(result.name);
      if (result.done) {
        setChatDone(true);
        setChatGoalText(result.goal_text);
      }
    } catch {
      setChatHistory((prev) => [...prev, { role: "assistant", text: "Something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }

  // ── Build plan ──
  async function handleUseGoal() {
    if (!chatGoalText) return;
    const goalText = chatGoalText.trim();
    setShowAiChat(false);
    setBuilding(true);
    try {
      const parsed: ParsedGoal = await goalsApi.parse(goalText);
      const goalTitle = parsed.short_title ?? goalText.slice(0, 40);
      const detectedTime = parsed.daily_time_detected && parsed.daily_time_detected > 0 ? parsed.daily_time_detected : null;

      await profileApi.save({
        dailyTimeMinutes: detectedTime ?? 60,
        intensityLevel: 2,
      });

      const detectedWorkDays = (parsed.work_days_detected && parsed.work_days_detected.length > 0)
        ? parsed.work_days_detected
        : [1, 2, 3, 4, 5, 6, 7];

      const goalResult = await goalsApi.create({
        title: goalTitle.slice(0, 80),
        rawInput: goalText,
        structuredSummary: parsed.structured_summary,
        category: parsed.category,
        deadline: parsed.deadline_detected ?? null,
        dailyTimeMinutes: detectedTime ?? 60,
        intensityLevel: 2,
        workDays: detectedWorkDays,
        onboarding: true,
      });

      const tasksResult = await tasksApi.generate({ goalId: goalResult.goal.id, onboarding: true });
      const allTasks = tasksResult.dailyTasks.flatMap((dt) => dt.tasks).slice(0, 3);

      setGeneratedGoalTitle(goalTitle);
      setGeneratedTasks(allTasks);
      setBuilding(false);
      setPlanReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBuilding(false);
    }
  }

  // Auto-scroll chat
  useEffect(() => {
    const t = setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 200);
    return () => clearTimeout(t);
  }, [chatHistory, chatLoading, selectedOptions.size]);

  if (initializing) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <span className="spinner spinner-dark" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1rem" }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center", maxWidth: 400 }}>
          <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  // ── Plan Ready screen ──
  if (planReady) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "clamp(1rem, 4vw, 2rem)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ textAlign: "center" }}>
            <img src="/favicon.png" alt="Threely" width={56} height={56} style={{ borderRadius: 14, marginBottom: 16 }} />
            <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 8 }}>
              Your plan is ready
            </h1>
            <p style={{ fontSize: "0.95rem", color: "var(--subtext)", maxWidth: 480, margin: "0 auto" }}>
              Threely Intelligence built a personalized plan to get you to your goal. Here are your first 3 tasks for today.
            </p>
          </div>

          <div className="card" style={{ padding: "1.25rem 1.5rem", borderRadius: 16, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Your Goal</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{generatedGoalTitle}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {generatedTasks.map((task, i) => (
              <div key={task.id ?? i} className="card" style={{ padding: "1.25rem 1.5rem", borderRadius: 16, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.35, margin: 0 }}>
                        {(task as unknown as { title?: string }).title ?? task.task}
                      </h3>
                      {task.estimated_minutes ? (
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--subtext)", background: "var(--primary-light)", padding: "3px 8px", borderRadius: 999, flexShrink: 0 }}>
                          {task.estimated_minutes}m
                        </span>
                      ) : null}
                    </div>
                    {task.description && (
                      <p style={{ fontSize: "0.85rem", color: "var(--subtext)", lineHeight: 1.6, margin: 0 }}>
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <button
              onClick={() => router.push("/signup?from=start")}
              style={{
                height: 56, fontSize: "1rem", fontWeight: 700,
                background: "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)",
                color: "#000", borderRadius: 14, border: "none", cursor: "pointer",
              }}
            >
              Save Your Plan →
            </button>
            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>
              Free account. No credit card required.
            </p>
          </div>

          <div style={{ textAlign: "center", marginTop: 8 }}>
            <Link href="/login" style={{ fontSize: "0.85rem", color: "var(--subtext)" }}>
              Already have an account? <span style={{ color: "var(--text)", fontWeight: 600 }}>Sign in</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (building) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1rem" }}>
        <SharedBuildingProgress />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "clamp(1rem, 4vw, 2rem)" }}>
      <div style={{
        width: "100%", maxWidth: 560,
        background: "var(--card)", borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ textAlign: "center", padding: "1.75rem clamp(1rem, 5vw, 2rem) 0" }}>
          <img src="/favicon.png" alt="Threely" width={48} height={48} style={{ borderRadius: 12 }} />
        </div>

        {showTemplates && (
          <div className="fade-in" style={{ padding: "1.5rem clamp(1rem, 5vw, 2rem) 2rem" }}>
            <GoalTemplatesComponent
              onSelect={handleCategorySelect}
              onClose={() => {}}
              onOther={handleOther}
            />
          </div>
        )}
      </div>

      {showAiChat && (
        <div className="modal-overlay" onClick={() => { setShowAiChat(false); setShowTemplates(true); setAwaitingName(false); setPendingStarterMessage(null); }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", padding: 0, maxHeight: "85vh" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>Threely Intelligence</span>
              <button
                onClick={() => { setShowAiChat(false); setShowTemplates(true); setAwaitingName(false); setPendingStarterMessage(null); }}
                style={{ width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 16, color: "var(--subtext)" }}
              >×</button>
            </div>

            {awaitingName ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.25rem clamp(1rem, 4vw, 1.5rem)", gap: 12 }}>
                <div style={{ background: "var(--primary-light)", borderRadius: "14px 14px 14px 4px", padding: "0.75rem 1rem", maxWidth: "90%", fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.5 }}>
                  Hey! Before we get started — what should I call you?
                </div>
                <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                  <input
                    className="field-input"
                    placeholder="Your first name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && nameInput.trim()) handleNameSubmit(); }}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={handleNameSubmit} disabled={!nameInput.trim()} style={{ padding: "0 1.25rem", height: 46 }}>Continue</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem clamp(1rem, 4vw, 1.5rem) 2rem", display: "flex", flexDirection: "column", gap: 12 }}>
                  {chatHistory.map((entry, i) => (
                    <div key={i}>
                      {entry.role === "assistant" ? (
                        <div style={{ background: "var(--primary-light)", borderRadius: "14px 14px 14px 4px", padding: "0.75rem 1rem", maxWidth: "90%", fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.5 }}>
                          {entry.text}
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <div style={{ background: "var(--primary)", borderRadius: "14px 14px 4px 14px", padding: "0.75rem 1rem", maxWidth: "90%", fontSize: "0.9rem", color: "var(--primary-text)", lineHeight: 1.5 }}>
                            {entry.text}
                          </div>
                        </div>
                      )}

                      {entry.role === "assistant" && entry.options && entry.options.length > 0 && !chatLoading && i === chatHistory.length - 1 && !chatDone && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                                    color: isSelected ? "var(--primary-text)" : "var(--text)",
                                    fontSize: "0.85rem", fontWeight: 600,
                                    cursor: "pointer", transition: "all 0.15s",
                                  }}
                                >
                                  {isSelected ? `\u2713 ${opt}` : opt}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => chatInputRef.current?.focus()}
                              style={{
                                padding: "10px 16px", borderRadius: 20,
                                border: "1px solid var(--border)",
                                background: "var(--bg)", color: "var(--subtext)",
                                fontSize: "0.85rem", fontWeight: 600,
                                cursor: "pointer", transition: "all 0.15s",
                              }}
                            >Type my own</button>
                          </div>
                          {selectedOptions.size > 0 && (
                            <button
                              onClick={() => sendChatAnswer(Array.from(selectedOptions).join(" + "))}
                              className="btn btn-primary"
                              style={{ marginTop: 10, height: 38, width: "100%", fontSize: "0.85rem", fontWeight: 700 }}
                            >
                              Continue with {selectedOptions.size} selected →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {chatLoading && (
                    <div style={{ background: "var(--primary-light)", borderRadius: "14px 14px 14px 4px", padding: "0.75rem 1rem", maxWidth: 80, display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="spinner spinner-dark" style={{ width: 16, height: 16 }} />
                    </div>
                  )}

                  {chatDone && chatGoalText && (
                    <div style={{ background: "var(--card)", borderRadius: "var(--radius-lg)", border: "1.5px solid rgba(212,168,67,0.27)", padding: "1rem", marginTop: 8 }}>
                      <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Your Goal</p>
                      <p style={{ fontSize: "0.95rem", color: "var(--text)", marginBottom: 12, lineHeight: 1.5 }}>{chatGoalText}</p>
                      <button
                        onClick={handleUseGoal}
                        className="btn btn-primary"
                        style={{ width: "100%", height: 46, fontSize: "0.95rem", fontWeight: 700 }}
                      >
                        Build my plan →
                      </button>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {!chatDone && !chatLoading && chatHistory.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "0.75rem 1rem", display: "flex", gap: 8, flexShrink: 0 }}>
                    <input
                      ref={chatInputRef}
                      className="field-input"
                      placeholder="Type your answer..."
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && customInput.trim()) sendChatAnswer(customInput.trim()); }}
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={() => customInput.trim() && sendChatAnswer(customInput.trim())}
                      disabled={!customInput.trim()}
                      className="btn btn-primary"
                      style={{ padding: "0 1.25rem", height: 46 }}
                    >
                      Send
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
