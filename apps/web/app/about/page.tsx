import type { Metadata } from "next";
import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "About",
  description:
    "Threely was built on a simple belief: everyone deserves a coach. Learn how Threely uses AI to deliver 3 personalized daily tasks and adaptive coaching for any goal.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Threely",
    description: "Everyone deserves a coach. Threely uses AI to deliver 3 personalized daily tasks and adaptive coaching for any goal.",
  },
};

const VALUES = [
  {
    icon: "🎯",
    title: "Focus over overwhelm",
    desc: "Three tasks, not thirty. We believe constraints create clarity. By limiting your daily plan to exactly three tasks, we eliminate decision fatigue and help you channel your energy where it matters.",
  },
  {
    icon: "🔄",
    title: "Consistency compounds",
    desc: "Big goals aren't achieved in a single sprint. They're achieved by showing up every day with the right plan. Threely is designed around daily momentum — small, steady steps that add up.",
  },
  {
    icon: "🤝",
    title: "Coaching, not tracking",
    desc: "Most apps track what you've done. Threely tells you what to do next. That's the difference between a spreadsheet and a coach — one records, the other guides.",
  },
  {
    icon: "🧠",
    title: "AI that adapts to you",
    desc: "Your goals, your pace, your feedback. Threely Intelligence doesn't use templates — it generates fresh tasks every day based on where you are, not where an algorithm assumes you should be.",
  },
];

export default function AboutPage() {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#e8e8e8", background: "#0a0a0a" }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{
        background: "radial-gradient(ellipse at 50% 0%, rgba(99,91,255,0.08) 0%, transparent 60%)",
        padding: "4.5rem 1.5rem 3.5rem",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 650, margin: "0 auto" }}>
          <h1 style={{
            fontSize: "clamp(2rem, 5vw, 3rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            marginBottom: "1.25rem",
          }}>
            Everyone deserves a coach
          </h1>
          <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 540, margin: "0 auto" }}>
            Personal coaching used to cost hundreds of dollars an hour and was only available to a few. Threely was built to change that — to make real, adaptive coaching accessible to anyone with a goal.
          </p>
        </div>
      </section>

      {/* The problem */}
      <section style={{ padding: "4rem 1.5rem", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 650, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.3rem, 3.5vw, 1.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "1.25rem",
          }}>
            The problem with productivity apps
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: "1rem" }}>
            There are thousands of to-do list apps, habit trackers, and planners. They all have one thing in common: they expect you to figure out what to do yourself.
          </p>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: "1rem" }}>
            You set a goal like "learn guitar" or "launch my business" — and then stare at a blank task list. What should today look like? How much is too much? What comes after yesterday's work? These are the questions a good coach answers. And that&apos;s exactly what Threely does.
          </p>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
            Threely Intelligence takes your goal, your time constraints, your intensity preference, and your daily feedback — then generates exactly three actionable tasks that move you forward. Not tomorrow. Today.
          </p>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: "4rem 1.5rem", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.3rem, 3.5vw, 1.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
            marginBottom: "2.5rem",
          }}>
            What Threely believes
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}>
            {VALUES.map(v => (
              <div key={v.title} style={{
                padding: "1.5rem",
                background: "#0a0a0a",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{v.icon}</div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>{v.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works (brief) */}
      <section style={{ padding: "4rem 1.5rem", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 650, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.3rem, 3.5vw, 1.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "1.25rem",
          }}>
            The daily coaching loop
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: "1.5rem" }}>
            Every day, Threely gives you three tasks tailored to your goal. You complete them, leave a quick review, and the AI generates a coaching insight. Then it uses everything — your feedback, your pace, your progress — to build a better plan for tomorrow.
          </p>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: "2rem" }}>
            It&apos;s a feedback loop that compounds. The more you use it, the better it gets at knowing exactly what you need.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/how-it-works" style={{
              padding: "0.75rem 1.5rem",
              background: "#635bff",
              color: "#fff",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
            }}>
              See how it works →
            </Link>
            <Link href="/pricing" style={{
              padding: "0.75rem 1.5rem",
              background: "#0a0a0a",
              color: "#635bff",
              border: "1.5px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: "0.95rem",
              textDecoration: "none",
            }}>
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Mission CTA */}
      <section style={{
        padding: "4rem 1.5rem",
        background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.06)",
        textAlign: "center",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.75rem" }}>
            Ready to meet your AI coach?
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.8)", marginBottom: "1.5rem" }}>
            Describe your goal. Get your first three tasks in under a minute.
          </p>
          <Link href="/start" style={{
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
