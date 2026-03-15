"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { subscriptionApi, type SubscriptionDetails } from "@/lib/api-client";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Status Banner ───────────────────────────────────────────────────────────

function StatusBanner({ details }: { details: SubscriptionDetails }) {
  if (details.status === "trialing" && details.trialEnd) {
    const days = daysUntil(details.trialEnd);
    return (
      <div style={{
        padding: "0.875rem 1.25rem", borderRadius: "var(--radius)",
        background: "var(--success-light)", border: "1px solid var(--success)",
        marginBottom: "1.25rem",
      }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)", marginBottom: 2 }}>
          Free trial — {days} day{days !== 1 ? "s" : ""} remaining
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--subtext)" }}>
          Your trial ends on {formatDate(details.trialEnd)}. You won&apos;t be charged until then.
        </div>
      </div>
    );
  }

  if (details.cancelAtPeriodEnd && details.currentPeriodEnd) {
    return (
      <div style={{
        padding: "0.875rem 1.25rem", borderRadius: "var(--radius)",
        background: "var(--warning-light)", border: "1px solid var(--warning)",
        marginBottom: "1.25rem",
      }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)", marginBottom: 2 }}>
          Cancellation pending
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--subtext)" }}>
          Your subscription will end on {formatDate(details.currentPeriodEnd)}. You can reactivate anytime before then.
        </div>
      </div>
    );
  }

  if (details.status === "past_due") {
    return (
      <div style={{
        padding: "0.875rem 1.25rem", borderRadius: "var(--radius)",
        background: "var(--danger-light)", border: "1px solid var(--danger)",
        marginBottom: "1.25rem",
      }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--danger)", marginBottom: 2 }}>
          Payment failed
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--subtext)" }}>
          Please update your payment method to continue using Threely Pro.
        </div>
      </div>
    );
  }

  if (details.status === "active") {
    return (
      <div style={{ marginBottom: "1.25rem" }}>
        <span style={{
          display: "inline-block", padding: "3px 12px", borderRadius: 999,
          background: "var(--success-light)", color: "#059669",
          fontSize: "0.75rem", fontWeight: 600,
        }}>
          Active
        </span>
      </div>
    );
  }

  return null;
}

// ─── Plan Card ───────────────────────────────────────────────────────────────

function PlanCard({
  details,
  onChangePlan,
  changingPlan,
}: {
  details: SubscriptionDetails;
  onChangePlan: (plan: "monthly" | "yearly") => void;
  changingPlan: boolean;
}) {
  const [showSwitcher, setShowSwitcher] = useState(false);
  const currentPlan = details.plan?.name?.toLowerCase() ?? "monthly";
  const alternatePlan = currentPlan === "monthly" ? "yearly" : "monthly";

  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
            Threely Pro — {capitalize(currentPlan)}
          </h3>
          <div style={{ fontSize: "0.85rem", color: "var(--subtext)", marginTop: 4 }}>
            {details.plan ? formatCurrency(details.plan.amount) : "$0.00"}/{details.plan?.interval === "year" ? "year" : "month"}
          </div>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => setShowSwitcher(!showSwitcher)}
          style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
        >
          Change plan
        </button>
      </div>

      {details.currentPeriodEnd && !details.cancelAtPeriodEnd && (
        <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          Next billing date: {formatDate(details.currentPeriodEnd)}
        </div>
      )}

      {showSwitcher && (
        <div style={{
          marginTop: 12, padding: "0.875rem", borderRadius: "var(--radius-sm)",
          background: "var(--bg)", border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text)", marginBottom: 8 }}>
            Switch to <strong>{capitalize(alternatePlan)}</strong>
            {alternatePlan === "yearly"
              ? " — save ~$86/year"
              : " — more flexibility"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 12 }}>
            The price difference will be prorated on your next invoice.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                onChangePlan(alternatePlan as "monthly" | "yearly");
                setShowSwitcher(false);
              }}
              disabled={changingPlan}
              style={{ fontSize: "0.8rem", padding: "0.4rem 1rem" }}
            >
              {changingPlan ? "Switching…" : `Switch to ${capitalize(alternatePlan)}`}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setShowSwitcher(false)}
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payment Method Card ─────────────────────────────────────────────────────

