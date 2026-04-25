"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
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

// Threely Pro — single public plan. $1 for 3-day Launch Preview, then $39/mo.
// Legacy yearly entry preserved so typed PlanId lookups from older callers
// (e.g. subscription checkout route) still resolve; both now surface $39/mo
// to the UI, so a legacy `plan=yearly` param no longer shows a discount.
const PLAN_INFO: Record<PlanId, { label: string; priceDisplay: string; subLine: string; badge?: string; priceYearly?: string }> = {
  monthly: { label: "Threely Pro", priceDisplay: "$39/mo", subLine: "After your $1 Launch Preview" },
  yearly:  { label: "Threely Pro", priceDisplay: "$39/mo", subLine: "After your $1 Launch Preview" },
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

type Category = "business" | "daytrading" | "health";

interface PathOption {
  label: string;
  path: string;
  description?: string;
}

interface StepConfig {
  question: string;
  buttons: PathOption[];
}

// Step order per category (all MC, no free text):
//   step 1 = path pick (sub-question)
//   step 2 = income target (business/daytrading only — skipped for health)
//   step 3 = effort level
// New order everywhere: goal/target first, effort second, path last.
// Business/daytrading: income → effort → path-pick
// Health:              path-pick → effort → outcome-multi-select
const STEPS: Record<Category, StepConfig[]> = {
  business: [
    // Threely Pro quiz (Meta cold traffic → $1 Launch Preview → $39/mo).
    // Q1 selects the library path; other answers drive add-on recommendations
    // on the paywall (Double Creative Pack, AI UGC Pack, Growth Monitor).
    {
      question: "What do you want to launch?",
      buttons: [
        { label: "Online store", path: "business_ecommerce" },
        { label: "Product brand", path: "business_ecommerce" },
        { label: "Digital product", path: "business_content" },
        { label: "Not sure yet", path: "business_ecommerce" },
      ],
    },
    {
      question: "Do you already have a product?",
      buttons: [
        { label: "Yes, I have one", path: "" },
        { label: "I have ideas", path: "" },
        { label: "No — choose one for me", path: "" },
      ],
    },
    {
      question: "Do you want us to set up your Shopify store?",
      buttons: [
        { label: "Yes, set it up for me", path: "" },
        { label: "Show me the steps", path: "" },
        { label: "Not sure yet", path: "" },
      ],
    },
    {
      question: "How many ad creatives do you want each week?",
      buttons: [
        { label: "Standard weekly drop", path: "" },
        { label: "Double creative drop", path: "" },
        { label: "I want the most possible", path: "" },
      ],
    },
    {
      question: "Do you want AI UGC-style video ads?",
      buttons: [
        { label: "Yes, add UGC videos", path: "" },
        { label: "Maybe later", path: "" },
        { label: "No — static ads only", path: "" },
      ],
    },
    {
      question: "How much help do you want after launch?",
      buttons: [
        { label: "Just give me the dashboard", path: "" },
        { label: "Give me weekly guidance", path: "" },
        { label: "Help monitor what to improve", path: "" },
      ],
    },
  ],
  daytrading: [
    {
      question: "How much do you want to make a month?",
      buttons: [
        { label: "$500", path: "" },
        { label: "$1K-$5K", path: "" },
        { label: "$10K+", path: "" },
      ],
    },
    {
      question: "How hard do you want to work?",
      buttons: [
        { label: "Easy", path: "" },
        { label: "Medium", path: "" },
        { label: "Hard", path: "" },
      ],
    },
    {
      question: "Have you traded before?",
      buttons: [
        { label: "Never traded", path: "daytrading_beginner" },
        { label: "I've traded before", path: "daytrading_experienced" },
      ],
    },
  ],
  health: [
    {
      question: "Which one?",
      buttons: [
        { label: "Lose weight", path: "health_weight_loss" },
        { label: "Glow up", path: "health_general" },
        { label: "Build muscle", path: "health_muscle" },
      ],
    },
    {
      question: "How hard do you want to work?",
      buttons: [
        { label: "Easy", path: "" },
        { label: "Medium", path: "" },
        { label: "Hard", path: "" },
      ],
    },
    // step 3 is multi-select — rendered from HEALTH_OUTCOME, not STEPS
  ],
};

// Multi-select "what does reaching this goal look like" shown only for health,
// right after the path pick. 4 options per path, picked for psychological
// weight — the real reasons people actually chase these goals. Stored on the
// goal for context only — does not influence path routing or task content.
const HEALTH_OUTCOME: Record<string, { question: string; options: string[] }> = {
  health_weight_loss: {
    question: "What do you want most?",
    options: [
      "Look my best",
      "Get my dream body",
      "More confidence",
      "Have more energy",
    ],
  },
  health_general: {
    question: "What do you want most?",
    options: [
      "Reach my max potential",
      "Get more compliments",
      "Upgrade my style",
      "Be more attractive",
    ],
  },
  health_muscle: {
    question: "What do you want most?",
    options: [
      "Build my dream body",
      "Look jacked",
      "Be more athletic",
      "Get noticeably bigger",
    ],
  },
};

// Sample task shown on the paywall preview — picked by the user's selected
// path (not just category) so it feels personal. Matches the "day trading
// paper account" energy: concrete, real, immediately actionable.
const PATH_SAMPLE_TASK: Record<string, string> = {
  daytrading_beginner:      "Open a free paper trading account (Webull or Thinkorswim)",
  daytrading_experienced:   "Open your brokerage and screenshot your last trade",
  business_passive:         "Write down 3 things people would pay to learn from you",
  business_ecommerce:       "Write down 3 things you'd personally buy online",
  business_content:         "Pick one platform — TikTok, IG, or YouTube",
  business_money:           "Write down 3 things you'd personally buy online",
  health_weight_loss:       "Download MyFitnessPal and log your breakfast",
  health_general:           "Screenshot 3 looks you want to copy",
  health_muscle:            "Download Hevy or Strong to track your workouts",
};

function buildGoalTitle(category: Category, path: string, incomeOrAnswer: string): string {
  switch (category) {
    case "business":
      if (path === "business_passive") return incomeOrAnswer ? `Build Passive Income → ${incomeOrAnswer}/Month` : "Build Passive Income";
      if (path === "business_ecommerce") return incomeOrAnswer ? `Make ${incomeOrAnswer}/Month (Ecommerce)` : "Start an Ecommerce Brand";
      if (path === "business_content") return incomeOrAnswer ? `Build My Brand → ${incomeOrAnswer}/Month` : "Build a Personal Brand";
      if (path === "business_money") return incomeOrAnswer ? `Make ${incomeOrAnswer}/Month` : "Make Money";
      return incomeOrAnswer ? `Make ${incomeOrAnswer}/Month` : "Start a Business";
    case "daytrading":
      if (path === "daytrading_beginner") return incomeOrAnswer ? `Learn Day Trading → ${incomeOrAnswer}/Month` : "Learn to Day Trade";
      if (path === "daytrading_experienced") return incomeOrAnswer ? `Day Trading → ${incomeOrAnswer}/Month` : "Day Trade With Discipline";
      return "Day Trading";
    case "health":
      if (path === "health_weight_loss") return "Lose Weight";
      if (path === "health_muscle") return "Build Muscle";
      if (path === "health_general") return "Glow Up";
      return "Health Goal";
  }
}

const EFFORT_TO_MINUTES: Record<string, number> = {
  easy: 30,
  medium: 60,
  hard: 120,
};

const EFFORT_TO_INTENSITY: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
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
          padding: "0.5rem 0.7rem",
          borderRadius: 10,
          border: `1.5px solid ${selected ? "#D4A843" : "rgba(255,255,255,0.1)"}`,
          background: selected ? "rgba(212,168,67,0.08)" : "rgba(255,255,255,0.02)",
          color: "var(--text)",
          cursor: "pointer",
          textAlign: "center",
          position: "relative",
          transition: "all 0.15s",
          fontSize: "0.8rem",
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {info.badge && (
          <span style={{
            position: "absolute", top: -8, right: 8,
            background: "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)",
            color: "#000", fontSize: "0.58rem", fontWeight: 800,
            padding: "1.5px 6px", borderRadius: 8, letterSpacing: "0.04em",
          }}>{info.badge}</span>
        )}
        {info.label}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {renderOption("yearly")}
      {renderOption("monthly")}
    </div>
  );
}

