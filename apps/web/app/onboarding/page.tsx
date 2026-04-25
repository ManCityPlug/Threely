"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isOnboarded, markOnboarded, saveNickname } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase-client";
import { goalsApi, profileApi, tasksApi, type ParsedGoal, type GoalChatMessage } from "@/lib/api-client";
import SharedBuildingProgress from "@/components/BuildingProgress";
import { formatDisplayName } from "@/lib/format-name";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "business" | "health";

interface ChatEntry {
  role: "user" | "assistant";
  text: string;
  options?: string[];
}

interface StepConfig {
  question: string;
  buttons?: string[];
  isTextInput?: boolean;
  placeholder?: string;
  skippable?: boolean;
  continueButton?: string;
}

function cleanFallbackTitle(rawInput: string): string {
  let text = rawInput.trim();
  const stripPatterns = [
    /^i\s+(want|need|would\s+like|plan|aim|intend|hope|wish)\s+to\s+/i,
    /^i'd\s+like\s+to\s+/i,
    /^i'm\s+(trying|going|planning|hoping|looking)\s+to\s+/i,
    /^my\s+goal\s+is\s+(to\s+)?/i,
    /^i\s+want\s+/i,
  ];
  for (const p of stripPatterns) text = text.replace(p, "");
  text = text.replace(/[.!?,;:\s]+$/, "").trim();
  if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text.length > 25) {
    const cut = text.slice(0, 25);
    const lastSpace = cut.lastIndexOf(" ");
    text = lastSpace > 10 ? cut.slice(0, lastSpace) : cut;
  }
  return text || "My Goal";
}

// ─── Step configurations per category ─────────────────────────────────────────

const STEPS: Record<Category, StepConfig[]> = {
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
};

