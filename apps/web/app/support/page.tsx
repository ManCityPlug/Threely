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
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#e8e8e8", background: "#131F24", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{
        background: "rgba(255,255,255,0.02)",
        padding: "3.5rem 1.5rem 2.5rem",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
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
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.75,
            marginBottom: "2rem",
          }}>
            Have a question, issue, or feedback? Reach out to us and we'll get back to you as soon as possible.
          </p>

          <a
            href="https://go.crisp.chat/chat/embed/?website_id=498b2c8b-bec0-4790-a2bb-795f9c295898"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#000",
              background: "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)",
              padding: "0.85rem 2.5rem",
              borderRadius: "0.75rem",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            Support →
          </a>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
