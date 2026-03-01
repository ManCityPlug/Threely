import type { Metadata } from "next";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Refund Policy — Threely",
  description:
    "Threely refund policy. Request a full refund within 7 days of your paid subscription — no questions asked.",
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  const h2Style = {
    fontSize: "1.2rem" as const,
    fontWeight: 700 as const,
    letterSpacing: "-0.02em" as const,
    marginTop: "2rem" as const,
    marginBottom: "0.75rem" as const,
  };

  const pStyle = {
    fontSize: "0.925rem" as const,
    color: "#425466" as const,
    lineHeight: 1.75 as const,
    marginBottom: "0.75rem" as const,
  };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0a2540", background: "#fff" }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{
        background: "#f6f9fc",
        padding: "3.5rem 1.5rem 2.5rem",
        borderBottom: "1px solid #e3e8ef",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h1 style={{
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginBottom: "0.5rem",
          }}>
            Refund Policy
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#8898aa" }}>
            Last updated: February 28, 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: "2.5rem 1.5rem 4rem" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>

          {/* Highlight box */}
          <div style={{
            background: "#f0edff",
            border: "1px solid #d9d4ff",
            borderRadius: 14,
            padding: "1.5rem",
            marginBottom: "2rem",
          }}>
            <p style={{ fontSize: "1rem", color: "#0a2540", lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
              Not happy with Threely? Email us at{" "}
              <a href="mailto:refund@threely.co" style={{ color: "#635bff", fontWeight: 700, textDecoration: "none" }}>
                refund@threely.co
              </a>{" "}
              within <strong>7 days</strong> of your first paid charge for a full refund. No questions asked.
            </p>
          </div>

          <h2 style={h2Style}>7-Day Refund Window</h2>
          <p style={pStyle}>
            If you are unsatisfied with Threely for any reason, you may request a full refund within 7 days of your first paid subscription charge. This applies to all plans — monthly and yearly.
          </p>
          <p style={pStyle}>
            Refunds are not available after the 7-day window has passed. Your subscription start date is the date your first payment was charged, not the start of your free trial.
          </p>

          <h2 style={h2Style}>How to Request a Refund</h2>
          <p style={pStyle}>
            Send an email to{" "}
            <a href="mailto:refund@threely.co" style={{ color: "#635bff", fontWeight: 600, textDecoration: "none" }}>
              refund@threely.co
            </a>{" "}
            with the email address associated with your Threely account. Include the reason for your refund request so we can improve.
          </p>

          <h2 style={h2Style}>Processing Time</h2>
          <p style={pStyle}>
            Refunds are typically processed within 2–3 business days. The refund will be returned to the original payment method. Depending on your bank, it may take an additional 5–10 business days for the refund to appear on your statement.
          </p>

          <h2 style={h2Style}>Cancellation</h2>
          <p style={pStyle}>
            You can cancel your subscription at any time from your profile settings in the app. When you cancel, you retain access to all paid features until the end of your current billing period. No further charges will be made after cancellation.
          </p>

          <h2 style={h2Style}>Contact</h2>
          <p style={pStyle}>
            For refund requests:{" "}
            <a href="mailto:refund@threely.co" style={{ color: "#635bff", fontWeight: 600, textDecoration: "none" }}>
              refund@threely.co
            </a>
          </p>
          <p style={pStyle}>
            For general support:{" "}
            <a href="mailto:support@threely.co" style={{ color: "#635bff", fontWeight: 600, textDecoration: "none" }}>
              support@threely.co
            </a>
          </p>

        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