// ─── PaymentRequestPrimer ────────────────────────────────────────────────────
// Mounts during the hype screen. Creates the Stripe paymentRequest, runs
// canMakePayment(), and hands the ready PR up to StartPage. By the time the
// user clicks "Show me my plan", InlinePayment just receives the already-
// primed object and attaches its paymentmethod handler — no 1s delay while
// Stripe.js loads + canMakePayment() resolves.
function PaymentRequestPrimer({ clientSecret, onReady }: { clientSecret: string; onReady: (pr: PaymentRequest) => void }) {
  const stripe = useStripe();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    if (!stripe || !clientSecret) return;
    ran.current = true;
    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: { label: "Threely Trial", amount: 100 },
      requestPayerEmail: true,
      requestPayerName: true,
    });
    pr.canMakePayment().then((result) => {
      if (result) onReady(pr);
    });
  }, [stripe, clientSecret, onReady]);
  return null;
}

// ─── Inline payment (Apple Pay / Google Pay + card fallback) ─────────────────
// Mounts inside Stripe <Elements>. Optionally receives a primedPaymentRequest
// created during the hype screen — when present, Apple Pay renders instantly
// instead of waiting for Stripe.js + canMakePayment() to finish.
interface InlinePaymentProps {
  plan: PlanId;
  preloadedClientSecret?: string | null;
  primedPaymentRequest?: PaymentRequest | null;
  onSuccess: (payerEmail: string | null) => void;
}
function InlinePayment({ plan, preloadedClientSecret, primedPaymentRequest, onSuccess }: InlinePaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState<string | null>(preloadedClientSecret ?? null);
  // Seed with the primed PR so the Apple Pay button renders on first paint
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(primedPaymentRequest ?? null);
  const handlerAttached = useRef(false);
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

  // Wire PaymentRequest (Apple Pay / Google Pay). If StartPage primed it
  // during the hype screen, we just attach the paymentmethod handler.
  // Otherwise we create the PR here as a fallback.
  useEffect(() => {
    if (!stripe || !clientSecret) return;
    if (handlerAttached.current) return;

    const pr = paymentRequest ?? stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: { label: "Threely Trial", amount: 100 },
      requestPayerEmail: true,
      requestPayerName: true,
    });

    // If we created a fresh PR (no primed one), we still need the canMakePayment check
    if (!paymentRequest) {
      pr.canMakePayment().then((result) => {
        if (result) setPaymentRequest(pr);
      });
    }

    handlerAttached.current = true;
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
  }, [stripe, clientSecret, plan, onSuccess, paymentRequest]);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div style={{ padding: "0.6rem 0.8rem", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", fontSize: "0.82rem", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* Apple Pay / Google Pay — primary CTA. Stripe auto-detects brand.
          Height 56px to match the typography hierarchy (headline/CTA). */}
      {paymentRequest && (
        <div className="pr-button-wrap">
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: { paymentRequestButton: { theme: "dark", height: "56px", type: "default" } },
            }}
          />
        </div>
      )}

      {/* Card — secondary option */}
      <button
        type="button"
        onClick={() => setCardOpen((o) => !o)}
        className="press-scale"
        style={{
          height: 52,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          cursor: "pointer",
          color: "var(--text)",
          fontSize: "0.95rem",
          fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "background 0.15s",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
        Continue with card
        <span style={{ transition: "transform 0.2s", transform: cardOpen ? "rotate(180deg)" : "rotate(0deg)", opacity: 0.6, marginLeft: 2 }}>▾</span>
      </button>

      {cardOpen && (
        <form onSubmit={handleCardSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }} className="fade-in-fast">
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
            className="press-scale"
            style={{
              height: 54, fontSize: "1rem", fontWeight: 700,
              background: cardReady && !submitting
                ? "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)"
                : "rgba(255,255,255,0.08)",
              color: cardReady && !submitting ? "#000" : "rgba(255,255,255,0.5)",
              borderRadius: 14, border: "none",
              cursor: cardReady && !submitting ? "pointer" : "default",
              transition: "all 0.15s",
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
  // When the email is already registered, flip the form into sign-in mode
  // instead of throwing. The just-paid $1 still attaches to their account.
  const [signInMode, setSignInMode] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setError("Enter a valid email."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getSupabase();
      if (signInMode) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw new Error("Wrong password. Try again.");
        try { localStorage.removeItem("threely_start_state"); } catch { /* ignore */ }
        router.replace("/dashboard?subscribed=1");
        return;
      }
      const { error: updErr } = await supabase.auth.updateUser({ email, password });
      if (updErr) {
        if (updErr.message?.toLowerCase().includes("already")) {
          // Try signing into the existing account with the password they just typed
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (!signInErr) {
            try { localStorage.removeItem("threely_start_state"); } catch { /* ignore */ }
        router.replace("/dashboard?subscribed=1");
            return;
          }
          // Password didn't match — flip to sign-in mode and ask for existing password
          setSignInMode(true);
          setPassword("");
          setError("This email already has an account. Enter your existing password to log in.");
          setSubmitting(false);
          return;
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
          {signInMode ? "Welcome back" : preFilledEmail ? "One last step" : "Create your account"}
        </h1>
        <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
          {signInMode ? "Sign in to attach your new plan to your existing account." : preFilledEmail ? "Set a password so you can log back in." : "Save your plan with an email and password."}
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
          placeholder={signInMode ? "Your existing password" : "Password (8+ characters)"}
          autoComplete={signInMode ? "current-password" : "new-password"} required style={inputStyle}
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
          {submitting ? (signInMode ? "Signing in…" : "Creating account…") : (signInMode ? "Sign in →" : "Finish →")}
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
  const [selectedPath, setSelectedPath] = useState<string>("");
  // Health-only multi-select: "what does reaching this goal look like?"
  // Stored for context, does NOT affect path routing or task content.
  const [healthOutcome, setHealthOutcome] = useState<string[]>([]);
  const [fadeKey, setFadeKey] = useState(0);

  // ── Hype + preview state ──
  // Flow: funnel → building (3s animated pre-roll) → hype (perfect fit) → planReady.
  // Building is pure theatre — no real work happens here, but the pause +
  // visual motion makes the plan feel crafted rather than conjured.
  const [showBuilding, setShowBuilding] = useState(false);
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
  // Primed during the hype screen so Apple Pay renders instantly on plan-ready
  const [primedPaymentRequest, setPrimedPaymentRequest] = useState<PaymentRequest | null>(null);
  useEffect(() => { getStripePromise(); }, []);

  // Hide Crisp live chat while the user is in the /start flow. Previously we
  // only called $crisp.push(['do', 'chat:hide']) which raced with the Crisp
  // SDK load on refresh — the widget would pop in briefly before we told it
  // to hide. Now we inject a <style> element that force-hides Crisp's DOM
  // regardless of when it loads. Belt-and-suspenders: also push the API
  // command for good measure.
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "threely-hide-crisp";
    style.textContent = `
      #crisp-chatbox,
      .crisp-client,
      [data-crisp-chatbox] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    const w = window as unknown as { $crisp?: unknown[] };
    if (w.$crisp) w.$crisp.push(["do", "chat:hide"]);
    return () => {
      document.getElementById("threely-hide-crisp")?.remove();
      const w2 = window as unknown as { $crisp?: unknown[] };
      if (w2.$crisp) w2.$crisp.push(["do", "chat:show"]);
    };
  }, []);

  // Refresh persistence: write funnel state to localStorage on change, read
  // on mount. Lets a user reload /start and land exactly where they left off
  // instead of restarting the flow. Expires after 24h.
  const STATE_KEY = "threely_start_state";
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || Date.now() - (saved.savedAt ?? 0) > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STATE_KEY);
        return;
      }
      if (saved.category) setCategory(saved.category);
      if (typeof saved.funnelStep === "number") setFunnelStep(saved.funnelStep);
      if (Array.isArray(saved.answers)) setAnswers(saved.answers);
      if (saved.selectedPath) setSelectedPath(saved.selectedPath);
      if (Array.isArray(saved.healthOutcome)) setHealthOutcome(saved.healthOutcome);
      // Refresh mid-build is treated as "funnel done" — skip straight to the
      // hype screen instead of replaying the 3s animation on every reload.
      if (saved.showBuilding || saved.showHype) setShowHype(true);
      if (saved.planReady) setPlanReady(true);
      if (saved.generatedGoalTitle) setGeneratedGoalTitle(saved.generatedGoalTitle);
    } catch { /* ignore — bad JSON means start fresh */ }
  }, []);
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        category, funnelStep, answers, selectedPath,
        healthOutcome, showBuilding, showHype, planReady, generatedGoalTitle,
        savedAt: Date.now(),
      }));
    } catch { /* ignore */ }
  }, [category, funnelStep, answers, selectedPath, healthOutcome, showBuilding, showHype, planReady, generatedGoalTitle]);

  // Auto-advance past the legacy category picker. Threely now sells only the
  // business-launch path, so the old 3-card picker is skipped for cold
  // traffic. Fires ONCE on mount (or immediately after state restore); we
  // intentionally don't re-fire if the user navigates back past step 1 —
  // that's handled by sending them to "/" via the popstate handler.
  const autoAdvancedRef = useRef(false);
  useEffect(() => {
    if (!restoredRef.current || autoAdvancedRef.current) return;
    autoAdvancedRef.current = true;
    if (!category && funnelStep === 0 && !showBuilding && !showHype && !planReady) {
      setCategory("business");
      setFunnelStep(1);
    }
  }, [category, funnelStep, showBuilding, showHype, planReady]);

  // Browser back-navigation:
  //   - From plan-ready / hype  → reset to category picker (step 0)
  //   - From mid-funnel (1-3)   → go back one step
  //   - From category picker    → default (home /)
  // Refresh preserves state (via localStorage above); only an explicit back
  // gesture resets. We intercept popstate and push a replacement entry so
  // the user stays on /start unless they're at step 0.
  useEffect(() => {
    // Seed the history stack with a dummy entry so the first back gesture
    // lands in our popstate handler instead of leaving the page.
    if (typeof window !== "undefined") {
      window.history.pushState({ threely: "start" }, "", window.location.pathname);
    }
    const onPop = () => {
      if (planReady || showHype || showBuilding) {
        // Back from the plan/hype/building screens: reset the quiz completely
        // and kick the user back to step 1 (category picker is auto-skipped).
        setPlanReady(false);
        setShowHype(false);
        setShowBuilding(false);
        setAnswers([]);
        setSelectedPath("");
        setHealthOutcome([]);
        setGeneratedGoalTitle("");
        setCategory("business");
        setFunnelStep(1);
        window.history.pushState({ threely: "start" }, "", window.location.pathname);
        return;
      }
      if (funnelStep > 1) {
        setAnswers((prev) => prev.slice(0, -1));
        setFunnelStep((prev) => prev - 1);
        window.history.pushState({ threely: "start" }, "", window.location.pathname);
        return;
      }
      // At step 0 or 1 — category picker is gone, leave /start.
      window.location.href = "/";
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [planReady, showHype, showBuilding, funnelStep]);
  useEffect(() => {
    // Prefetch starts the moment the 3s building animation begins so the
    // SetupIntent is already primed by the time the user sees Apple Pay.
    if ((!showHype && !showBuilding) || preloadedClientSecret) return;
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
  }, [showHype, showBuilding, preloadedClientSecret]);

  // ── Helpers ──
  function animateStep(newStep: number) {
    setFadeKey((k) => k + 1);
    setFunnelStep(newStep);
  }

  function handleCategorySelect(cat: Category) {
    setCategory(cat);
    setAnswers([]);
    setSelectedPath("");
    setHealthOutcome([]);
    animateStep(1);
  }

  // Universal flow (all categories land here after 3 answers):
  //   - business/daytrading: step 1 = income, step 2 = effort, step 3 = path
  //   - health:              step 1 = path,   step 2 = effort, step 3 = multi
  // For biz/dt the path is captured on step 3 here. For health the path is
  // captured on step 1 (selectedPath set early), and the terminal action is
  // handleHealthOutcomeContinue below.
  function handleButtonAnswer(answer: string, path?: string) {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    const nextPath = path || selectedPath;
    if (path) setSelectedPath(path);

    // Business quiz has 5 steps; legacy daytrading/health retain 3.
    const threshold = category === "business" ? STEPS.business.length : 3;
    if (newAnswers.length >= threshold) {
      startBuild(category!, newAnswers, nextPath);
    } else {
      animateStep(funnelStep + 1);
    }
  }

  function handleHealthOutcomeContinue() {
    if (healthOutcome.length === 0) return;
    // Health multi-select is the final step — go straight to build
    const newAnswers = [...answers, healthOutcome.join(", ")];
    setAnswers(newAnswers);
    startBuild(category!, newAnswers, selectedPath);
  }

  function toggleHealthOutcome(opt: string) {
    setHealthOutcome((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  }

  function handleBack() {
    if (funnelStep === 1) {
      // Step 1 is now effectively the first screen (category picker is
      // auto-skipped). Back from here leaves /start entirely.
      if (typeof window !== "undefined") window.location.href = "/";
      return;
    }
    if (funnelStep > 1) {
      setAnswers((prev) => prev.slice(0, -1));
      animateStep(funnelStep - 1);
    }
  }

  // ── Show hype + blurred preview (NO plan building yet) ──
  function startBuild(cat: Category, allAnswers: string[], path: string) {
    // Answer layouts:
    //   business (new 5-q quiz): [whatToBuild, productStatus, helpLevel, seriousness, launchTiming]
    //   daytrading (legacy):     [income, effort, path-label]
    //   health     (legacy):     [path-label, effort, outcomes]
    // New business quiz doesn't collect income so buildGoalTitle falls back
    // to the path-only title ("Start an Ecommerce Brand", etc.).
    const income = cat === "business" || cat === "health" ? "" : (allAnswers[0] ?? "");
    const title = buildGoalTitle(cat, path, income);

    try {
      localStorage.setItem("threely_pending_goal", JSON.stringify({
        category: path, // store the library path id
        answers: allAnswers,
        goalText: title,
        displayTitle: title,
      }));
    } catch { /* ignore */ }

    setGeneratedGoalTitle(title);
    setShowBuilding(true);
  }

  function handleBuildingComplete() {
    setShowBuilding(false);
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
          primedPaymentRequest={primedPaymentRequest}
          selectedPath={selectedPath}
        />
      </Elements>
    );
  }

  // ── Building screen ── 3-second animated pre-roll before the hype screen.
  // Pure theatre — makes the plan feel crafted. While this runs, the SetupIntent
  // prefetch effect above kicks off so Apple Pay is primed by paywall time.
  if (showBuilding) {
    return <BuildingGoalScreen onComplete={handleBuildingComplete} />;
  }

  // ── Hype screen ──
  // Wrapped in <Elements> so PaymentRequestPrimer can create the Stripe
  // paymentRequest NOW and run canMakePayment() in the background. By the
  // time the user taps "Show me my plan", Apple Pay is already primed.
  if (showHype) {
    return (
      <Elements stripe={getStripePromise()}>
        {preloadedClientSecret && !primedPaymentRequest && (
          <PaymentRequestPrimer
            clientSecret={preloadedClientSecret}
            onReady={setPrimedPaymentRequest}
          />
        )}
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
      </Elements>
    );
  }

  // ── Get current step config ──
  // Universal order: step 1 = first question, step 2 = second, step 3 = last.
  // For health, STEPS.health has only 2 entries (path + effort); the last
  // step (funnelStep=3) is the outcome multi-select rendered from HEALTH_OUTCOME.
  const currentStepConfig = (() => {
    if (!category) return null;
    const maxStep = category === "business" ? STEPS.business.length : 3;
    if (funnelStep < 1 || funnelStep > maxStep) return null;
    if (category === "health") {
      if (funnelStep === 1) return STEPS.health[0]; // path
      if (funnelStep === 2) return STEPS.health[1]; // effort
      if (funnelStep === 3) return null;            // custom multi-select render
      return null;
    }
    return STEPS[category][funnelStep - 1];
  })();
  const healthOutcomeConfig =
    category === "health" && funnelStep === 3 && selectedPath
      ? HEALTH_OUTCOME[selectedPath]
      : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center", background: "var(--bg)", padding: "clamp(2.5rem, 8vh, 5rem) clamp(1rem, 4vw, 2rem) clamp(1rem, 4vw, 2rem)" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* ── Step 0: Category Picker ── */}
        {funnelStep === 0 && (
          <div key={`fade-${fadeKey}`} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ textAlign: "center" }}>
              <img src="/favicon.png" alt="Threely" width={48} height={48} style={{ borderRadius: 12, marginBottom: 16 }} />
              <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 8 }}>
                What do you want to build?
              </h1>
              <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.85)" }}>
                Pick your direction to start
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              {([
                { id: "business" as Category, label: "🚀 Online Business", subtitle: "Launch your store, brand, and first customers" },
                { id: "daytrading" as Category, label: "📈 Day Trading", subtitle: "Make money trading" },
                { id: "health" as Category, label: "💪 Health", subtitle: "Get in shape" },
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

        {/* ── Health multi-select (step 2) ── */}
        {healthOutcomeConfig && (
          <div key={`fade-${fadeKey}`} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingTop: "clamp(1rem, 4vh, 2.5rem)" }}>
            <div style={{ textAlign: "center" }}>
              <img src="/favicon.png" alt="Threely" width={48} height={48} style={{ borderRadius: 12, marginBottom: 16 }} />
              <h2 style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.75rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 8 }}>
                {healthOutcomeConfig.question}
              </h2>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", margin: 0 }}>Pick all that apply</p>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {healthOutcomeConfig.options.map((opt) => {
                const selected = healthOutcome.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleHealthOutcome(opt)}
                    style={{
                      padding: "1rem 1.25rem", borderRadius: 14,
                      border: `1.5px solid ${selected ? "#D4A843" : "var(--border)"}`,
                      background: selected ? "rgba(212,168,67,0.1)" : "var(--card)",
                      color: selected ? "#D4A843" : "var(--text)",
                      fontSize: "1rem", fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s", minHeight: 56,
                      textAlign: "center",
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleHealthOutcomeContinue}
              disabled={healthOutcome.length === 0}
              style={{
                padding: "1rem 1.25rem", borderRadius: 14, border: "none",
                background: healthOutcome.length > 0
                  ? "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)"
                  : "var(--border)",
                color: healthOutcome.length > 0 ? "#000" : "rgba(255,255,255,0.5)",
                fontSize: "1rem", fontWeight: 700,
                cursor: healthOutcome.length > 0 ? "pointer" : "default",
                minHeight: 56, transition: "all 0.15s",
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Steps 1-3: Funnel questions ── */}
        {funnelStep >= 1 && funnelStep <= 3 && currentStepConfig && (
          <div key={`fade-${fadeKey}`} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingTop: "clamp(1rem, 4vh, 2.5rem)" }}>

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
                    key={btn.label}
                    onClick={() => handleButtonAnswer(btn.label, btn.path || undefined)}
                    style={{
                      padding: "1rem 1.25rem", borderRadius: 14,
                      border: "1.5px solid var(--border)", background: "var(--card)",
                      color: "var(--text)", fontSize: "1rem", fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s", minHeight: 56,
                      textAlign: btn.description ? "left" : "center",
                      display: "flex", flexDirection: "column", alignItems: btn.description ? "flex-start" : "center", justifyContent: "center", gap: 2,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D4A843"; e.currentTarget.style.color = "#D4A843"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                  >
                    <span>{btn.label}</span>
                    {btn.description && (
                      <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>
                        {btn.description}
                      </span>
                    )}
                  </button>
                ))}
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

// ─── Building Goal Screen — 3s progressive loader ────────────────────────
// Shown after the funnel finishes, before the "perfect fit" hype screen.
// No real work runs here — the visual motion + stage text sell that a plan
// is being crafted behind the scenes, which makes the paywall feel earned
// instead of instant. Responsive: scales from phone to desktop via clamp()
// and viewport-relative particle positioning.
function BuildingGoalScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);

  const stages = [
    "Choosing your business path",
    "Matching your brand style",
    "Preparing your Shopify setup",
    "Building your Pro recommendation",
  ];

  useEffect(() => {
    const startTime = performance.now();
    const duration = 3000;
    let rafHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let finished = false;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (elapsed >= duration) {
        if (!finished) {
          finished = true;
          // Brief pause at 100% so the fill lands visibly before we swap screens
          timeoutHandle = setTimeout(onComplete, 220);
        }
        return;
      }
      rafHandle = requestAnimationFrame(tick);
    };
    rafHandle = requestAnimationFrame(tick);

    return () => {
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [onComplete]);

  // Evenly split the 3s run across however many stages we have (currently 4).
  const currentStage = Math.min(
    stages.length - 1,
    Math.floor((progress / 100) * stages.length),
  );

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: "clamp(1rem, 4vw, 2rem)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Floating golden particles — ambient texture behind the core content */}
      <div className="building-particles" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="building-particle"
            style={{
              left: `${(i * 7.5 + 3) % 100}%`,
              animationDelay: `${(i * 0.22) % 3}s`,
              animationDuration: `${3.2 + (i % 4) * 0.4}s`,
              width: `${4 + (i % 3) * 2}px`,
              height: `${4 + (i % 3) * 2}px`,
            }}
          />
        ))}
      </div>

      <div
        className="building-root"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "clamp(1.25rem, 4vh, 2rem)",
          zIndex: 1,
        }}
      >
        {/* Radar pulse rings wrapping the logo */}
        <div style={{
          position: "relative",
          width: 128,
          height: 128,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span className="pulse-ring pulse-ring-1" aria-hidden="true" />
          <span className="pulse-ring pulse-ring-2" aria-hidden="true" />
          <span className="pulse-ring pulse-ring-3" aria-hidden="true" />
          <img
            src="/favicon.png"
            alt="Threely"
            width={64}
            height={64}
            className="logo-breathe"
            style={{
              borderRadius: 16,
              position: "relative",
              zIndex: 2,
              boxShadow: "0 10px 40px rgba(212,168,67,0.45)",
            }}
          />
        </div>

        {/* Title + rotating stage text */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
          <h1 style={{
            fontSize: "clamp(1.6rem, 5.5vw, 2.1rem)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "#fff",
            margin: 0,
            lineHeight: 1.15,
          }}>
            Building your launch
          </h1>
          <div style={{ position: "relative", height: 24, width: "100%" }}>
            {stages.map((stageText, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  fontSize: "clamp(0.88rem, 2.5vw, 0.98rem)",
                  color: "rgba(255,255,255,0.75)",
                  fontWeight: 500,
                  letterSpacing: "-0.005em",
                  opacity: currentStage === i ? 1 : 0,
                  transform: currentStage === i ? "translateY(0)" : "translateY(6px)",
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <span>{stageText}</span>
                <span className="dots-animate">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar + percentage */}
        <div style={{
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            style={{
              width: "100%",
              height: 10,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #B8862D 0%, #D4A843 35%, #E8C547 65%, #FFD766 100%)",
                borderRadius: 999,
                transition: "width 0.08s linear",
                position: "relative",
                boxShadow: "0 0 18px rgba(232,197,71,0.55)",
              }}
            >
              <div className="progress-shine" aria-hidden="true" />
            </div>
          </div>
          <div style={{
            fontSize: "0.85rem",
            color: "#E8C547",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.04em",
          }}>
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      <style>{`
        @keyframes buildingRootFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .building-root { animation: buildingRootFadeIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }

        @keyframes pulseRing {
          0%   { transform: scale(0.45); opacity: 0.75; }
          100% { transform: scale(2.3);  opacity: 0; }
        }
        .pulse-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(212,168,67,0.85);
          animation: pulseRing 1.9s cubic-bezier(0, 0.55, 0.45, 1) infinite;
        }
        .pulse-ring-2 { animation-delay: 0.63s; }
        .pulse-ring-3 { animation-delay: 1.26s; }

        @keyframes logoBreathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.07); }
        }
        .logo-breathe { animation: logoBreathe 1.6s ease-in-out infinite; }

        @keyframes progressShineSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .progress-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
          animation: progressShineSlide 1.2s ease-in-out infinite;
        }

        @keyframes buildingParticleFloat {
          0%   { transform: translateY(40vh) scale(0.5); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(-110vh) scale(1.1); opacity: 0; }
        }
        .building-particles {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .building-particle {
          position: absolute;
          bottom: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(232,197,71,0.9) 0%, rgba(212,168,67,0) 70%);
          box-shadow: 0 0 10px rgba(232,197,71,0.4);
          animation: buildingParticleFloat 3.4s ease-in-out infinite;
        }

        @keyframes dotsBlink {
          0%, 20%  { opacity: 0.2; }
          40%      { opacity: 1; }
          100%     { opacity: 0.2; }
        }
        .dots-animate { display: inline-flex; margin-left: 2px; }
        .dots-animate span {
          animation: dotsBlink 1.3s ease-in-out infinite;
          opacity: 0.2;
        }
        .dots-animate span:nth-child(2) { animation-delay: 0.18s; }
        .dots-animate span:nth-child(3) { animation-delay: 0.36s; }

        @media (prefers-reduced-motion: reduce) {
          .building-root, .pulse-ring, .logo-breathe, .progress-shine,
          .building-particle, .dots-animate span {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Sale countdown — resets at local midnight ────────────────────────────
// Grey pill with gold accent that shows "Sale Ends: HH:MM:SS" counting down
// to the user's local midnight. Placed directly above Apple Pay to add
// urgency. Rerenders every second; recalculates on midnight cross.
function SaleCountdown() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  let diff = Math.max(0, midnight.getTime() - now.getTime());
  const h = Math.floor(diff / 3_600_000); diff -= h * 3_600_000;
  const m = Math.floor(diff / 60_000); diff -= m * 60_000;
  const s = Math.floor(diff / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div
      aria-hidden="true"
      data-tick={tick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "0.7rem 1rem",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(232,197,71,0.16) 0%, rgba(184,134,45,0.12) 100%)",
        border: "1px solid rgba(212,168,67,0.45)",
        boxShadow: "0 4px 16px rgba(212,168,67,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
        animation: "saleCountdownPulse 2.4s ease-in-out infinite",
      }}
    >
      <span style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.005em", color: "rgba(232,197,71,0.95)" }}>
        <strong style={{ fontWeight: 900, color: "#FFD766", textShadow: "0 0 12px rgba(255,215,100,0.45)" }}>$1</strong> Preview access ends in
      </span>
      <span style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "-0.01em", color: "#E8C547", fontVariantNumeric: "tabular-nums" }}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}

