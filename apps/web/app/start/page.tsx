"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe, type Stripe, type PaymentRequest } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  PaymentRequestButtonElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getSupabase } from "@/lib/supabase-client";
import type { TaskItem } from "@/lib/api-client";

type PlanId = "monthly" | "yearly";

const PLAN_INFO: Record<PlanId, { label: string; priceDisplay: string; subLine: string; badge?: string; priceYearly?: string }> = {
  yearly:  { label: "Yearly",  priceDisplay: "$8.33/mo",  subLine: "Billed annually", badge: "40% OFF", priceYearly: "$99.99/yr" },
  monthly: { label: "Monthly", priceDisplay: "$12.99/mo", subLine: "Billed monthly" },
};

let _stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!_stripePromise) {
    _stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return _stripePromise;
}

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
}

function getElementStyle(): Record<string, unknown> {
  return {
    base: {
      fontSize: "16px",
      color: "#e4e8ee",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#6b7280" },
    },
    invalid: { color: "#ff4d4f" },
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "business" | "daytrading" | "health" | "other";

interface StepConfig {
  question: string;
  buttons?: string[];
  isTextInput?: boolean;
  placeholder?: string;
  skippable?: boolean;
  continueButton?: string;
}

// ─── Step configurations per category ─────────────────────────────────────────

const STEPS: Record<Category, StepConfig[]> = {
  business: [
    { question: "How much do you want to make per month?", buttons: ["$500", "$1K-$5K", "$10K+"] },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Got a business idea?", isTextInput: true, placeholder: "Enter your idea...", skippable: true },
  ],
  daytrading: [
    { question: "How much do you want to make per month?", buttons: ["$500", "$1K-$5K", "$10K+"] },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Any previous experience?", isTextInput: true, placeholder: "", skippable: true },
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

function buildGoalText(category: Category, answers: string[]): string {
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

// ─── Plan Selector (Monthly | Yearly) ────────────────────────────────────────
function PlanSelector({ plan, onChange }: { plan: PlanId; onChange: (p: PlanId) => void }) {
  const renderOption = (id: PlanId) => {
    const info = PLAN_INFO[id];
    const selected = plan === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        style={{
          flex: 1,
          padding: "0.85rem 0.9rem",
          borderRadius: 12,
          border: `1.5px solid ${selected ? "#D4A843" : "rgba(255,255,255,0.1)"}`,
          background: selected ? "rgba(212,168,67,0.08)" : "rgba(255,255,255,0.02)",
          color: "var(--text)",
          cursor: "pointer",
          textAlign: "left",
          position: "relative",
          transition: "all 0.15s",
        }}
      >
        {info.badge && (
          <span style={{
            position: "absolute", top: -10, right: 10,
            background: "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)",
            color: "#000", fontSize: "0.65rem", fontWeight: 800,
            padding: "2px 8px", borderRadius: 10, letterSpacing: "0.04em",
          }}>{info.badge}</span>
        )}
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
          {info.label}
        </div>
        <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>
          {info.priceDisplay}
        </div>
        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
          {info.subLine}
        </div>
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {renderOption("yearly")}
      {renderOption("monthly")}
    </div>
  );
}

// ─── Inline payment (Apple Pay / Google Pay + card fallback) ─────────────────
// Mounts inside Stripe <Elements>. On mount, creates a SetupIntent via the
// existing /api/subscription/checkout endpoint (anon user already set up by
// outer /start flow). PaymentRequestButton handles Apple Pay + Google Pay
// detection — Stripe shows the right brand automatically. If device supports
// neither, only the "Enter card manually" form is offered.
interface InlinePaymentProps {
  plan: PlanId;
  onPlanChange: (p: PlanId) => void;
  preloadedClientSecret?: string | null;
  onSuccess: (payerEmail: string | null) => void;
}
function InlinePayment({ plan, onPlanChange, preloadedClientSecret, onSuccess }: InlinePaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState<string | null>(preloadedClientSecret ?? null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [cardNumberComplete, setCardNumberComplete] = useState(false);
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false);
  const [cardCvcComplete, setCardCvcComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initRan = useRef(false);

  const cardReady = fullName.trim().length > 0 && cardNumberComplete && cardExpiryComplete && cardCvcComplete;

  // Fetch SetupIntent once. If /start pre-fetched it during the hype screen,
  // clientSecret is already populated on first render and this effect no-ops —
  // Apple Pay's canMakePayment() fires immediately on mount instead of after
  // a round-trip to /api/subscription/checkout.
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    if (clientSecret) return; // already pre-loaded
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setError("Session expired. Please refresh."); return; }
        const res = await fetch("/api/subscription/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Failed to initialize payment");
        setClientSecret(data.clientSecret);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    })();
  }, [plan]);

  // Wire PaymentRequest (Apple Pay / Google Pay) once both stripe + secret are ready.
  useEffect(() => {
    if (!stripe || !clientSecret) return;
    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: { label: "Threely Trial", amount: 100 },
      requestPayerEmail: true,
      requestPayerName: true,
    });
    pr.canMakePayment().then((result) => {
      if (result) setPaymentRequest(pr);
    });
    pr.on("paymentmethod", async (ev) => {
      if (!stripe || !clientSecret) { ev.complete("fail"); return; }
      setSubmitting(true);
      const { error: confirmErr } = await stripe.confirmCardSetup(
        clientSecret,
        { payment_method: ev.paymentMethod.id },
        { handleActions: false },
      );
      if (confirmErr) {
        ev.complete("fail");
        setError(confirmErr.message ?? "Payment failed");
        setSubmitting(false);
        return;
      }
      ev.complete("success");
      try {
        await confirmSubscription(plan);
        onSuccess(ev.payerEmail ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Subscription failed");
      } finally {
        setSubmitting(false);
      }
    });
  }, [stripe, clientSecret, plan, onSuccess]);

  async function confirmSubscription(planId: PlanId) {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Session expired");
    const res = await fetch("/api/subscription/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan: planId }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || "Failed to create subscription");
    return data;
  }

  async function handleCardSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;
    setSubmitting(true);
    setError(null);
    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) { setError("Card element not found"); setSubmitting(false); return; }
    const { error: setupErr } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardNumber, billing_details: { name: fullName.trim() } },
    });
    if (setupErr) { setError(setupErr.message ?? "Card setup failed"); setSubmitting(false); return; }
    try {
      await confirmSubscription(plan);
      onSuccess(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 12,
    padding: "0.75rem 0.9rem", background: "rgba(255,255,255,0.02)", fontSize: "16px",
    color: "var(--text)", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PlanSelector plan={plan} onChange={onPlanChange} />

      {error && (
        <div style={{ padding: "0.6rem 0.8rem", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", fontSize: "0.82rem", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* Apple Pay / Google Pay (Stripe auto-detects the brand) */}
      {paymentRequest && (
        <div>
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: { paymentRequestButton: { theme: "dark", height: "52px", type: "default" } },
            }}
          />
        </div>
      )}

      {/* Enter card manually — collapsible */}
      <button
        type="button"
        onClick={() => setCardOpen((o) => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.75)", fontSize: "0.9rem", fontWeight: 600,
          padding: "6px 0",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        Enter card manually
        <span style={{ transition: "transform 0.2s", transform: cardOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>

      {cardOpen && (
        <form onSubmit={handleCardSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
            placeholder="Name on card" autoComplete="cc-name" style={inputStyle}
          />
          <div style={{ ...inputStyle, padding: "0.85rem 0.9rem" }}>
            <CardNumberElement options={{ style: getElementStyle(), showIcon: true }}
              onChange={(e) => setCardNumberComplete(e.complete)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ ...inputStyle, padding: "0.85rem 0.9rem" }}>
              <CardExpiryElement options={{ style: getElementStyle() }}
                onChange={(e) => setCardExpiryComplete(e.complete)} />
            </div>
            <div style={{ ...inputStyle, padding: "0.85rem 0.9rem" }}>
              <CardCvcElement options={{ style: getElementStyle() }}
                onChange={(e) => setCardCvcComplete(e.complete)} />
            </div>
          </div>
          <button
            type="submit"
            disabled={!cardReady || submitting || !clientSecret}
            style={{
              height: 54, fontSize: "1rem", fontWeight: 700,
              background: cardReady && !submitting
                ? "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)"
                : "rgba(255,255,255,0.08)",
              color: cardReady && !submitting ? "#000" : "rgba(255,255,255,0.5)",
              borderRadius: 14, border: "none",
              cursor: cardReady && !submitting ? "pointer" : "default",
            }}
          >
            {submitting ? "Processing…" : "Start For $1 →"}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Account finalize — shown after payment succeeds ─────────────────────────
// Converts the anonymous Supabase user into a real one. If Apple Pay / Google
// Pay returned a payer email we pre-fill it and only ask for a password.
// Otherwise the full email + password form is shown.
function AccountFinalize({ preFilledEmail }: { preFilledEmail: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(preFilledEmail ?? "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setError("Enter a valid email."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: updErr } = await supabase.auth.updateUser({ email, password });
      if (updErr) {
        if (updErr.message?.toLowerCase().includes("already")) {
          throw new Error("An account with this email already exists. Please sign in.");
        }
        throw new Error(updErr.message ?? "Couldn't create account");
      }
      router.replace("/dashboard?subscribed=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 12,
    padding: "0.85rem 0.95rem", background: "rgba(255,255,255,0.02)", fontSize: "16px",
    color: "var(--text)", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{"\u2728"}</div>
        <h1 style={{ fontSize: "clamp(1.4rem, 4vw, 1.75rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 6 }}>
          {preFilledEmail ? "One last step" : "Create your account"}
        </h1>
        <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
          {preFilledEmail ? "Set a password so you can log back in." : "Save your plan with an email and password."}
        </p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!preFilledEmail && (
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" autoComplete="email" required style={inputStyle}
          />
        )}
        {preFilledEmail && (
          <div style={{ ...inputStyle, color: "rgba(255,255,255,0.65)", fontSize: "0.9rem" }}>
            {preFilledEmail}
          </div>
        )}
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (8+ characters)" autoComplete="new-password" required style={inputStyle}
        />
        {error && (
          <div style={{ padding: "0.6rem 0.8rem", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", fontSize: "0.82rem", color: "#fca5a5" }}>
            {error}
          </div>
        )}
        <button
          type="submit" disabled={submitting}
          style={{
            height: 54, fontSize: "1rem", fontWeight: 700,
            background: submitting ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)",
            color: submitting ? "rgba(255,255,255,0.5)" : "#000",
            borderRadius: 14, border: "none", cursor: submitting ? "default" : "pointer", marginTop: 4,
          }}
        >
          {submitting ? "Creating account…" : "Finish →"}
        </button>
      </form>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

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

        if (session?.user && !session.user.is_anonymous) {
          router.replace("/dashboard");
          return;
        }

        if (session?.user?.is_anonymous) {
          setInitializing(false);
          return;
        }

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

  // ── Funnel state ──
  const [category, setCategory] = useState<Category | null>(null);
  const [funnelStep, setFunnelStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [textValue, setTextValue] = useState("");
  const [fadeKey, setFadeKey] = useState(0);

  // ── Hype + preview state ──
  const [showHype, setShowHype] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [generatedGoalTitle, setGeneratedGoalTitle] = useState("");

  // ── Pre-fetch for fast Apple Pay ──────────────────────────────────────────
  // Stripe.js is ~100KB and canMakePayment() is async. If we only start
  // loading them when the plan-ready screen renders, users see a "Pay" button
  // pop in late. Fix: kick off Stripe.js as soon as /start mounts, and
  // pre-fetch the SetupIntent the moment the funnel is done (during the hype
  // screen). By the time user clicks "Show me my plan", Apple Pay is already
  // primed and renders instantly.
  const [preloadedClientSecret, setPreloadedClientSecret] = useState<string | null>(null);
  useEffect(() => { getStripePromise(); }, []);
  useEffect(() => {
    if (!showHype || preloadedClientSecret) return;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch("/api/subscription/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan: "yearly" }),
        });
        const data = await safeJson(res);
        if (res.ok && data.clientSecret) setPreloadedClientSecret(data.clientSecret);
      } catch { /* swallow — InlinePayment will fetch on its own if prefetch fails */ }
    })();
  }, [showHype, preloadedClientSecret]);

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
      setAnswers((prev) => prev.slice(0, -1));
      animateStep(funnelStep - 1);
    }
  }

  // ── Show hype + blurred preview (NO plan building yet) ──
  function startBuild(cat: Category, allAnswers: string[]) {
    const goalText = buildGoalText(cat, allAnswers);
    // Store goal info for later (after checkout + signup)
    // Create an aspirational display title
    const title = cat === "business"
      ? `Making ${allAnswers[0] === "$500" ? "$500" : allAnswers[0] === "$1K-$5K" ? "$5,000" : "$10,000"}/Month`
      : cat === "daytrading"
        ? `Day Trading to ${allAnswers[0] === "$500" ? "$500" : allAnswers[0] === "$1K-$5K" ? "$5,000" : "$10,000"}/Month`
        : cat === "health"
          ? allAnswers[0] === "Lose weight" ? "Losing Weight"
            : allAnswers[0] === "Glow up" ? "Glow Up"
            : allAnswers[0] === "Gain more muscle" ? "Building Muscle"
            : allAnswers[0]
          : allAnswers[0]?.slice(0, 40) || "Your Goal";

    try {
      localStorage.setItem("threely_pending_goal", JSON.stringify({
        category: cat,
        answers: allAnswers,
        goalText,
        displayTitle: title,
      }));
    } catch { /* ignore */ }

    setGeneratedGoalTitle(title);
    setShowHype(true);
  }

  function handleHypeContinue() {
    setPlanReady(true);
    setShowHype(false);
  }

  // ── Loading state ──
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

  // ── Plan Ready screen (payment + post-payment account creation) ──
  if (planReady) {
    return (
      <Elements stripe={getStripePromise()}>
        <PlanReadyScreen
          category={category}
          generatedGoalTitle={generatedGoalTitle}
          preloadedClientSecret={preloadedClientSecret}
        />
      </Elements>
    );
  }

  // ── Hype screen ──
  if (showHype) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "clamp(1rem, 4vw, 2rem)" }}>
        <div className="fade-in" style={{ width: "100%", maxWidth: 480, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ fontSize: 64, lineHeight: 1 }}>🔥</div>
          <h1 style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.15 }}>
            You're the perfect fit.
          </h1>
          <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.6, maxWidth: 400 }}>
            Threely is building your personalized plan right now. This is going to change everything.
          </p>
          <button
            onClick={handleHypeContinue}
            style={{
              height: 56, fontSize: "1rem", fontWeight: 700, width: "100%", maxWidth: 320,
              background: "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)",
              color: "#000", borderRadius: 14, border: "none", cursor: "pointer",
              marginTop: 8,
            }}
          >
            Show me my plan →
          </button>
        </div>
      </div>
    );
  }

  // ── Get current step config ──
  const currentStepConfig = category && funnelStep >= 1 && funnelStep <= 3
    ? STEPS[category][funnelStep - 1]
    : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "clamp(1rem, 4vw, 2rem)" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* ── Step 0: Category Picker ── */}
        {funnelStep === 0 && (
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
                { id: "daytrading" as Category, label: "📈 Day Trading", subtitle: "Grow a trading account" },
                { id: "business" as Category, label: "🤑 Business", subtitle: "Start or grow a business" },
                { id: "health" as Category, label: "💪 Health", subtitle: "Transform your body" },
                { id: "other" as Category, label: "Other", subtitle: "Set any goal" },
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
          </div>
        )}

        {/* ── Steps 1-3: Funnel questions ── */}
        {funnelStep >= 1 && funnelStep <= 3 && currentStepConfig && (
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
                  // No autoFocus — user should see Skip before being forced
                  // into the keyboard. Safari autofill / password-manager
                  // hints (^v✓) happen when autoComplete is unset; we
                  // explicitly opt out of all of them so the box just holds
                  // the user's typed text.
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

// ─── Plan Ready screen (wrapped in Elements by parent) ───────────────────────
// Shows: goal card → blurred preview → plan selector → Apple/Google Pay +
// card fallback → on success, swaps to AccountFinalize for email/password.
function PlanReadyScreen({ category, generatedGoalTitle, preloadedClientSecret }: { category: Category | null; generatedGoalTitle: string; preloadedClientSecret: string | null }) {
  const [plan, setPlan] = useState<PlanId>("yearly");
  const [paymentDone, setPaymentDone] = useState(false);
  const [payerEmail, setPayerEmail] = useState<string | null>(null);

  const SAMPLE_TASKS: Record<Category, string> = {
    business:   "Write down 3 things you're already good at",
    daytrading: "Open a free paper trading account (Webull or Thinkorswim)",
    health:     "Take a Day 1 photo and save it on your phone",
    other:      "Google one person who's done what you want and save their name",
  };
  const BLURRED_PLACEHOLDERS = [
    "Your next personalized step, made for your goal",
    "A simple action to build momentum today",
  ];
  const visibleTask = category ? SAMPLE_TASKS[category] : SAMPLE_TASKS.other;

  if (paymentDone) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "clamp(1rem, 4vw, 2rem)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AccountFinalize preFilledEmail={payerEmail} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "clamp(1rem, 4vw, 2rem)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ textAlign: "center" }}>
          <img src="/favicon.png" alt="Threely" width={56} height={56} style={{ borderRadius: 14, marginBottom: 16 }} />
          <h1 style={{ fontSize: "clamp(1.4rem, 4vw, 1.85rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 0 }}>
            Your plan is ready
          </h1>
        </div>

        <div className="card" style={{ padding: "1.1rem 1.25rem", borderRadius: 16, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Your Goal</div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{generatedGoalTitle}</div>
        </div>

        {/* Plan preview — 1 task visible + 2 blurred */}
        <div style={{ position: "relative" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: "0.72rem", color: "rgba(255,255,255,0.55)",
            marginBottom: 8, padding: "0 4px",
          }}>
            <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Day 1</span>
            <span>~15 min total</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="card" style={{ padding: "0.9rem 1.1rem", borderRadius: 14, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(212,168,67,0.5)", flexShrink: 0 }} />
              <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.35, flex: 1, minWidth: 0 }}>
                {visibleTask}
              </div>
            </div>
            <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {BLURRED_PLACEHOLDERS.map((placeholder, i) => (
                <div key={i} className="card" style={{ padding: "0.9rem 1.1rem", borderRadius: 14, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(212,168,67,0.5)", flexShrink: 0 }} />
                  <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.35, flex: 1, minWidth: 0 }}>
                    {placeholder}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            height: "65%",
            background: "linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.6) 55%, rgba(10,10,10,0.95) 100%)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            paddingBottom: 12, borderRadius: 14, pointerEvents: "none",
          }}>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.95)", margin: 0 }}>
              Start for $1 to unlock your plan
            </p>
          </div>
        </div>

        {/* Inline payment — plan selector + Apple/Google Pay + card fallback */}
        <InlinePayment
          plan={plan}
          onPlanChange={setPlan}
          preloadedClientSecret={preloadedClientSecret}
          onSuccess={(email) => { setPayerEmail(email); setPaymentDone(true); }}
        />

        <p style={{ textAlign: "center", fontSize: "0.78rem", color: "rgba(255,255,255,0.75)" }}>
          Cancel anytime.
        </p>
        <div style={{ textAlign: "center" }}>
          <Link href="/login" style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.85)" }}>
            Already have an account? <span style={{ color: "var(--text)", fontWeight: 600 }}>Sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
