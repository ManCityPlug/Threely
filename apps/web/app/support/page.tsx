import type { Metadata } from "next";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Need help with Threely? Reach out to our support team and we'll get back to you as soon as possible.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0a2540", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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
            Support
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#8898aa" }}>
            We're here to help.
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ flex: 1, padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <p style={{
            fontSize: "1.05rem",
            color: "#425466",
            lineHeight: 1.75,
            marginBottom: "2rem",
          }}>
            Have a question, issue, or feedback? Reach out to us and we'll get back to you as soon as possible.
          </p>

          <a
            href="mailto:support@threely.co"
            style={{
              display: "inline-block",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#fff",
              background: "#635BFF",
              padding: "0.85rem 2.5rem",
              borderRadius: "0.75rem",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            support@threely.co
          </a>

          <p style={{
            fontSize: "0.85rem",
            color: "#8898aa",
            marginTop: "1.5rem",
          }}>
            We typically respond within 24 hours.
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
