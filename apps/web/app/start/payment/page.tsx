"use client";

import { useState, FormEvent, useEffect, useCallback } from "react";
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

let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}

export default function PaymentPage() {
  return (
    <>
      <style>{`
        .payment-main { max-width: 440px; }
        .payment-card { max-width: 400px; padding: 28px 24px 32px; }
        .payment-card h2 { font-size: 1.35rem; }
        @media (min-width: 768px) {
          .payment-main { max-width: 540px; display: flex; flex-direction: column; justify-content: center; }
          .payment-card { max-width: 480px; padding: 40px 36px 40px; }
          .payment-card h2 { font-size: 1.6rem; }
        }
      `}</style>
      <Elements stripe={getStripePromise()}>
        <PaymentForm />
      </Elements>
    </>
  );
}

// ─── Style constants ────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: "28px 24px 32px",
  margin: "0 auto",
  maxWidth: 400,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  border: "1.5px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: "14px 16px",
  background: "rgba(255,255,255,0.06)",
  fontSize: "16px",
  fontFamily: "inherit",
  color: "#fff",
  outline: "none",
  boxSizing: "border-box" as const,
  transition: "border-color 0.15s",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "rgba(255,255,255,0.5)",
  marginBottom: 6,
};

const STRIPE_ELEMENT_WRAPPER: React.CSSProperties = {
  border: "1.5px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: "14px 16px",
  background: "rgba(255,255,255,0.06)",
  transition: "border-color 0.15s",
};

const STRIPE_ELEMENT_STYLE = {
  base: {
    fontSize: "16px",
    color: "#fff",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSmoothing: "antialiased",
    "::placeholder": { color: "rgba(255,255,255,0.35)" },
  },
  invalid: { color: "#ff4d4f" },
};

// ─── Main form component ────────────────────────────────────────────────────

