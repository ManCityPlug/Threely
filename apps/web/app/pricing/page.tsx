import type { Metadata } from "next";
import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Pricing — Threely AI Goal Coach",
  description:
    "Threely pricing: start with a free 3-day trial, then choose monthly, quarterly, or yearly. AI-powered goal coaching with personalized daily tasks, coaching insights, and progress tracking.",
  alternates: { canonical: "/pricing" },
};

const FEATURES = [
  "3 AI-generated tasks per goal per day",
  "Personalized coaching insights after every review",
  "Unlimited goals — fitness, career, learning, creative",
  "Daily difficulty calibration based on your feedback",
  "Schedule-aware tasks (15 min to 2+ hours/day)",
  "Progress tracking and streaks",
  "iOS and Android apps",
  "Weekly summary reports",
];

export default function PricingPage() {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0a2540", background: "#fff" }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{
        background: "linear-gradient(135deg, #f6f9fc 0%, #ede9ff 100%)",
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
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: "1.05rem", color: "#425466", lineHeight: 1.7 }}>
            Start free for 3 days. No credit card required. Upgrade when you&apos;re ready.
          </p>
        </div>
      </section>

      {/* Pricing cards — 3 tiers */}
      <section style={{ padding: "3.5rem 1.5rem", background: "#fff" }}>
        <div style={{
          maxWidth: 900,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.5rem",
          alignItems: "start",
        }}>
          {/* Monthly */}
          <div style={{
            padding: "2rem 1.5rem",
            borderRadius: 16,
            border: "1px solid #e3e8ef",
            background: "#fff",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#635bff", textTransform: "uppercase", marginBottom: 8 }}>
              MONTHLY
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>$11.99</span>
              <span style={{ fontSize: "0.9rem", color: "#8898aa" }}>/month</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#425466", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              Full AI coaching. Cancel anytime.<br />3-day free trial included.
            </p>
            <Link href="/register" style={{
              display: "block",
              textAlign: "center",
              padding: "0.75rem 1.5rem",
              background: "#fff",
              color: "#635bff",
              border: "1.5px solid #635bff",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
            }}>
              Start Free Trial
            </Link>
          </div>

          {/* Quarterly */}
          <div style={{
            padding: "2rem 1.5rem",
            borderRadius: 16,
            border: "1px solid #e3e8ef",
            background: "#fff",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
              background: "#3ecf8e", color: "#fff",
              padding: "3px 14px", borderRadius: 20,
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em",
            }}>
              SAVE 33%
            </div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#3ecf8e", textTransform: "uppercase", marginBottom: 8 }}>
              QUARTERLY
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>$23.99</span>
              <span style={{ fontSize: "0.9rem", color: "#8898aa" }}>/quarter</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#425466", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              $7.99/month · billed quarterly.<br />3-day free trial included.
            </p>
            <Link href="/register" style={{
              display: "block",
              textAlign: "center",
              padding: "0.75rem 1.5rem",
              background: "#fff",
              color: "#635bff",
              border: "1.5px solid #635bff",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
            }}>
              Start Free Trial
            </Link>
          </div>

          {/* Yearly */}
          <div style={{
            padding: "2rem 1.5rem",
            borderRadius: 16,
            border: "2px solid #635bff",
            background: "#fff",
            position: "relative",
            boxShadow: "0 4px 20px rgba(99,91,255,0.12)",
          }}>
            <div style={{
              position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
              background: "#635bff", color: "#fff",
              padding: "3px 14px", borderRadius: 20,
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em",
            }}>
              MOST POPULAR
            </div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#635bff", textTransform: "uppercase", marginBottom: 8 }}>
              YEARLY — BEST VALUE
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>$59.99</span>
              <span style={{ fontSize: "0.9rem", color: "#8898aa" }}>/year</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#425466", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              $4.99/month · billed annually.<br />3-day free trial included.
            </p>
            <Link href="/register" style={{
              display: "block",
              textAlign: "center",
              padding: "0.75rem 1.5rem",
              background: "#635bff",
              color: "#fff",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(99,91,255,0.3)",
            }}>
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section style={{ padding: "3.5rem 1.5rem", background: "#f6f9fc" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.3rem, 3.5vw, 1.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
            marginBottom: "2rem",
          }}>
            Everything included in every plan
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "#ede9ff", color: "#635bff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  ✓
                </div>
                <span style={{ fontSize: "0.95rem", color: "#0a2540" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Billing FAQ */}
      <section style={{ padding: "3.5rem 1.5rem", background: "#fff" }}>
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
              { q: "Do I need a credit card to start?", a: "No. The 3-day free trial requires no payment information. You'll only be asked to add a payment method when the trial ends and you choose to subscribe." },
              { q: "Can I cancel anytime?", a: "Yes. Cancel your subscription at any time from your profile settings. You'll keep access until the end of your current billing period." },
              { q: "What happens when my trial ends?", a: "You'll be prompted to choose a plan. If you don't subscribe, your account stays active — you just won't receive new AI-generated tasks until you upgrade." },
              { q: "Is there a refund policy?", a: "If you're not happy within the first 14 days of a paid subscription, contact us for a full refund. No questions asked." },
            ].map(item => (
              <div key={item.q} style={{
                background: "#f6f9fc",
                borderRadius: 14,
                padding: "1.25rem 1.5rem",
                border: "1px solid #e3e8ef",
              }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>{item.q}</h3>
                <p style={{ fontSize: "0.9rem", color: "#425466", lineHeight: 1.7 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: "4rem 1.5rem",
        background: "linear-gradient(135deg, #635bff 0%, #5144e8 100%)",
        textAlign: "center",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.75rem" }}>
            Start your free trial today
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.8)", marginBottom: "1.5rem" }}>
            Set your first goal and get personalized tasks in under a minute.
          </p>
          <Link href="/register" style={{
            display: "inline-block",
            padding: "0.875rem 2.5rem",
            background: "#fff",
            color: "#635bff",
            fontWeight: 700,
            fontSize: "1rem",
            borderRadius: 10,
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
          }}>
            Create free account →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
