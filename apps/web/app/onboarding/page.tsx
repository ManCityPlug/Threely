"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, Dumbbell, Loader2, Send, X } from "lucide-react";
import { useAuth, isOnboarded, markOnboarded, saveNickname } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase-client";
import { goalsApi, profileApi, tasksApi, type ParsedGoal, type GoalChatMessage } from "@/lib/api-client";
import SharedBuildingProgress from "@/components/BuildingProgress";
import { formatDisplayName } from "@/lib/format-name";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 font-sans text-neutral-900 antialiased">
        <div className="flex flex-col items-center">
          <SharedBuildingProgress />
          {buildError && (
            <div className="mt-5 text-center">
              <p className="mb-3 text-sm text-red-600">{buildError}</p>
              <Button variant="gold" size="lg" onClick={handleUseGoal}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8 font-sans text-neutral-900 antialiased">
      <div className="w-full max-w-xl">

        {/* ── Step 0: Category Picker ── */}
        {funnelStep === 0 && !showAiChat && (
          <div key={`fade-${fadeKey}`} className="fade-in flex flex-col gap-6">
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.png"
                alt="Threely"
                width={48}
                height={48}
                className="mx-auto mb-4 rounded-xl"
              />
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
                What do you want to achieve?
              </h1>
              <p className="mt-2 text-sm text-neutral-600 md:text-base">
                Pick a category to get started
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {([
                { id: "business" as Category, label: "Business", subtitle: "Start or grow a business", Icon: Briefcase },
                { id: "health" as Category, label: "Health", subtitle: "Transform your body", Icon: Dumbbell },
              ]).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className="flex min-h-20 flex-col justify-center rounded-lg border border-neutral-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-gold"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gold/10 text-gold">
                      <cat.Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="text-base font-semibold text-neutral-900">
                        {cat.label}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {cat.subtitle}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Steps 1-3: Funnel questions ── */}
        {funnelStep >= 1 && funnelStep <= 3 && !showAiChat && currentStepConfig && (
          <div key={`fade-${fadeKey}`} className="fade-in flex flex-col gap-6">
            {/* Back arrow */}
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>

            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.png"
                alt="Threely"
                width={48}
                height={48}
                className="mx-auto mb-4 rounded-xl"
              />
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
                {currentStepConfig.question}
              </h2>
              <div className="mt-3 flex justify-center gap-1.5">
                {[1, 2, 3].map((dot) => (
                  <div
                    key={dot}
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      dot <= funnelStep ? "bg-gold" : "bg-neutral-200"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Button options */}
            {currentStepConfig.buttons && (
              <div className="flex flex-col gap-2.5">
                {currentStepConfig.buttons.map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleButtonAnswer(btn)}
                    className="min-h-14 rounded-lg border border-neutral-200 bg-white px-5 py-3.5 text-center text-base font-semibold text-neutral-900 shadow-sm transition-colors hover:border-gold hover:text-gold"
                  >
                    {btn}
                  </button>
                ))}
              </div>
            )}

            {/* Text input */}
            {currentStepConfig.isTextInput && (
              <div className="flex flex-col gap-3">
                <input
                  placeholder={currentStepConfig.placeholder}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && textValue.trim()) handleTextSubmit(textValue.trim());
                  }}
                  autoFocus
                  className="min-h-14 w-full rounded-lg border border-neutral-200 bg-white px-5 py-3.5 text-base text-neutral-900 placeholder:text-neutral-400 shadow-sm focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
                {currentStepConfig.continueButton && (
                  <Button
                    onClick={() => textValue.trim() && handleTextSubmit(textValue.trim())}
                    disabled={!textValue.trim()}
                    variant="gold"
                    size="lg"
                    className="w-full"
                  >
                    {currentStepConfig.continueButton}
                  </Button>
                )}
                {currentStepConfig.skippable && (
                  <button
                    onClick={handleSkip}
                    className="text-sm font-medium text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
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
          <Card className="fade-in flex max-h-[80vh] flex-col overflow-hidden border-neutral-200 shadow-sm">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4">
              <span className="text-sm font-bold text-neutral-900">Threely Intelligence</span>
              <button
                onClick={() => {
                  setShowAiChat(false);
                  setCategory(null);
                  setAnswers([]);
                  animateStep(0);
                }}
                aria-label="Close chat"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Chat messages */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 md:px-6">
              {chatHistory.map((entry, i) => (
                <div key={i}>
                  {entry.role === "assistant" ? (
                    <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-3 text-sm leading-relaxed text-neutral-900">
                      {entry.text}
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="max-w-[90%] rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-3 text-sm leading-relaxed text-white">
                        {entry.text}
                      </div>
                    </div>
                  )}

                  {entry.role === "assistant" &&
                    entry.options &&
                    entry.options.length > 0 &&
                    !chatLoading &&
                    i === chatHistory.length - 1 &&
                    !chatDone && (
                      <div className="mt-2.5">
                        <div className="flex flex-wrap gap-2">
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
                                className={cn(
                                  "min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                                  isSelected
                                    ? "border-gold bg-gold text-gold-foreground"
                                    : "border-neutral-200 bg-white text-neutral-900 hover:border-gold"
                                )}
                              >
                                {isSelected ? `✓ ${opt}` : opt}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => chatInputRef.current?.focus()}
                            className="min-h-11 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-100"
                          >
                            Type my own
                          </button>
                        </div>
                        {selectedOptions.size > 0 && (
                          <Button
                            onClick={() => sendChatAnswer(Array.from(selectedOptions).join(" + "))}
                            variant="gold"
                            size="lg"
                            className="mt-2.5 w-full"
                          >
                            Continue with {selectedOptions.size} selected
                          </Button>
                        )}
                      </div>
                    )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex max-w-[80px] items-center gap-1 rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                </div>
              )}

              {chatDone && chatGoalText && (
                <div className="mt-2 rounded-lg border border-gold/30 bg-white p-4">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gold">
                    Your Goal
                  </p>
                  <p className="mb-3 text-sm leading-relaxed text-neutral-900">
                    {chatGoalText}
                  </p>
                  <Button onClick={handleUseGoal} variant="gold" size="lg" className="w-full">
                    Build my plan
                  </Button>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            {!chatDone && !chatLoading && chatHistory.length > 0 && (
              <div className="flex flex-shrink-0 gap-2 border-t border-neutral-200 px-4 py-3">
                <input
                  ref={chatInputRef}
                  placeholder="Type your answer..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customInput.trim()) sendChatAnswer(customInput.trim());
                  }}
                  className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
                <Button
                  onClick={() => customInput.trim() && sendChatAnswer(customInput.trim())}
                  disabled={!customInput.trim()}
                  variant="gold"
                  size="default"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </Card>
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
