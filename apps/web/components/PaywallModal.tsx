"use client";

const FEATURES = [
  { icon: "\u2728", text: "AI-powered tasks tailored to your goals" },
  { icon: "\u267E\uFE0F", text: "Unlimited goals & daily task generation" },
  { icon: "\uD83D\uDCCA", text: "Progress tracking & full history" },
  { icon: "\uD83D\uDD14", text: "Daily reminders at your chosen time" },
  { icon: "\uD83D\uDD04", text: "Generate new tasks as you complete them" },
];

const PLANS = [
  { name: "Yearly", price: "$59.99", sub: "$4.99/mo \u00B7 billed annually", badge: "BEST VALUE \u00B7 SAVE 58%" },
  { name: "Quarterly", price: "$23.99", sub: "$7.99/mo \u00B7 billed quarterly", badge: "SAVE 33%" },
  { name: "Monthly", price: "$11.99", sub: "per month" },
];

export default function PaywallModal({ onClose }: { onClose: () => void }) {
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
            Your free trial has ended
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--subtext)" }}>
            Subscribe to keep your momentum going
          </p>
        </div>

        {/* Features */}
        <div style={{
          background: "var(--bg)", borderRadius: "var(--radius)",
          padding: "0.875rem 1rem", marginBottom: "1.25rem",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {FEATURES.map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.825rem", color: "var(--text)" }}>
              <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: "center" }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.25rem" }}>
          {PLANS.map((plan) => (
            <a
              key={plan.name}
              href="/pricing"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius)",
                border: plan.name === "Yearly" ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                background: plan.name === "Yearly" ? "var(--primary-light)" : "var(--card)",
                textDecoration: "none", cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: "0.9rem", fontWeight: 600,
                    color: plan.name === "Yearly" ? "var(--primary)" : "var(--text)",
                  }}>
                    {plan.name}
                  </span>
                  {plan.badge && (
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 700, color: "#fff",
                      background: plan.name === "Yearly" ? "var(--primary)" : "var(--success)",
                      padding: "1px 7px", borderRadius: 10, letterSpacing: "0.03em",
                    }}>
                      {plan.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{plan.sub}</span>
              </div>
              <span style={{
                fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.02em",
                color: plan.name === "Yearly" ? "var(--primary)" : "var(--text)",
              }}>
                {plan.price}
              </span>
            </a>
          ))}
        </div>

        {/* CTA */}
        <a
          href="/pricing"
          className="btn btn-primary"
          style={{
            width: "100%", textAlign: "center", padding: "0.75rem",
            fontSize: "0.95rem", textDecoration: "none", display: "block",
          }}
        >
          View plans {"\u2192"}
        </a>
      </div>
    </div>
  );
}
