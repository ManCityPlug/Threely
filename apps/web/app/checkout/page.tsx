"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getSupabase } from "@/lib/supabase-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Plan = "monthly" | "yearly";

const PLAN_INFO: Record<Plan, { name: string; price: string; period: string; perMonth: string; badge?: string }> = {
  yearly: { name: "Yearly", price: "$99.99", period: "year", perMonth: "$8.33/mo", badge: "SAVE 36%" },
  monthly: { name: "Monthly", price: "$12.99", period: "month", perMonth: "$12.99/mo" },
};

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-gold" />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CheckoutInner />
    </Suspense>
  );
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<Plan>((searchParams.get("plan") as Plan) || "yearly");

  return (
    <Elements stripe={getStripePromise()}>
      <CheckoutContent plan={plan} onChangePlan={setPlan} />
    </Elements>
  );
}

function getElementStyle(): Record<string, unknown> {
  return {
    base: {
      fontSize: "16px",
      color: "#0f172a",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#ef4444" },
  };
}

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
}

function CheckoutContent({ plan, onChangePlan }: { plan: Plan; onChangePlan: (p: Plan) => void }) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [trialEligible, setTrialEligible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [cardNumberComplete, setCardNumberComplete] = useState(false);
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false);
  const [cardCvcComplete, setCardCvcComplete] = useState(false);
  const allComplete = fullName.trim().length > 0 && cardNumberComplete && cardExpiryComplete && cardCvcComplete;

  const info = PLAN_INFO[plan] || PLAN_INFO.yearly;

  // Fetch SetupIntent on mount
  useEffect(() => {
    async function init() {
      try {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        const res = await fetch("/api/subscription/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan }),
        });

        if (!res.ok) {
          const data = await safeJson(res);
          if (data.error === "Subscription already active") {
            router.replace("/dashboard");
            return;
          }
          throw new Error(data.error || "Failed to initialize checkout");
        }

        const data = await safeJson(res);
        setClientSecret(data.clientSecret);
        setTrialEligible(data.trialEligible);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [plan, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setSubmitting(true);
    setError(null);

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) {
      setError("Card element not found");
      setSubmitting(false);
      return;
    }

    // Step 1: Confirm card setup (no charge)
    const { error: setupError } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardNumber,
        billing_details: { name: fullName.trim() },
      },
    });

    if (setupError) {
      setError(setupError.message || "Card setup failed");
      setSubmitting(false);
      return;
    }

    // Step 2: Create the subscription
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch("/api/subscription/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.error || "Failed to create subscription");
      }

      const confirmData = await safeJson(res);

      // If coming from /start flow, send to signup to create account
      const params = new URLSearchParams(window.location.search);
      if (params.get("from") === "start") {
        router.replace("/signup?from=checkout");
      } else if (trialEligible && confirmData.trialGranted === false) {
        router.replace("/dashboard?subscribed=1&trial=denied");
      } else {
        router.replace("/dashboard?subscribed=1");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subscription");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="text-base font-bold tracking-tight text-neutral-900"
          >
            Threely
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </header>

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-md px-4 py-10 md:py-14">
        {/* ── Plan summary card ──────────────────────────────────────── */}
        <Card className="mb-5 border-neutral-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold tracking-tight text-neutral-900">
                    Threely Pro — {info.name}
                  </span>
                  {info.badge && (
                    <Badge
                      variant="gold"
                      className="rounded-full border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold-foreground"
                    >
                      {info.badge}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {info.perMonth} billed {plan === "yearly" ? "annually" : "monthly"}
                </p>
              </div>
              <span className="text-lg font-bold tracking-tight text-neutral-900">
                {trialEligible ? "$1.00" : info.price}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Plan toggle ────────────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-2">
          {(["yearly", "monthly"] as const).map((p) => {
            const active = plan === p;
            const label = p === "yearly" ? "Yearly" : "Monthly";
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChangePlan(p)}
                className={
                  active
                    ? "rounded-md border-2 border-gold bg-gold/5 px-3 py-3 text-center text-sm font-semibold text-neutral-900 transition-colors"
                    : "rounded-md border border-neutral-200 bg-white px-3 py-3 text-center text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
                }
              >
                {label}
                {p === "yearly" && (
                  <span
                    className={
                      active
                        ? "mt-0.5 block text-[11px] font-medium text-gold"
                        : "mt-0.5 block text-[11px] font-medium text-neutral-400"
                    }
                  >
                    Save 36%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Trial info banner ────────────────────────────────────────── */}
        {trialEligible && (
          <div className="mb-5 rounded-lg border border-gold/30 bg-gold/5 px-5 py-4 text-center">
            <p className="text-base font-semibold text-neutral-900">
              $1 today, then {info.price}/{info.period}.
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              Cancel anytime in Settings — no questions asked.
            </p>
          </div>
        )}

        {/* ── Payment form ─────────────────────────────────────────────── */}
        <Card className="border-neutral-200 shadow-sm">
          <CardContent className="p-6">
            <h3 className="mb-5 text-base font-semibold tracking-tight text-neutral-900">
              Pay with card
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-600">
                  Name on card
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  autoComplete="cc-name"
                  className="w-full rounded-md border border-neutral-200 bg-white px-3.5 py-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
              </div>

              {/* Card number */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-600">
                  Card number
                </label>
                <div className="rounded-md border border-neutral-200 bg-white px-3.5 py-3 transition-colors focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20">
                  <CardNumberElement
                    options={{ style: getElementStyle(), showIcon: true }}
                    onChange={(e) => {
                      setCardNumberComplete(e.complete);
                      if (e.error) setError(e.error.message);
                      else if (error) setError(null);
                    }}
                  />
                </div>
              </div>

              {/* Expiry + CVC row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-600">
                    Expiration
                  </label>
                  <div className="rounded-md border border-neutral-200 bg-white px-3.5 py-3 transition-colors focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20">
                    <CardExpiryElement
                      options={{ style: getElementStyle() }}
                      onChange={(e) => {
                        setCardExpiryComplete(e.complete);
                        if (e.error) setError(e.error.message);
                        else if (error) setError(null);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-600">
                    CVC
                  </label>
                  <div className="rounded-md border border-neutral-200 bg-white px-3.5 py-3 transition-colors focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20">
                    <CardCvcElement
                      options={{ style: getElementStyle() }}
                      onChange={(e) => {
                        setCardCvcComplete(e.complete);
                        if (e.error) setError(e.error.message);
                        else if (error) setError(null);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Total due today */}
              {trialEligible && (
                <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="text-sm font-medium text-neutral-600">Total due today</span>
                  <span className="text-lg font-bold text-neutral-900">$1.00</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!stripe || !clientSecret || submitting || !allComplete}
                className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-gold px-8 text-base font-medium text-gold-foreground shadow-sm transition-colors hover:bg-gold/90 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
              >
                {submitting
                  ? "Processing..."
                  : trialEligible
                  ? "Start for $1"
                  : `Subscribe — ${info.price}/${info.period}`
                }
              </button>

              {/* Sub text */}
              <p className="text-center text-xs leading-relaxed text-neutral-500">
                {trialEligible
                  ? <>$1 today. You&apos;ll be billed {info.price}/{info.period} after.</>
                  : <>{info.price}/{info.period} &middot; cancel anytime</>
                }
              </p>
            </form>

            {/* Trust badge */}
            <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
              <Lock className="h-3.5 w-3.5" />
              <span>Secured by Stripe</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
