"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

type Plan = "monthly" | "yearly";

const PLAN_INFO: Record<Plan, { name: string; price: string; period: string; perMonth: string; badge?: string }> = {
  yearly: { name: "Yearly", price: "$99.99", period: "year", perMonth: "$8.33/mo", badge: "SAVE 36%" },
  monthly: { name: "Monthly", price: "$12.99", period: "month", perMonth: "$12.99/mo" },
};

const FEATURES = [
  "10x your productivity",
  "Reach your goals",
];

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}

function getTrialEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)",
      }}>
        <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
      </div>
    }>
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
  const isDark = typeof window !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
  return {
    base: {
      fontSize: "16px",
      color: isDark ? "#e4e8ee" : "#0a2540",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSmoothing: "antialiased",
      "::placeholder": { color: isDark ? "#6b7280" : "#8898aa" },
    },
    invalid: { color: "#ff4d4f" },
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

      // If user expected a trial but card fingerprint blocked it, let them know
      if (trialEligible && confirmData.trialGranted === false) {
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
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)",
      }}>
        <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>
      {/* Header */}
      <header style={{
        padding: "0.875rem 1.5rem",
        borderBottom: "1px solid var(--border)",
        background: "var(--card)",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
      }}>
        <div />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/favicon.png" alt="Threely" width={30} height={30} style={{ borderRadius: 8 }} />
          <span style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.02em", color: "var(--text)" }}>
            Threely
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--subtext)", fontSize: "0.85rem", fontWeight: 500,
            }}
          >
            Cancel
          </button>
        </div>
      </header>

      {/* Content */}
      <div style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "2rem 1rem 3rem",
      }}>
        {/* ── Product summary bar ──────────────────────────────────────── */}
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.25rem",
        }}>
          {/* Plan name + price row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/favicon.png" alt="Threely" width={38} height={38} style={{ borderRadius: 10, flexShrink: 0 }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, lineHeight: 1.2 }}>
                  <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", letterSpacing: "-0.02em" }}>
                    Threely Pro — {info.name}
                  </span>
                  {info.badge && (
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 700, color: "#fff",
                      background: "var(--primary)", padding: "2px 8px", borderRadius: 10,
                      letterSpacing: "0.03em",
                    }}>
                      {info.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--subtext)", lineHeight: 1.2, marginTop: 1, display: "block" }}>
                  {info.perMonth} billed {plan === "yearly" ? "annually" : "monthly"}
                </span>
              </div>
            </div>
            <span style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--text)", letterSpacing: "-0.02em" }}>
              {info.price}
            </span>
          </div>

          {/* Features — horizontal chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FEATURES.map((f) => (
              <span key={f} style={{
                fontSize: "0.7rem", color: "var(--primary)", background: "var(--primary-light)",
                padding: "3px 10px", borderRadius: 20, fontWeight: 500,
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* ── Plan toggle ────────────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 8, marginBottom: "1.25rem",
        }}>
          {(["yearly", "monthly"] as const).map((p) => {
            const active = plan === p;
            const label = p === "yearly" ? "Yearly — $99.99/yr" : "Monthly — $12.99/mo";
            return (
              <button
                key={p}
                onClick={() => onChangePlan(p)}
                style={{
                  flex: 1,
                  padding: "0.75rem 0.5rem",
                  borderRadius: "var(--radius)",
                  border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                  background: active ? "var(--primary-light)" : "var(--card)",
                  color: active ? "var(--primary)" : "var(--subtext)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "center",
                }}
              >
                {label}
                {p === "yearly" && (
                  <span style={{
                    display: "block", fontSize: "0.68rem", fontWeight: 500,
                    color: active ? "var(--primary)" : "var(--muted)",
                    marginTop: 2,
                  }}>
                    Save 36%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Trial info banner ────────────────────────────────────────── */}
        {trialEligible && (
          <>
            {/* Light mode banner */}
            <div className="light-only" style={{
              background: "linear-gradient(135deg, var(--primary-light), #e8f5e9)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "1rem 1.25rem",
              marginBottom: "1.25rem",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                7 days free
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--subtext)", lineHeight: 1.5 }}>
                Your trial starts today. You won&apos;t be charged until <strong>{getTrialEndDate()}</strong>.
                <br />Cancel anytime in Settings — no questions asked.
              </div>
            </div>
            {/* Dark mode banner */}
            <div className="dark-only" style={{
              background: "linear-gradient(135deg, #4338ca, #635BFF, #7c6fff)",
              borderRadius: "var(--radius)",
              padding: "1rem 1.25rem",
              marginBottom: "1.25rem",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                7 days free
              </div>
              <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
                Your trial starts today. You won&apos;t be charged until <strong style={{ color: "#fff" }}>{getTrialEndDate()}</strong>.
                <br />Cancel anytime in Settings — no questions asked.
              </div>
            </div>
          </>
        )}

        {/* ── Payment form card ────────────────────────────────────────── */}
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "1.5rem",
        }}>
          <h3 style={{
            fontSize: "0.95rem", fontWeight: 700, color: "var(--text)",
            letterSpacing: "-0.02em", marginBottom: "1.25rem",
          }}>
            Payment details
          </h3>

          <form onSubmit={handleSubmit}>
            {/* Full name */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{
                display: "block", fontSize: "0.8rem", fontWeight: 600,
                color: "var(--subtext)", marginBottom: 6,
              }}>
                Name on card
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Smith"
                autoComplete="cc-name"
                style={{
                  width: "100%",
                  border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.75rem 0.875rem",
                  background: "var(--bg)",
                  fontSize: "16px",
                  fontFamily: 'var(--font)',
                  color: "var(--text)",
                  outline: "none",
                  transition: "border-color 0.15s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              />
            </div>

            {/* Card number */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{
                display: "block", fontSize: "0.8rem", fontWeight: 600,
                color: "var(--subtext)", marginBottom: 6,
              }}>
                Card number
              </label>
              <div style={{
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.75rem 0.875rem",
                background: "var(--bg)",
                transition: "border-color 0.15s",
              }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8rem", fontWeight: 600,
                  color: "var(--subtext)", marginBottom: 6,
                }}>
                  Expiration
                </label>
                <div style={{
                  border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.75rem 0.875rem",
                  background: "var(--bg)",
                  transition: "border-color 0.15s",
                }}>
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
                <label style={{
                  display: "block", fontSize: "0.8rem", fontWeight: 600,
                  color: "var(--subtext)", marginBottom: 6,
                }}>
                  CVC
                </label>
                <div style={{
                  border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.75rem 0.875rem",
                  background: "var(--bg)",
                  transition: "border-color 0.15s",
                }}>
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
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "0.7rem 1rem", marginBottom: "1.25rem",
                borderRadius: "var(--radius)", background: "var(--bg)",
                border: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: "0.85rem", color: "var(--subtext)", fontWeight: 500 }}>Total due today</span>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#3ecf8e" }}>$0.00</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                background: "var(--danger-light)", color: "var(--danger)",
                borderRadius: "var(--radius-sm)", padding: "0.6rem 0.75rem",
                fontSize: "0.8rem", marginBottom: "1rem",
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!stripe || !clientSecret || submitting || !allComplete}
              style={{
                width: "100%",
                padding: "0.875rem",
                background: (!stripe || !clientSecret || !allComplete) ? "var(--muted)" : "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius)",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: submitting ? "wait" : (!stripe || !clientSecret || !allComplete) ? "not-allowed" : "pointer",
                transition: "background 0.15s, transform 0.1s",
                marginBottom: "0.75rem",
              }}
            >
              {submitting
                ? "Processing..."
                : trialEligible
                ? "Start Free Trial"
                : `Subscribe — ${info.price}/${info.period}`
              }
            </button>

            {/* Sub text */}
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
              {trialEligible
                ? <>Your card will not be charged today. After your 7-day trial, you&apos;ll be billed {info.price}/{info.period}.</>
                : <>{info.price}/{info.period} &middot; cancel anytime</>
              }
            </p>
          </form>

          {/* Trust badge + back */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, fontSize: "0.75rem", color: "var(--muted)", marginTop: "1.25rem",
            paddingTop: "1rem", borderTop: "1px solid var(--border)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Secured by Stripe</span>
          </div>
        </div>
      </div>
    </div>
  );
}
