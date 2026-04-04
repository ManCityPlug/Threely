import type { Metadata } from "next";
import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Get answers about Threely: how the AI coaching works, supported goals, pricing plans, free trial details, data privacy, and account management.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Threely FAQ",
    description: "Everything you need to know about Threely — AI coaching, goals, pricing, free trial, and more.",
  },
};

const CATEGORIES = [
  {
    title: "Getting Started",
    items: [
      {
        q: "What is Threely?",
        a: "Threely is an AI-powered goal coach. You describe any goal — fitness, career, learning, creative projects, anything — and Threely Intelligence generates exactly 3 personalized daily tasks to move you forward. After you complete them, you leave a quick review, and the AI adapts tomorrow's plan based on your feedback.",
      },
      {
        q: "Does it work for any goal?",
        a: "Yes. Threely works for anything — fitness, learning, creative projects, career goals, side businesses, personal development. You describe your goal in your own words and the AI breaks it into a structured plan with daily tasks tailored to your experience, timeline, and available hours.",
      },
      {
        q: "How do I get started?",
        a: "Create a free account, describe your first goal in plain language (like \"I want to learn Spanish\" or \"Launch my Etsy shop\"), and set how much time you have each day. Threely generates your first three tasks in under a minute.",
      },
      {
        q: "Is there a mobile app?",
        a: "Yes. Threely is available on iOS and Android. The mobile app is the primary experience — with push notifications for your daily tasks, quick review flow, and offline support.",
      },
    ],
  },
  {
    title: "AI & Personalization",
    items: [
      {
        q: "How personalized is it really?",
        a: "Very. Threely Intelligence factors in your goal details, your daily time budget, your intensity preference, what you completed yesterday, and your review feedback. Every set of tasks is generated fresh — not pulled from a template. The more you use it, the better it gets.",
      },
      {
        q: "Why exactly 3 tasks?",
        a: "Research shows that decision fatigue and cognitive overload are the biggest barriers to productivity. Three tasks sit in the sweet spot: enough to make meaningful progress, few enough to stay focused. It's a commitment you can keep every day — and consistency beats intensity.",
      },
      {
        q: "What happens after I complete my tasks?",
        a: "You leave a quick review — how difficult it felt, what went well, any notes. Threely Intelligence uses that feedback to generate a personalized coaching insight and calibrate tomorrow's tasks. It's a daily feedback loop that compounds over time.",
      },
      {
        q: "What if the tasks are too easy or too hard?",
        a: "That's exactly what the review system is for. Rate your tasks as \"too easy,\" \"just right,\" \"challenging,\" or \"overwhelming\" — and the AI recalibrates. You can also adjust your intensity level at any time in your settings.",
      },
      {
        q: "Can I have multiple goals at once?",
        a: "Yes. You can track multiple goals simultaneously — fitness, business, learning, and more. Threely lets you focus on one goal at a time or mix tasks across all your goals in a single daily plan.",
      },
    ],
  },
  {
    title: "Account & Billing",
    items: [
      {
        q: "Is Threely free?",
        a: "Threely Pro is free for 7 days with full access to all features. After that, you can choose a monthly ($12.99/mo) or yearly ($99.99/yr) subscription to keep the AI coaching active.",
      },
      {
        q: "Do I need a credit card to start?",
        a: "Yes — we securely collect payment details when you sign up, but you won't be charged during the 7-day free period. We'll send you a reminder 2 days before it ends so there are no surprises. You can cancel anytime.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. Cancel from your profile settings at any time. You'll keep access until the end of your current billing period. No penalties, no hoops.",
      },
      {
        q: "What if I miss a day?",
        a: "No guilt, no penalty. Just open Threely and pick up where you left off. Your streak resets, but your progress and goal context are preserved. The AI picks back up right where you were.",
      },
      {
        q: "What happens after my 7 free days?",
        a: "Your account stays active and your data is preserved. You just won't receive new AI-generated tasks until you upgrade. You can come back and subscribe anytime.",
      },
    ],
  },
  {
    title: "Data & Privacy",
    items: [
      {
        q: "Is my data safe?",
        a: "Yes. Your data is encrypted in transit and at rest. We use industry-standard security practices and never sell your personal information to third parties.",
      },
      {
        q: "Can I delete my account?",
        a: "Yes. You can delete your account at any time from your profile settings. This permanently removes all your data including goals, tasks, reviews, and personal information.",
      },
      {
        q: "Does Threely use my data to train AI models?",
        a: "No. Your goals, tasks, reviews, and personal information are used only to generate your personalized daily plans and coaching insights. We do not use your data to train any AI models.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#e8e8e8", background: "#0a0a0a" }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{
        background: "radial-gradient(ellipse at 50% 0%, rgba(99,91,255,0.08) 0%, transparent 60%)",
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
            Frequently asked questions
          </h1>
          <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
            Everything you need to know about Threely.
          </p>
        </div>
      </section>

      {/* FAQ sections */}
      <section style={{ padding: "3.5rem 1.5rem", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {CATEGORIES.map((cat, ci) => (
            <div key={cat.title} style={{ marginBottom: ci < CATEGORIES.length - 1 ? "3rem" : 0 }}>
              <h2 style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: "1.25rem",
                paddingBottom: "0.75rem",
                borderBottom: "2px solid #ede9ff",
              }}>
                {cat.title}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {cat.items.map(item => (
                  <div key={item.q} style={{
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 14,
                    padding: "1.25rem 1.5rem",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>{item.q}</h3>
                    <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: "4rem 1.5rem",
        background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.06)",
        textAlign: "center",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.75rem" }}>
            Still have questions?
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.8)", marginBottom: "1.5rem" }}>
            Try Threely free for 7 days and see for yourself.
          </p>
          <Link href="/welcome" style={{
            display: "inline-block",
            padding: "0.875rem 2.5rem",
            background: "#0a0a0a",
            color: "#635bff",
            fontWeight: 700,
            fontSize: "1rem",
            borderRadius: 10,
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
          }}>
            Start for free →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