function buildInitialMessage(category: Category, answers: string[]): string {
  switch (category) {
    case "business":
      return `I want to make ${answers[0]} per month. I can put in ${answers[1].toLowerCase()} work. My business idea: ${answers[2] || "no specific idea yet"}`;
    case "health":
      return `I want to ${answers[0].toLowerCase()}. I can put in ${answers[1].toLowerCase()} work. My target: ${answers[2] || "no specific target"}`;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect already-onboarded users to dashboard
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (isOnboarded(user.id)) router.replace("/dashboard");
  }, [user, loading, router]);

  // ── Funnel state ──
  const [category, setCategory] = useState<Category | null>(null);
  const [funnelStep, setFunnelStep] = useState(0); // 0 = category picker, 1-3 = steps
  const [answers, setAnswers] = useState<string[]>([]);
  const [textValue, setTextValue] = useState("");
  const [fadeKey, setFadeKey] = useState(0);

  // ── AI Chat state ──
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<GoalChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const [chatGoalText, setChatGoalText] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [nameInput, setNameInput] = useState("");

  // ── Build state ──
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──
  function animateStep(newStep: number) {
    setFadeKey((k) => k + 1);
    setFunnelStep(newStep);
  }

  function handleCategorySelect(cat: Category) {
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
      launchChat(category!, newAnswers);
    } else {
      animateStep(funnelStep + 1);
    }
  }

  function handleTextSubmit(value: string) {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);
    setTextValue("");

    if (newAnswers.length >= 3) {
      launchChat(category!, newAnswers);
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
      setAnswers((prev) => prev.slice(0, -1));
      animateStep(funnelStep - 1);
    }
  }

  // ── AI Chat launch ──
  async function launchChat(cat: Category, allAnswers: string[]) {
    const initialMessage = buildInitialMessage(cat, allAnswers);
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
      setChatHistory([{ role: "assistant", text: "Something went wrong. Please try again." }]);
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
    setBuildError("");
    setBuilding(true);

    try {
      const result: ParsedGoal = await goalsApi.parse(goalText);
      const goalTitle = result.short_title ?? cleanFallbackTitle(goalText);
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

      // Create goal
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

      // Mark onboarded and go to dashboard
      if (user) markOnboarded(user.id);
      router.replace("/dashboard?welcome=1");
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Something went wrong");
      setBuilding(false);
    }
  }

  // Auto-scroll chat
  useEffect(() => {
    const t = setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 200);
    return () => clearTimeout(t);
  }, [chatHistory, chatLoading, selectedOptions.size]);

  // ── Get current step config ──
  const currentStepConfig = category && funnelStep >= 1 && funnelStep <= 3
    ? STEPS[category][funnelStep - 1]
    : null;

  // ── Building state ──
  if (building) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <SharedBuildingProgress />
          {buildError && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: 12 }}>{buildError}</p>
              <button className="btn btn-primary" onClick={handleUseGoal} style={{ height: 46, padding: "0 2rem" }}>Try again</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "clamp(1rem, 4vw, 2rem)" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* ── Step 0: Category Picker ── */}
        {funnelStep === 0 && !showAiChat && (
          <div key={`fade-${fadeKey}`} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ textAlign: "center" }}>
              <img src="/favicon.png" alt="Threely" width={48} height={48} style={{ borderRadius: 12, marginBottom: 16 }} />
              <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 8 }}>
                What do you want to achieve?
              </h1>
              <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.85)" }}>
                Pick a category to get started
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              {([
                { id: "business" as Category, label: "💼 Business", subtitle: "Start or grow a business" },
                { id: "health" as Category, label: "💪 Health", subtitle: "Transform your body" },
              ]).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  style={{
                    padding: "1.5rem 1.25rem",
                    borderRadius: 16,
                    border: "1.5px solid var(--border)",
                    background: "var(--card)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    minHeight: 80,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
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
          </div>
        )}

        {/* ── Steps 1-3: Funnel questions ── */}
        {funnelStep >= 1 && funnelStep <= 3 && !showAiChat && currentStepConfig && (
          <div key={`fade-${fadeKey}`} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Back arrow */}
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
              <img src="/favicon.png" alt="Threely" width={48} height={48} style={{ borderRadius: 12, marginBottom: 16 }} />
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

            {/* Button options */}
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

            {/* Text input */}
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

        {/* ── AI Chat (inline) ── */}
        {showAiChat && (
          <div className="fade-in" style={{
            background: "var(--card)", borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
            maxHeight: "80vh", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", flexShrink: 0,
            }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>Threely Intelligence</span>
              <button
                onClick={() => { setShowAiChat(false); setCategory(null); setAnswers([]); animateStep(0); }}
                style={{
                  width: 40, height: 40, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg)", border: "1px solid var(--border)",
                  cursor: "pointer", fontSize: 16, color: "rgba(255,255,255,0.85)",
                }}
              >
                &times;
              </button>
            </div>

            {/* Chat messages */}
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
                                border: `1.5px solid ${isSelected ? "#D4A843" : "rgba(212,168,67,0.25)"}`,
                                background: isSelected ? "var(--primary)" : "var(--card)",
                                color: isSelected ? "var(--primary-text)" : "var(--text)",
                                fontSize: "0.85rem", fontWeight: 600,
                                cursor: "pointer", transition: "all 0.15s", minHeight: 48,
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
                            border: "1px solid var(--border)", background: "var(--bg)",
                            color: "rgba(255,255,255,0.85)", fontSize: "0.85rem", fontWeight: 600,
                            cursor: "pointer", transition: "all 0.15s", minHeight: 48,
                          }}
                        >Type my own</button>
                      </div>
                      {selectedOptions.size > 0 && (
                        <button
                          onClick={() => sendChatAnswer(Array.from(selectedOptions).join(" + "))}
                          className="btn btn-primary"
                          style={{ marginTop: 10, height: 48, width: "100%", fontSize: "0.85rem", fontWeight: 700 }}
                        >
                          Continue with {selectedOptions.size} selected
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
                    style={{ width: "100%", height: 56, fontSize: "0.95rem", fontWeight: 700 }}
                  >
                    Build my plan
                  </button>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
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
