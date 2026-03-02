"use client";

import { useState } from "react";
import { type PaywallVariant } from "@/lib/subscription-context";

type Plan = "monthly" | "yearly";

const PLANS: { key: Plan; name: string; price: string; sub: string; badge?: string }[] = [
  { key: "yearly", name: "Yearly", price: "$69.99", sub: "$5.83/mo \u00B7 billed annually", badge: "SAVE 55%" },
  { key: "monthly", name: "Monthly", price: "$12.99", sub: "per month" },
];

interface PaywallModalProps {
  variant?: PaywallVariant;
  onClose: () => void;
}

export default function PaywallModal({ variant = "sheet", onClose }: PaywallModalProps) {
  const [plan, setPlan] = useState<Plan>("yearly");
  const selectedPlan = PLANS.find((p) => p.key === plan)!;

  if (variant === "fullscreen") {
    return <FullScreenPaywall plan={plan} setPlan={setPlan} selectedPlan={selectedPlan} onClose={onClose} />;
  }

  return <SheetPaywall plan={plan} setPlan={setPlan} selectedPlan={selectedPlan} onClose={onClose} />;
}

// ── Full-screen variant (post-onboarding) ─────────────────────────────────────
function FullScreenPaywall({
  plan, setPlan, selectedPlan, onClose,
}: {
  plan: Plan;
  setPlan: (p: Plan) => void;
  selectedPlan: (typeof PLANS)[number];
  onClose: () => void;
}) {
  function handleCheckout() {
    window.location.href = `/checkout?plan=${plan}`;
  }

  return (
    <div className="paywall-fullscreen">
      {/* Close button */}
      <button className="paywall-close-btn" onClick={onClose} aria-label="Close">
        {"\u2715"}
      </button>

      {/* Icon */}
      <div className="paywall-icon-wrap">
        <span className="paywall-icon">{"\u2726"}</span>
      </div>

      <h2 className="paywall-heading">
        Get Threely Pro<br />
        <strong>free for 7 days</strong>
      </h2>
      <p className="paywall-subheading">
        We offer 7 days free so everyone can achieve their goals.
        You'll get a reminder 2 days before your free period ends.
      </p>

      {/* Plan selector */}
      <div className="paywall-plans">
        {PLANS.map((p) => (
          <button
            key={p.key}
            className={`paywall-plan-card ${plan === p.key ? "selected" : ""}`}
            onClick={() => setPlan(p.key)}
          >
            <div className="paywall-plan-row">
              <div className={`paywall-plan-radio ${plan === p.key ? "active" : ""}`}>
                {plan === p.key && <div className="paywall-plan-radio-dot" />}
              </div>
              <div className="paywall-plan-info">
                <div className="paywall-plan-name-row">
                  <span className="paywall-plan-name">{p.name}</span>
                  {p.badge && <span className="paywall-plan-badge">{p.badge}</span>}
                </div>
                <span className="paywall-plan-sub">{p.sub}</span>
              </div>
              <span className="paywall-plan-price">{p.price}</span>
            </div>
            <span className="paywall-plan-trial">7 days free</span>
          </button>
        ))}
      </div>

      {/* CTA */}
      <button
        className="paywall-cta-btn"
        onClick={handleCheckout}
      >
        Get Pro Free
      </button>
      <p className="paywall-cta-sub">
        7 days free &middot; then {selectedPlan.price}/{plan === "yearly" ? "year" : "month"}
      </p>

      {/* Footer */}
      <div className="paywall-footer">
        <div className="paywall-legal">
          <a href="https://threely.co/terms" target="_blank" rel="noopener noreferrer">Terms</a>
          {" \u00B7 "}
          <a href="https://threely.co/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
          {" \u00B7 "}
          <a href="https://threely.co/refund" target="_blank" rel="noopener noreferrer">Refund</a>
        </div>
      </div>
    </div>
  );
}

// ── Sheet variant (blocked actions) ──────────────────────────────────────────
function SheetPaywall({
  plan, setPlan, selectedPlan, onClose,
}: {
  plan: Plan;
  setPlan: (p: Plan) => void;
  selectedPlan: (typeof PLANS)[number];
  onClose: () => void;
}) {
  function handleCheckout() {
    window.location.href = `/checkout?plan=${plan}`;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: 440, width: "100%", position: "relative", padding: "2rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 12, right: 12,
            background: "none", border: "none", cursor: "pointer",
            fontSize: "1.25rem", color: "var(--muted)", lineHeight: 1,
            width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "50%", transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          aria-label="Close"
        >
          {"\u2715"}
        </button>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "var(--primary-light)", color: "var(--primary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, marginBottom: 12,
          }}>
            {"\u2726"}
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
            Unlock this with Threely Pro
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--subtext)" }}>
            10x your productivity and actually reach your goals.
          </p>
        </div>

        {/* Plan selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.25rem" }}>
          {PLANS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlan(p.key)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius)",
                border: plan === p.key ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                background: plan === p.key ? "var(--primary-light)" : "var(--card)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                width: "100%",
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: "0.9rem", fontWeight: 600,
                    color: plan === p.key ? "var(--primary)" : "var(--text)",
                  }}>
                    {p.name}
                  </span>
                  {p.badge && (
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 700, color: "#fff",
                      background: "var(--primary)",
                      padding: "1px 7px", borderRadius: 10, letterSpacing: "0.03em",
                    }}>
                      {p.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{p.sub}</span>
              </div>
              <span style={{
                fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.02em",
                color: plan === p.key ? "var(--primary)" : "var(--text)",
              }}>
                {p.price}
              </span>
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          className="btn btn-primary"
          onClick={handleCheckout}
          style={{
            width: "100%", textAlign: "center", padding: "0.75rem",
            fontSize: "0.95rem", display: "block",
            marginBottom: "0.75rem",
          }}
        >
          Get Pro Free
        </button>

        <p style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", marginBottom: "0.75rem" }}>
          7 days free &middot; then {selectedPlan.price}/{plan === "yearly" ? "year" : "month"}
        </p>

        {/* Dismiss */}
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--subtext)", fontSize: "0.875rem", fontWeight: 500,
            display: "block", margin: "0 auto", padding: "0.5rem",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