// ─── Plan Ready screen (wrapped in Elements by parent) ───────────────────────
// High-conversion paywall hierarchy:
//   1. Headline "Your plan is ready — start for $1" + 15-min subtext + urgency
//   2. Task preview (1 visible + 2 blurred with shimmer)
//   3. CTA button (Apple/Google Pay primary, card secondary)
//   4. Terms block ("$1 today • 3-day Launch Preview • then $39/mo Threely Pro • cancel anytime")
//   5. Plan selector (Monthly / Yearly) — secondary, below terms, muted
// Premium feel via soft shadows, subtle shimmer on blurred tasks, press-scale
// on buttons, and a fade-in on mount.
function PlanReadyScreen({ category, generatedGoalTitle, preloadedClientSecret, primedPaymentRequest, selectedPath }: { category: Category | null; generatedGoalTitle: string; preloadedClientSecret: string | null; primedPaymentRequest: PaymentRequest | null; selectedPath: string }) {
  // Single public plan: Threely Pro $39/mo after the $1 trial. setPlan retained
  // so the rest of the flow (InlinePayment) compiles without changes; no UI
  // surface lets the user flip it anymore.
  const [plan] = useState<PlanId>("monthly");
  const [paymentDone, setPaymentDone] = useState(false);
  const [payerEmail, setPayerEmail] = useState<string | null>(null);

  // Six blurred preview cards — each represents a concrete asset from the
  // Launch Preview deliverable. Icons make them scannable even blurred; the
  // shimmer + lock sells real personalization without handing the content out.
  const LAUNCH_PREVIEW_CARDS: { icon: string; label: string }[] = [
    { icon: "🏷️", label: "Your Brand Name" },
    { icon: "🎨", label: "Your Logo Direction" },
    { icon: "📦", label: "Your Product Direction" },
    { icon: "🛒", label: "Your Shopify Setup" },
    { icon: "🗺️", label: "Your Launch Roadmap" },
    { icon: "🎬", label: "Sample Ad Concepts" },
  ];


  if (paymentDone) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "clamp(1rem, 4vw, 2rem)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AccountFinalize preFilledEmail={payerEmail} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "clamp(2rem, 6vh, 4rem) clamp(1rem, 4vw, 2rem) clamp(1rem, 4vw, 2rem)", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <div className="paywall-root" style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        {/* 1. Logo + "Recommended For You" badge + headline */}
        <div style={{ textAlign: "center", paddingTop: 0 }}>
          <img src="/favicon.png" alt="Threely" width={48} height={48} style={{ borderRadius: 12, marginBottom: 12, boxShadow: "0 6px 18px rgba(212,168,67,0.15)" }} />
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "0.28rem 0.85rem",
            borderRadius: 100,
            border: "1px solid rgba(212,168,67,0.35)",
            background: "rgba(212,168,67,0.08)",
            marginBottom: 12,
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "#D4A843",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            Recommended For You
          </div>
          <h1 style={{
            fontSize: "clamp(1.5rem, 5vw, 2rem)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--text)",
            lineHeight: 1.15,
            margin: 0,
          }}>
            Your Launch Preview Is Ready
          </h1>
          <p style={{
            marginTop: 10,
            fontSize: "0.92rem",
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.7)",
            maxWidth: 420,
            marginLeft: "auto",
            marginRight: "auto",
          }}>
            Start for $1. Build your business preview today. Continue with Threely Pro after your trial.
          </p>
        </div>

        {/* Plan card — Threely Pro, $1 today / $39/mo after 3 days */}
        <div className="card" style={{
          padding: "1rem 1.1rem",
          borderRadius: 14,
          border: "1.5px solid rgba(212,168,67,0.25)",
          background: "linear-gradient(135deg, rgba(212,168,67,0.07) 0%, rgba(212,168,67,0.02) 100%)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Threely Pro</div>
              <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{generatedGoalTitle}</div>
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.45 }}>
                See your business before committing.
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#D4A843", lineHeight: 1, letterSpacing: "-0.02em" }}>$1</div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", marginTop: 2, fontWeight: 600 }}>today</div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.45)", marginTop: 2, fontWeight: 500, letterSpacing: 0.1 }}>then $39/mo</div>
            </div>
          </div>
        </div>

        {/* 2. Launch Preview cards — 4 blurred asset rows (brand/logo/product/
             roadmap). Each has its own icon so users can scan what they'll
             unlock even through the blur. Big shaking lock sits centered over
             the stack. Rows are flush (no gap) so overlay reads as one unit. */}
        <div style={{ position: "relative" }}>
          <div className="locked-stack" style={{ pointerEvents: "none", userSelect: "none", display: "flex", flexDirection: "column", gap: 0, borderRadius: 14, overflow: "hidden" }}>
            {LAUNCH_PREVIEW_CARDS.map((card, i) => (
              <div key={i} className="locked-task" style={{
                padding: "0.9rem 1.1rem",
                borderRadius: 0,
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                borderRight: "1px solid rgba(255,255,255,0.08)",
                borderTop: i === 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
                borderBottom: i === LAUNCH_PREVIEW_CARDS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                background: "rgba(255,255,255,0.02)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  border: "1px solid rgba(212,168,67,0.22)",
                  background: "rgba(212,168,67,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1.05rem",
                }}>{card.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.35, filter: "blur(5px)" }}>
                    {"Your personalized launch asset — unlocks after preview"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Big lock — sits clearly ABOVE the CTA text and slightly below
              the top border of the blurred block. The shake animation's
              transform was overriding translateX(-50%), pulling the lock
              off-center. Outer wrapper handles positioning, inner element
              does the shake. */}
          <div style={{
            position: "absolute",
            left: "50%",
            top: 4,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 4,
          }}>
            <div className="shake-lock" style={{
              fontSize: "2.4rem",
              lineHeight: 1,
              filter: "drop-shadow(0 0 16px rgba(212,168,67,0.65))",
              display: "inline-block",
            }}>🔒</div>
          </div>
          {/* Gradient fade + CTA text */}
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            height: "60%",
            background: "linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.55) 45%, rgba(10,10,10,0.95) 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
            paddingBottom: 12, borderRadius: 14, pointerEvents: "none", gap: 2,
          }}>
            <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
              Start My Launch Preview
            </p>
            <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
              $1 today · then $39/mo after 3 days
            </p>
          </div>
        </div>

        {/* Countdown urgency — resets at local midnight */}
        <SaleCountdown />

        {/* 3. CTA — Apple Pay / Google Pay primary + card secondary */}
        <InlinePayment
          plan={plan}
          preloadedClientSecret={preloadedClientSecret}
          primedPaymentRequest={primedPaymentRequest}
          onSuccess={(email) => { setPayerEmail(email); setPaymentDone(true); }}
        />

        {/* Plan selector removed — cold traffic sees only the single public
            plan (Threely Pro $1 → $39/mo). Legacy PlanSelector component
            preserved for potential post-activation dashboard use. */}

        {/* Terms disclosure — bottom of the paywall, still on-screen before
            the user taps Apple Pay. ROSCA + California ARL compliant because
            disclosure is clear, conspicuous, and within the same viewport. */}
        <p style={{
          fontSize: "0.6rem", lineHeight: 1.4,
          color: "rgba(255,255,255,0.45)",
          margin: 0,
          padding: "0 2px",
          marginTop: 2,
        }}>
          By tapping Apple Pay or Pay with Card, you agree your payment method will be automatically charged for ongoing subscription fees. You&apos;ll pay $1 today for a 3-day Launch Preview. After that, your Threely Pro subscription will automatically renew at $39/month unless you cancel before the preview ends. Tax is included if applicable. Cancel anytime online or by contacting support before your next billing date. You also agree to the <a href="/privacy" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline" }}>Privacy Policy</a> and <a href="/terms" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline" }}>Terms of Service</a>, including the arbitration and class action waiver, and to receive offers from Threely.
        </p>

        {/* Global paywall styles — fade-in, shimmer on locked tasks, press scale */}
        <style>{`
          .paywall-root { animation: paywallFadeIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
          @keyframes paywallFadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .fade-in-fast { animation: paywallFadeIn 0.25s ease both; }
          .locked-stack { position: relative; overflow: hidden; border-radius: 14px; }
          .locked-task {
            position: relative;
            overflow: hidden;
          }
          .locked-task::before {
            content: "";
            position: absolute; inset: 0;
            background: linear-gradient(
              105deg,
              transparent 0%,
              rgba(212,168,67,0) 30%,
              rgba(232,197,71,0.32) 45%,
              rgba(255,215,100,0.55) 50%,
              rgba(232,197,71,0.32) 55%,
              rgba(212,168,67,0) 70%,
              transparent 100%
            );
            transform: translateX(-100%);
            animation: lockedShimmer 1.8s ease-in-out infinite;
            pointer-events: none;
            z-index: 2;
          }
          @keyframes lockedShimmer {
            0%   { transform: translateX(-100%); }
            50%  { transform: translateX(100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes saleCountdownPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 4px 16px rgba(212,168,67,0.15), inset 0 1px 0 rgba(255,255,255,0.05); }
            50%      { transform: scale(1.025); box-shadow: 0 6px 22px rgba(212,168,67,0.28), inset 0 1px 0 rgba(255,255,255,0.08); }
          }
          @keyframes lockShake {
            0%, 100%     { transform: rotate(0deg); }
            15%, 45%, 75% { transform: rotate(-14deg); }
            30%, 60%, 90% { transform: rotate(14deg); }
          }
          .shake-lock {
            display: inline-block;
            animation: lockShake 1.1s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite;
            transform-origin: center;
          }
          .press-scale { transition: transform 0.12s ease-out, background 0.15s ease, box-shadow 0.15s ease; }
          .press-scale:active { transform: scale(0.97); }
          .press-scale:hover:not(:disabled) { filter: brightness(1.06); }
          .pr-button-wrap { transition: transform 0.12s ease-out; }
          .pr-button-wrap:active { transform: scale(0.985); }
        `}</style>
      </div>
    </div>
  );
}
