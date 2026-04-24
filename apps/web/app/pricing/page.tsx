import type { Metadata } from "next";
import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import CheckoutButton from "@/components/CheckoutButton";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start Threely Pro for $1 today. Then $39/month after your 3-day Launch Preview. Brand, logo, product direction, Shopify setup, launch roadmap, and weekly ad creatives included.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Threely Pricing — $1 Launch Preview",
    description: "Start Threely Pro for $1. Your 3-day Launch Preview includes brand, logo, product direction, and Shopify setup. Then $39/month.",
  },
};

const INCLUDED = [
  "Business name + logo direction",
  "Product/niche recommendation",
  "Shopify store template + setup",
  "Launch roadmap",
  "Today's Move dashboard + mobile app",
  "Weekly static ad creatives after activation",
  "Growth dashboard",
];

export default function PricingPage() {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#e8e8e8", background: "#141414" }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{
        background: "radial-gradient(ellipse at 50% 0%, rgba(212,168,67,0.08) 0%, transparent 60%)",
        padding: "4.5rem 1.5rem 3.5rem",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1 style={{
            fontSize: "clamp(2rem, 5vw, 3rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            marginBottom: "1rem",
          }}>
            Pricing
          </h1>
          <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.7 }}>
            One plan. $1 to start. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Single plan card — Threely Pro */}
      <section style={{ padding: "3.5rem 1.5rem", background: "#141414" }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <div style={{
            padding: "2.5rem 1.75rem",
            borderRadius: 20,
            border: "2px solid #D4A843",
            background: "linear-gradient(135deg, rgba(212,168,67,0.07) 0%, rgba(212,168,67,0.02) 100%)",
            position: "relative",
            boxShadow: "0 8px 40px rgba(212,168,67,0.15)",
          }}>
            <div style={{
              position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
              background: "linear-gradient(135deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)", color: "#000",
              padding: "4px 16px", borderRadius: 20,
              fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}>
              $1 LAUNCH PREVIEW
            </div>

            <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", color: "#D4A843", textTransform: "uppercase", marginBottom: 10, marginTop: 8 }}>
              Threely Pro
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: "clamp(2.5rem, 8vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>$1</span>
              <span style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.7)" }}>today</span>
            </div>

            <p style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.75)", marginBottom: "1.5rem", lineHeight: 1.55 }}>
              Build your business preview today. Continue with Threely Pro at <strong style={{ color: "#fff" }}>$39/month</strong> after your 3-day Launch Preview.
            </p>

            <CheckoutButton plan="monthly" style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              padding: "0.95rem 1.5rem",
              background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)",
              color: "#000",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: "1rem",
              boxShadow: "0 4px 14px rgba(212,168,67,0.3)",
            }}>
              Start My Launch Preview
            </CheckoutButton>

            <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 14, textAlign: "center", lineHeight: 1.5 }}>
              Cancel anytime during your 3-day preview and you won&apos;t be charged.
            </p>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section style={{ padding: "3.5rem 1.5rem", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.3rem, 3.5vw, 1.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
            marginBottom: "2rem",
          }}>
            What Threely Pro includes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {INCLUDED.map((f, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "0.85rem 1.15rem",
                background: "rgba(212,168,67,0.05)",
                border: "1px solid rgba(212,168,67,0.15)",
                borderRadius: 12,
              }}>
                <span style={{ color: "#D4A843", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: "1rem", color: "#fff", lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.82rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            Your first full weekly creative drop unlocks when your Pro plan activates after the $1 preview.
          </p>
        </div>
      </section>

      {/* Billing FAQ */}
      <section style={{ padding: "3.5rem 1.5rem", background: "#141414" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.3rem, 3.5vw, 1.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
            marginBottom: "2rem",
          }}>
            Billing questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {[
              { q: "What exactly is the $1 Launch Preview?", a: "3 days of access to your personalized preview: brand name, logo direction, product recommendation, Shopify setup, launch roadmap, and sample ad concepts. After 3 days, your Threely Pro subscription activates at $39/month." },
              { q: "Can I cancel anytime?", a: "Yes. Cancel during your 3-day preview and you won't be charged anything beyond the $1. After activation, cancel any time from your account — you keep access until the end of your billing period." },
              { q: "Is there a refund policy?", a: "Yes. 14-day no-questions-asked refund on your first Pro charge. Email refund@threely.co and we'll refund in full.", link: "/refund", linkText: "View Refund Policy" },
            ].map(item => (
              <div key={item.q} style={{
                background: "rgba(255,255,255,0.02)",
                borderRadius: 14,
                padding: "1.25rem 1.5rem",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>{item.q}</h3>
                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.7 }}>{item.a}</p>
                {"link" in item && item.link && (
                  <Link href={item.link} style={{
                    display: "inline-block",
                    marginTop: 12,
                    padding: "0.5rem 1.15rem",
                    background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)",
                    color: "#fff",
                    borderRadius: 8,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}>
                    {item.linkText} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>


      <MarketingFooter />
    </div>
  );
}