function PaymentForm() {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [fullName, setFullName] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);

  const [cardNumberComplete, setCardNumberComplete] = useState(false);
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false);
  const [cardCvcComplete, setCardCvcComplete] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Apple Pay / Google Pay
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canMakePayment, setCanMakePayment] = useState(false);

  const cardAllComplete = fullName.trim().length > 0 && cardNumberComplete && cardExpiryComplete && cardCvcComplete;

  // On mount: ensure we have a session and get SetupIntent
  useEffect(() => {
    async function init() {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No session — redirect back to signup
        router.replace("/signup");
        return;
      }

      try {
        const res = await fetch("/api/start/setup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to set up payment.");
          setLoading(false);
          return;
        }

        const { setupIntentClientSecret } = await res.json();
        setClientSecret(setupIntentClientSecret);
        setLoading(false);
      } catch {
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
    }

    init();
  }, [router]);

  // Initialize Payment Request (Apple Pay / Google Pay)
  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: { label: "Threely Pro — 7-Day Free Trial", amount: 0 },
      requestPayerEmail: false,
      requestPayerName: true,
    });

    pr.canMakePayment().then((result) => {
      if (result && (result.applePay || result.googlePay)) {
        setPaymentRequest(pr);
        setCanMakePayment(true);
      }
    });
  }, [stripe]);

  // Handle Apple Pay / Google Pay payment
  const handleWalletPayment = useCallback(async (ev: any) => {
    if (!stripe || !clientSecret) {
      ev.complete("fail");
      return;
    }

    try {
      const { error: setupError } = await stripe.confirmCardSetup(
        clientSecret,
        { payment_method: ev.paymentMethod.id },
        { handleActions: false }
      );

      if (setupError) {
        ev.complete("fail");
        setError(setupError.message || "Payment setup failed.");
        return;
      }

      ev.complete("success");
      router.push("/start/plan");
    } catch {
      ev.complete("fail");
      setError("Something went wrong. Please try again.");
    }
  }, [stripe, clientSecret, router]);

  useEffect(() => {
    if (!paymentRequest) return;

    paymentRequest.on("paymentmethod", handleWalletPayment);
    return () => { paymentRequest.off("paymentmethod", handleWalletPayment); };
  }, [paymentRequest, handleWalletPayment]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !cardAllComplete || !clientSecret) return;

    setSubmitting(true);
    setError(null);

    try {
      const cardNumber = elements.getElement(CardNumberElement);
      if (!cardNumber) throw new Error("Card element not found.");

      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      const { error: setupError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardNumber,
          billing_details: { name: fullName.trim(), email: session?.user?.email || "" },
        },
      });

      if (setupError) throw new Error(setupError.message || "Card setup failed.");

      router.push("/start/plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: "60px 16px", maxWidth: 440, margin: "0 auto", flex: 1, textAlign: "center" }}>
        <div style={{
          width: 36,
          height: 36,
          border: "3px solid rgba(255,255,255,0.2)",
          borderTopColor: "#fff",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 16px",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>Setting up payment...</p>
      </main>
    );
  }

  return (
    <main className="payment-main" style={{ padding: "24px 16px 60px", margin: "0 auto", flex: 1 }}>
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "#fff" }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.3)" }} />
      </div>

      {/* White card */}
      <div className="payment-card" style={CARD_STYLE}>
        <h2 style={{
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.3px",
          textAlign: "center",
          margin: "0 0 24px",
        }}>
          Add payment method
        </h2>

        {/* ── Total Due Today — prominent ─────────────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, #EEF0FF, #e8f5e9)",
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 20,
          border: "1.5px solid rgba(212,168,67,0.15)",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>
              Total due today
            </span>
            <span style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "#3ecf8e",
              letterSpacing: "-0.5px",
            }}>
              $0.00
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
            7-day free trial &middot; you&apos;ll choose your plan next
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── Apple Pay / Google Pay — big and prominent ──────────────── */}
          {canMakePayment && paymentRequest && (
            <div style={{ marginBottom: 16 }}>
              <PaymentRequestButtonElement
                options={{
                  paymentRequest,
                  style: {
                    paymentRequestButton: {
                      type: "default",
                      theme: "dark",
                      height: "52px",
                    },
                  },
                }}
              />
            </div>
          )}

          {/* ── Enter Card toggle ──────────────────────────────────────── */}
          {!showCardForm ? (
            <button
              type="button"
              onClick={() => setShowCardForm(true)}
              style={{
                width: "100%",
                padding: "14px",
                background: "none",
                border: "1.5px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                marginBottom: 16,
              }}
            >
              {canMakePayment ? "Or enter card manually" : "Enter card details"}
            </button>
          ) : (
            <>
              {/* Divider if wallet pay is showing */}
              {canMakePayment && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  margin: "4px 0 16px",
                }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
                  <span style={{ fontSize: "0.72rem", color: "#8898AA", fontWeight: 500 }}>or pay with card</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
                </div>
              )}

              {/* Name on card */}
              <div style={{ marginBottom: 12 }}>
                <label style={LABEL_STYLE}>Name on card</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  autoComplete="cc-name"
                  style={INPUT_STYLE}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#D4A843"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              </div>

              {/* Card number */}
              <div style={{ marginBottom: 12 }}>
                <label style={LABEL_STYLE}>Card number</label>
                <div style={STRIPE_ELEMENT_WRAPPER}>
                  <CardNumberElement
                    options={{ style: STRIPE_ELEMENT_STYLE, showIcon: true }}
                    onChange={(e) => {
                      setCardNumberComplete(e.complete);
                      if (e.error) setError(e.error.message);
                      else if (error) setError(null);
                    }}
                  />
                </div>
              </div>

              {/* Expiry + CVC */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={LABEL_STYLE}>Expiration</label>
                  <div style={STRIPE_ELEMENT_WRAPPER}>
                    <CardExpiryElement
                      options={{ style: STRIPE_ELEMENT_STYLE }}
                      onChange={(e) => {
                        setCardExpiryComplete(e.complete);
                        if (e.error) setError(e.error.message);
                        else if (error) setError(null);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={LABEL_STYLE}>CVC</label>
                  <div style={STRIPE_ELEMENT_WRAPPER}>
                    <CardCvcElement
                      options={{ style: STRIPE_ELEMENT_STYLE }}
                      onChange={(e) => {
                        setCardCvcComplete(e.complete);
                        if (e.error) setError(e.error.message);
                        else if (error) setError(null);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!stripe || submitting || !cardAllComplete}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: !cardAllComplete ? "rgba(255,255,255,0.12)" : "#D4A843",
                  color: !cardAllComplete ? "#8898AA" : "#fff",
                  border: "none",
                  borderRadius: 14,
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "-0.2px",
                  cursor: submitting ? "wait" : !cardAllComplete ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                  boxShadow: cardAllComplete ? "0 4px 16px rgba(212,168,67,0.3)" : "none",
                  marginBottom: 8,
                }}
              >
                {submitting ? "Processing..." : "Continue"}
              </button>
            </>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: "#FFF0F0",
              color: "#FF4D4F",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: "0.82rem",
              marginBottom: 12,
              marginTop: 8,
              lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}
        </form>

        {/* Trust badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontSize: "0.72rem",
          color: "#8898AA",
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Secured by Stripe</span>
        </div>
      </div>
    </main>
  );
}