function PaymentMethodCard({
  details,
  onUpdateComplete,
}: {
  details: SubscriptionDetails;
  onUpdateComplete: (pm: SubscriptionDetails["paymentMethod"]) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
          Payment method
        </h3>
        <button
          className="btn btn-outline"
          onClick={() => setShowForm(!showForm)}
          style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
        >
          {showForm ? "Cancel" : "Update card"}
        </button>
      </div>

      {details.paymentMethod ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.85rem", color: "var(--subtext)" }}>
          <span style={{
            display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)",
            background: "var(--bg)", border: "1px solid var(--border)",
            fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase",
          }}>
            {details.paymentMethod.brand}
          </span>
          <span>•••• {details.paymentMethod.last4}</span>
          <span style={{ color: "var(--muted)" }}>
            Exp {String(details.paymentMethod.expMonth).padStart(2, "0")}/{details.paymentMethod.expYear}
          </span>
        </div>
      ) : (
        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          No payment method on file
        </div>
      )}

      {showForm && (
        <div style={{ marginTop: 16 }}>
          <Elements stripe={stripePromise}>
            <UpdateCardForm
              onSuccess={(pm) => {
                onUpdateComplete(pm);
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          </Elements>
        </div>
      )}
    </div>
  );
}

// ─── Update Card Form (inside Stripe Elements) ──────────────────────────────

function UpdateCardForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (pm: SubscriptionDetails["paymentMethod"]) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      // Create SetupIntent on server
      const { clientSecret } = await subscriptionApi.updatePayment();

      const cardElement = elements.getElement(CardNumberElement);
      if (!cardElement) throw new Error("Card element not found");

      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: fullName.trim() || undefined },
        },
      });

      if (stripeError) {
        setError(stripeError.message ?? "Card verification failed");
        return;
      }

      if (!setupIntent?.payment_method) {
        setError("Card setup failed");
        return;
      }

      // Attach new payment method on server
      const pmId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

      const { paymentMethod } = await subscriptionApi.confirmPaymentUpdate(pmId);
      onSuccess(paymentMethod);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update card");
    } finally {
      setLoading(false);
    }
  };

  const elementStyle = {
    base: {
      fontSize: "14px",
      color: "#0a2540",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      "::placeholder": { color: "#8898aa" },
    },
    invalid: { color: "#ff4d4f" },
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--subtext)", display: "block", marginBottom: 4 }}>
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
              padding: "0.6rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: "14px",
              fontFamily: 'var(--font)',
              color: "var(--text)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--subtext)", display: "block", marginBottom: 4 }}>
            Card number
          </label>
          <div style={{
            padding: "0.6rem 0.75rem", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--card)",
          }}>
            <CardNumberElement options={{ style: elementStyle }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--subtext)", display: "block", marginBottom: 4 }}>
              Expiry
            </label>
            <div style={{
              padding: "0.6rem 0.75rem", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", background: "var(--card)",
            }}>
              <CardExpiryElement options={{ style: elementStyle }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--subtext)", display: "block", marginBottom: 4 }}>
              CVC
            </label>
            <div style={{
              padding: "0.6rem 0.75rem", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", background: "var(--card)",
            }}>
              <CardCvcElement options={{ style: elementStyle }} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: "0.8rem", color: "var(--danger)", marginTop: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !stripe}
          style={{ fontSize: "0.8rem", padding: "0.45rem 1rem" }}
        >
          {loading ? "Saving…" : "Save card"}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={onCancel}
          style={{ fontSize: "0.8rem", padding: "0.45rem 0.75rem" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Invoice History ─────────────────────────────────────────────────────────

function InvoiceHistory({ invoices }: { invoices: SubscriptionDetails["invoices"] }) {
  if (!invoices || invoices.length === 0) return null;

  const statusStyle = (status: string | null) => {
    if (status === "paid") return { bg: "var(--success-light)", color: "#059669" };
    if (status === "open") return { bg: "var(--warning-light)", color: "#d97706" };
    return { bg: "var(--danger-light)", color: "var(--danger)" };
  };

  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", margin: 0, marginBottom: 12 }}>
        Invoice history
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {invoices.map((inv) => {
          const s = statusStyle(inv.status);
          return (
            <div
              key={inv.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.6rem 0", borderBottom: "1px solid var(--border)",
                fontSize: "0.825rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "var(--subtext)", minWidth: 90 }}>
                  {inv.date ? formatDate(inv.date) : "—"}
                </span>
                <span style={{ fontWeight: 500, color: "var(--text)" }}>
                  {formatCurrency(inv.amount, inv.currency)}
                </span>
              </div>
              <span style={{
                display: "inline-block", padding: "1px 8px", borderRadius: 999,
                background: s.bg, color: s.color,
                fontSize: "0.7rem", fontWeight: 600,
              }}>
                {capitalize(inv.status ?? "unknown")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cancel / Reactivate Section ─────────────────────────────────────────────

function CancelSection({
  details,
  onCancel,
  onReactivate,
  cancelling,
  reactivating,
}: {
  details: SubscriptionDetails;
  onCancel: () => void;
  onReactivate: () => void;
  cancelling: boolean;
  reactivating: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (details.cancelAtPeriodEnd) {
    return (
      <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", margin: 0, marginBottom: 8 }}>
          Reactivate subscription
        </h3>
        <p style={{ fontSize: "0.825rem", color: "var(--subtext)", marginBottom: 12 }}>
          Your subscription is set to cancel on {formatDate(details.currentPeriodEnd!)}. Reactivate to continue using Threely Pro.
        </p>
        <button
          className="btn btn-primary"
          onClick={onReactivate}
          disabled={reactivating}
          style={{ fontSize: "0.8rem", padding: "0.45rem 1rem" }}
        >
          {reactivating ? "Reactivating…" : "Reactivate subscription"}
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", margin: 0, marginBottom: 8 }}>
        Cancel subscription
      </h3>
      {!showConfirm ? (
        <button
          className="btn btn-outline"
          onClick={() => setShowConfirm(true)}
          style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem", color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          Cancel subscription
        </button>
      ) : (
        <div style={{
          padding: "0.875rem", borderRadius: "var(--radius-sm)",
          background: "var(--danger-light)", border: "1px solid var(--danger)",
        }}>
          <p style={{ fontSize: "0.825rem", color: "var(--text)", marginBottom: 12, fontWeight: 500 }}>
            Are you sure? Your access will continue until {details.currentPeriodEnd ? formatDate(details.currentPeriodEnd) : "the end of your billing period"}.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn"
              onClick={() => {
                onCancel();
                setShowConfirm(false);
              }}
              disabled={cancelling}
              style={{
                fontSize: "0.8rem", padding: "0.4rem 1rem",
                background: "var(--danger)", color: "#fff",
              }}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel"}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setShowConfirm(false)}
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
            >
              Never mind
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const router = useRouter();
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  const fetchDetails = useCallback(async () => {
    try {
      const data = await subscriptionApi.details();
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await subscriptionApi.cancel();
      await fetchDetails();
    } catch {
      // error handled by refetch
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      await subscriptionApi.reactivate();
      await fetchDetails();
    } catch {
      // error handled by refetch
    } finally {
      setReactivating(false);
    }
  };

  const handleChangePlan = async (plan: "monthly" | "yearly") => {
    setChangingPlan(true);
    try {
      await subscriptionApi.changePlan(plan);
      await fetchDetails();
    } catch {
      // error handled by refetch
    } finally {
      setChangingPlan(false);
    }
  };

  const handlePaymentUpdate = (pm: SubscriptionDetails["paymentMethod"]) => {
    if (details) {
      setDetails({ ...details, paymentMethod: pm });
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
          <button onClick={() => router.push("/profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
            Subscription
          </h1>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem 0" }}>
          <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
          <button onClick={() => router.push("/profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
            Subscription
          </h1>
        </div>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => { setError(null); setLoading(true); fetchDetails(); }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Managed externally (RevenueCat) ────────────────────────────────────────
  if (details && "managedExternally" in details && details.managedExternally) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
          <button onClick={() => router.push("/profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
            Subscription
          </h1>
        </div>
        <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
            Manage your subscription at threely.co
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--subtext)", marginBottom: 16 }}>
            Your subscription can be managed on the web. Visit threely.co to update your plan, payment method, or cancel.
          </p>
          <a
            href="https://threely.co/subscription"
            className="btn btn-primary"
            style={{ fontSize: "0.85rem", padding: "0.5rem 1.5rem", textDecoration: "none" }}
          >
            Manage subscription
          </a>
        </div>
      </div>
    );
  }

  // ── No subscription ────────────────────────────────────────────────────────
  if (!details || !details.status) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
          <button onClick={() => router.push("/profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
            Subscription
          </h1>
        </div>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
            No active subscription
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--subtext)", marginBottom: 16 }}>
            Subscribe to Threely Pro to unlock unlimited goals, AI coaching, and more.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/profile")}
            style={{ fontSize: "0.85rem", padding: "0.5rem 1.5rem" }}
          >
            Subscribe to Pro
          </button>
        </div>
      </div>
    );
  }

  // ── Active subscription ────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
        <button onClick={() => router.push("/profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Subscription
        </h1>
      </div>

      <StatusBanner details={details} />
      <PlanCard details={details} onChangePlan={handleChangePlan} changingPlan={changingPlan} />
      <PaymentMethodCard details={details} onUpdateComplete={handlePaymentUpdate} />
      <InvoiceHistory invoices={details.invoices} />
      <CancelSection
        details={details}
        onCancel={handleCancel}
        onReactivate={handleReactivate}
        cancelling={cancelling}
        reactivating={reactivating}
      />
    </div>
  );
}
