"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Lock,
  Loader2,
  Sparkles,
  TrendingUp,
  Briefcase,
  Heart,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type PlanId = "monthly" | "yearly";

const PLAN_INFO: Record<PlanId, { label: string; priceDisplay: string; subLine: string; badge?: string; priceYearly?: string }> = {
  yearly: { label: "Yearly", priceDisplay: "$8.33/mo", subLine: "Billed annually", badge: "40% OFF", priceYearly: "$99.99/yr" },
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

// Stripe Elements styling — light theme.
function getElementStyle(): Record<string, unknown> {
  return {
    base: {
      fontSize: "16px",
      color: "#0f172a",
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#ef4444" },
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
      question: "What kind of business?",
      buttons: [
        { label: "Passive income", path: "business_passive" },
        { label: "Ecommerce", path: "business_ecommerce" },
        { label: "Personal brand", path: "business_content" },
        { label: "Most money", path: "business_money" },
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
  daytrading_beginner: "Open a free paper trading account (Webull or Thinkorswim)",
  daytrading_experienced: "Open your brokerage and screenshot your last trade",
  business_passive: "Write down 3 things people would pay to learn from you",
  business_ecommerce: "Write down 3 things you'd personally buy online",
  business_content: "Pick one platform — TikTok, IG, or YouTube",
  business_money: "Write down 3 things you'd personally buy online",
  health_weight_loss: "Download MyFitnessPal and log your breakfast",
  health_general: "Screenshot 3 looks you want to copy",
  health_muscle: "Download Hevy or Strong to track your workouts",
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
        className={[
          "relative flex-1 rounded-md border px-3 py-2 text-center text-sm font-semibold transition-colors",
          selected
            ? "border-gold bg-gold/10 text-neutral-900"
            : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900",
        ].join(" ")}
      >
        {info.badge && (
          <span className="absolute -top-2 right-2 rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-foreground">
            {info.badge}
          </span>
        )}
        {info.label}
      </button>
    );
  };
  return (
    <div className="flex gap-2">
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
  }, [plan, clientSecret]);

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

  const inputClass =
    "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40";

  // Stripe Element wrapper that mimics Tailwind input styles
  const stripeInputClass =
    "w-full rounded-md border border-neutral-200 bg-white px-3 py-3 focus-within:border-gold/40 focus-within:ring-2 focus-within:ring-gold/40";

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Apple Pay / Google Pay — primary CTA. Stripe auto-detects brand. */}
      {paymentRequest && (
        <div className="pr-button-wrap">
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: { paymentRequestButton: { theme: "light", height: "48px", type: "default" } },
            }}
          />
        </div>
      )}

      {/* Divider */}
      {paymentRequest && (
        <div className="my-1 flex items-center gap-3">
          <Separator className="flex-1 bg-neutral-200" />
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Or pay with card
          </span>
          <Separator className="flex-1 bg-neutral-200" />
        </div>
      )}

      {/* Card — secondary option */}
      <button
        type="button"
        onClick={() => setCardOpen((o) => !o)}
        className="flex h-11 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900"
      >
        <CreditCard className="h-4 w-4 text-neutral-500" />
        Continue with card
        <ChevronDown
          className={`h-4 w-4 text-neutral-400 transition-transform ${cardOpen ? "rotate-180" : ""}`}
        />
      </button>

      {cardOpen && (
        <form onSubmit={handleCardSubmit} className="fade-in-fast flex flex-col gap-2.5">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Name on card"
            autoComplete="cc-name"
            className={inputClass}
          />
          <div className={stripeInputClass}>
            <CardNumberElement
              options={{ style: getElementStyle(), showIcon: true }}
              onChange={(e) => setCardNumberComplete(e.complete)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={stripeInputClass}>
              <CardExpiryElement
                options={{ style: getElementStyle() }}
                onChange={(e) => setCardExpiryComplete(e.complete)}
              />
            </div>
            <div className={stripeInputClass}>
              <CardCvcElement
                options={{ style: getElementStyle() }}
                onChange={(e) => setCardCvcComplete(e.complete)}
              />
            </div>
          </div>
          <Button
            type="submit"
            variant="gold"
            size="lg"
            disabled={!cardReady || submitting || !clientSecret}
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Start for $1
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
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

  const inputClass =
    "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40";

  return (
    <Card className="w-full max-w-md border-neutral-200 p-6 shadow-sm sm:p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
          <Sparkles className="h-6 w-6 text-gold" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {signInMode ? "Welcome back" : preFilledEmail ? "One last step" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          {signInMode
            ? "Sign in to attach your new plan to your existing account."
            : preFilledEmail
              ? "Set a password so you can log back in."
              : "Save your plan with an email and password."}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {!preFilledEmail && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className={inputClass}
          />
        )}
        {preFilledEmail && (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            {preFilledEmail}
          </div>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={signInMode ? "Your existing password" : "Password (8+ characters)"}
          autoComplete={signInMode ? "current-password" : "new-password"}
          required
          className={inputClass}
        />
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" variant="gold" size="lg" disabled={submitting} className="mt-1 w-full">
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {signInMode ? "Sign in" : "Finish"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </Card>
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
      if (saved.showHype) setShowHype(true);
      if (saved.planReady) setPlanReady(true);
      if (saved.generatedGoalTitle) setGeneratedGoalTitle(saved.generatedGoalTitle);
    } catch { /* ignore — bad JSON means start fresh */ }
  }, []);
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        category, funnelStep, answers, selectedPath,
        healthOutcome, showHype, planReady, generatedGoalTitle,
        savedAt: Date.now(),
      }));
    } catch { /* ignore */ }
  }, [category, funnelStep, answers, selectedPath, healthOutcome, showHype, planReady, generatedGoalTitle]);

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
      if (planReady || showHype) {
        setPlanReady(false);
        setShowHype(false);
        setCategory(null);
        setFunnelStep(0);
        setAnswers([]);
        setSelectedPath("");
        setHealthOutcome([]);
        setGeneratedGoalTitle("");
        window.history.pushState({ threely: "start" }, "", window.location.pathname);
        return;
      }
      if (funnelStep > 0) {
        setAnswers((prev) => prev.slice(0, -1));
        setFunnelStep((prev) => Math.max(0, prev - 1));
        window.history.pushState({ threely: "start" }, "", window.location.pathname);
        return;
      }
      // At step 0 — allow the natural back to /
      window.location.href = "/";
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [planReady, showHype, funnelStep]);
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

    if (newAnswers.length >= 3) {
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
      setCategory(null);
      setAnswers([]);
      setSelectedPath("");
      setHealthOutcome([]);
      animateStep(0);
    } else if (funnelStep > 1) {
      setAnswers((prev) => prev.slice(0, -1));
      animateStep(funnelStep - 1);
    }
  }

  // ── Show hype + blurred preview (NO plan building yet) ──
  function startBuild(cat: Category, allAnswers: string[], path: string) {
    // New order:
    //   business/daytrading: answers[0]=income, answers[1]=effort, answers[2]=path-label
    //   health:              answers[0]=path-label, answers[1]=effort, answers[2]=outcomes
    const income = cat === "health" ? "" : (allAnswers[0] ?? "");
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
    setShowHype(true);
  }

  function handleHypeContinue() {
    setPlanReady(true);
    setShowHype(false);
  }

  // ── Loading state ──
  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 font-sans text-neutral-900 antialiased">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 font-sans text-neutral-900 antialiased">
        <Card className="w-full max-w-md border-neutral-200 p-8 text-center shadow-sm">
          <p className="mb-4 text-sm text-red-600">{error}</p>
          <Button variant="gold" size="lg" onClick={() => window.location.reload()} className="w-full">
            Try again
          </Button>
        </Card>
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
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 font-sans text-neutral-900 antialiased sm:p-6">
          <div className="hype-fade-in flex w-full max-w-md flex-col items-center gap-6 text-center">
            <div className="hype-spark flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
              <Sparkles className="h-8 w-8 text-gold" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              Perfect fit
            </p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
              You&apos;re ready to build.
            </h1>
            <p className="max-w-sm text-base leading-relaxed text-neutral-600">
              Threely is preparing your personalized plan right now. This is going to change everything.
            </p>
            <Button
              variant="gold"
              size="lg"
              onClick={handleHypeContinue}
              className="mt-2 w-full max-w-xs"
            >
              Show me my plan
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <style>{`
            @keyframes hypeFadeIn {
              from { opacity: 0; transform: translateY(12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .hype-fade-in { animation: hypeFadeIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
            @keyframes hypeSparkPulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50%      { transform: scale(1.06); opacity: 0.92; }
            }
            .hype-spark { animation: hypeSparkPulse 2s ease-in-out infinite; }
          `}</style>
        </div>
      </Elements>
    );
  }

  // ── Get current step config ──
  // Universal order: step 1 = first question, step 2 = second, step 3 = last.
  // For health, STEPS.health has only 2 entries (path + effort); the last
  // step (funnelStep=3) is the outcome multi-select rendered from HEALTH_OUTCOME.
  const currentStepConfig = (() => {
    if (!category || funnelStep < 1 || funnelStep > 3) return null;
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

  const showProgressDots = funnelStep >= 1 && funnelStep <= 3;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 font-sans text-neutral-900 antialiased">
      {/* ── Sticky header with brand + progress + back ── */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          {showProgressDots ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/" className="text-base font-bold tracking-tight text-neutral-900">
              Threely
            </Link>
          )}

          {showProgressDots && (
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((dot) => (
                <span
                  key={dot}
                  className={[
                    "h-2 rounded-full transition-all",
                    dot === funnelStep
                      ? "w-6 bg-gold"
                      : dot < funnelStep
                        ? "w-2 bg-gold"
                        : "w-2 bg-neutral-200",
                  ].join(" ")}
                />
              ))}
            </div>
          )}

          {showProgressDots ? (
            <Link href="/" className="text-base font-bold tracking-tight text-neutral-900">
              Threely
            </Link>
          ) : (
            <span className="h-9 w-9" aria-hidden />
          )}
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-xl">
          {/* ── Step 0: Category Picker ── */}
          {funnelStep === 0 && (
            <div key={`fade-${fadeKey}`} className="step-fade-in flex flex-col gap-6">
              <div className="text-center">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
                  Get Started
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
                  What is your goal?
                </h1>
                <p className="mt-3 text-base text-neutral-600">
                  Pick one to get started.
                </p>
              </div>

              <Card className="border-neutral-200 p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3">
                  {[
                    {
                      id: "daytrading" as Category,
                      label: "Day Trading",
                      subtitle: "Make money trading",
                      Icon: TrendingUp,
                    },
                    {
                      id: "business" as Category,
                      label: "Business",
                      subtitle: "Make money online",
                      Icon: Briefcase,
                    },
                    {
                      id: "health" as Category,
                      label: "Health",
                      subtitle: "Get in shape",
                      Icon: Heart,
                    },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className="group flex items-center gap-4 rounded-md border border-neutral-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-sm"
                    >
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700 transition-colors group-hover:border-gold/40 group-hover:bg-gold/10 group-hover:text-gold">
                        <cat.Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold text-neutral-900">
                          {cat.label}
                        </div>
                        <div className="mt-0.5 text-sm text-neutral-600">
                          {cat.subtitle}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-neutral-300 transition-colors group-hover:text-gold" />
                    </button>
                  ))}
                </div>
              </Card>

              <p className="text-center text-xs text-neutral-500">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-neutral-900 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* ── Health multi-select (step 3 for health) ── */}
          {healthOutcomeConfig && (
            <div key={`fade-${fadeKey}`} className="step-fade-in flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
                  {healthOutcomeConfig.question}
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Pick all that apply
                </p>
              </div>

              <Card className="border-neutral-200 p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-2.5">
                  {healthOutcomeConfig.options.map((opt) => {
                    const selected = healthOutcome.includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => toggleHealthOutcome(opt)}
                        className={[
                          "flex items-center justify-between rounded-md border bg-white px-4 py-3.5 text-left text-sm font-medium transition-all",
                          selected
                            ? "border-gold bg-gold/10 text-neutral-900 ring-2 ring-gold/30"
                            : "border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:text-neutral-900",
                        ].join(" ")}
                      >
                        <span>{opt}</span>
                        {selected && (
                          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-gold" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="gold"
                  size="lg"
                  onClick={handleHealthOutcomeContinue}
                  disabled={healthOutcome.length === 0}
                  className="mt-5 w-full"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Card>
            </div>
          )}

          {/* ── Steps 1-3: Funnel questions ── */}
          {funnelStep >= 1 && funnelStep <= 3 && currentStepConfig && (
            <div key={`fade-${fadeKey}`} className="step-fade-in flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
                  {currentStepConfig.question}
                </h2>
              </div>

              <Card className="border-neutral-200 p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-2.5">
                  {currentStepConfig.buttons.map((btn) => (
                    <button
                      key={btn.label}
                      onClick={() => handleButtonAnswer(btn.label, btn.path || undefined)}
                      className="group flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3.5 text-left transition-all hover:border-gold/60 hover:bg-gold/5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-neutral-900">
                          {btn.label}
                        </div>
                        {btn.description && (
                          <div className="mt-0.5 text-xs text-neutral-500">
                            {btn.description}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-neutral-300 transition-colors group-hover:text-gold" />
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes stepFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .step-fade-in { animation: stepFadeIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>
    </div>
  );
}

// ─── Sale countdown — resets at local midnight ────────────────────────────
// Soft gold pill that shows "$1 offer ends in HH:MM:SS" counting down to the
// user's local midnight. Placed directly above Apple Pay to add urgency.
// Rerenders every second; recalculates on midnight cross.
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
      className="sale-pulse flex items-center justify-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-semibold text-neutral-800"
    >
      <span>
        <span className="font-extrabold text-gold">$1</span> offer ends in
      </span>
      <span className="font-mono font-bold tabular-nums text-neutral-900">
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
//   4. Terms block ("$1 today • 3-day trial • then $12.99/mo • cancel anytime")
//   5. Plan selector (Monthly / Yearly) — secondary, below terms, muted
function PlanReadyScreen({ category, generatedGoalTitle, preloadedClientSecret, primedPaymentRequest, selectedPath }: { category: Category | null; generatedGoalTitle: string; preloadedClientSecret: string | null; primedPaymentRequest: PaymentRequest | null; selectedPath: string }) {
  const [plan, setPlan] = useState<PlanId>("yearly");
  const [paymentDone, setPaymentDone] = useState(false);
  const [payerEmail, setPayerEmail] = useState<string | null>(null);
  const renewPrice = plan === "yearly" ? "$99.99/year" : "$12.99/month";

  // Two blurred-only preview cards — no visible task (avoids the "user reads
  // it and just does it themselves" leak). The shimmer + lock sells that
  // there's a real plan behind the paywall without handing it out.
  const BLURRED_PLACEHOLDERS = [
    "Your first personalized step, built for your goal",
    "A simple action to lock in your habit today",
  ];

  if (paymentDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 font-sans text-neutral-900 antialiased">
        <AccountFinalize preFilledEmail={payerEmail} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-neutral-50 p-4 font-sans text-neutral-900 antialiased sm:p-6">
      <div className="paywall-fade w-full max-w-md">
        {/* Brand mark */}
        <div className="mb-5 text-center">
          <Link
            href="/"
            className="inline-block text-sm font-bold tracking-tight text-neutral-900"
          >
            Threely
          </Link>
        </div>

        <Card className="border-neutral-200 p-5 shadow-sm sm:p-6">
          {/* 1. Headline */}
          <div className="text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold">
              Your Plan Is Ready
            </p>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
              One step away from your goal
            </h1>
          </div>

          {/* Goal pill */}
          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gold">
              Your Goal
            </div>
            <div className="mt-0.5 text-sm font-semibold text-neutral-900">
              {generatedGoalTitle}
            </div>
          </div>

          {/* 2. Task preview — 2 blurred cards with a shaking lock overlay */}
          <div className="relative mt-5">
            <div className="locked-stack rounded-md border border-neutral-200 bg-white">
              {BLURRED_PLACEHOLDERS.map((placeholder, i) => (
                <div
                  key={i}
                  className={[
                    "locked-task flex items-center gap-3 px-4 py-3.5",
                    i !== 0 ? "border-t border-neutral-200" : "",
                  ].join(" ")}
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-neutral-200 bg-white text-xs font-bold text-neutral-400">
                    {i + 1}
                  </div>
                  <div className="flex-1 select-none text-sm font-medium text-neutral-700 [filter:blur(5px)]">
                    {placeholder}
                  </div>
                </div>
              ))}
            </div>

            {/* Shaking lock — top-center over the blurred stack */}
            <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
              <div className="shake-lock flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/30">
                <Lock className="h-5 w-5 text-gold" />
              </div>
            </div>

            {/* Bottom gradient overlay + CTA copy */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-3/5 flex-col items-center justify-end rounded-b-md bg-gradient-to-t from-white via-white/85 to-transparent pb-3">
              <p className="text-base font-extrabold tracking-tight text-neutral-900">
                Finish what you started
              </p>
              <p className="mt-0.5 text-sm font-semibold text-neutral-700">
                Start your goal for only $1
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div className="mt-5">
            <SaleCountdown />
          </div>

          {/* 3. Payment CTAs */}
          <div className="mt-4">
            <InlinePayment
              plan={plan}
              preloadedClientSecret={preloadedClientSecret}
              primedPaymentRequest={primedPaymentRequest}
              onSuccess={(email) => { setPayerEmail(email); setPaymentDone(true); }}
            />
          </div>

          {/* Plan selector */}
          <div className="mt-4">
            <PlanSelector plan={plan} onChange={setPlan} />
          </div>

          {/* Terms */}
          <p className="mt-4 text-[10px] leading-relaxed text-neutral-500">
            By tapping Apple Pay or Pay with Card, you agree your payment method will be automatically charged for ongoing subscription fees. You&apos;ll pay $1 today for a 3-day intro period. After that, your subscription will automatically renew at {renewPrice} unless you cancel before the intro period ends. Tax is included if applicable. Cancel anytime online or by contacting support before your next billing date. You also agree to the{" "}
            <Link href="/privacy" className="underline hover:text-neutral-700">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline hover:text-neutral-700">
              Terms of Service
            </Link>
            , including the arbitration and class action waiver, and to receive offers from Threely.
          </p>
        </Card>

        <p className="mt-5 text-center text-xs text-neutral-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-neutral-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {/* Paywall styles — fade-in, shimmer on locked tasks, lock shake, sale pulse */}
      <style>{`
        @keyframes paywallFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .paywall-fade { animation: paywallFadeIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .fade-in-fast { animation: paywallFadeIn 0.25s ease both; }

        .locked-stack { position: relative; overflow: hidden; }
        .locked-task { position: relative; overflow: hidden; }
        .locked-task::before {
          content: "";
          position: absolute; inset: 0;
          background: linear-gradient(
            105deg,
            transparent 0%,
            rgba(212,168,67,0) 30%,
            rgba(232,197,71,0.16) 45%,
            rgba(255,215,100,0.28) 50%,
            rgba(232,197,71,0.16) 55%,
            rgba(212,168,67,0) 70%,
            transparent 100%
          );
          transform: translateX(-100%);
          animation: lockedShimmer 2.2s ease-in-out infinite;
          pointer-events: none;
          z-index: 2;
        }
        @keyframes lockedShimmer {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes salePulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.015); }
        }
        .sale-pulse { animation: salePulse 2.4s ease-in-out infinite; }

        @keyframes lockShake {
          0%, 100%      { transform: rotate(0deg); }
          15%, 45%, 75% { transform: rotate(-10deg); }
          30%, 60%, 90% { transform: rotate(10deg); }
        }
        .shake-lock {
          animation: lockShake 1.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite;
          transform-origin: center;
        }
        .pr-button-wrap { transition: transform 0.12s ease-out; }
        .pr-button-wrap:active { transform: scale(0.985); }
      `}</style>
    </div>
  );
}
