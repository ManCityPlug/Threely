import type { Metadata } from "next";
import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Describe your goal, get 3 personalized tasks every day. Complete them, leave a quick review, and watch the AI adapt to your progress. See how Threely works.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How Threely Works",
    description: "Describe your goal, get 3 personalized tasks every day. Complete, review, and watch the AI coaching adapt to you.",
  },
};

const STEPS = [
  {
    num: "01",
    title: "Describe your goal",
    subtitle: "In your own words",
    desc: "Tell Threely what you're working toward — \"I want to learn guitar,\" \"Launch my online store,\" \"Get in shape for summer.\" Include your experience level, how much time you have each day, and any deadlines.",
    detail: "Threely Intelligence analyzes your input and extracts the key details: category, timeline, skill level, daily time budget, and intensity. No forms to fill out — just natural language.",
    color: "#635bff",
  },
  {
    num: "02",
    title: "Get 3 tailored tasks",
    subtitle: "Every single day",
    desc: "Each morning, Threely generates exactly three tasks designed for where you are right now. Not yesterday's plan. Not a generic template. Tasks that account for your progress, your pace, and your available time.",
    detail: "Each task includes a clear title, a detailed description, an estimated time, and a \"why it matters\" explanation so you understand how it connects to your bigger goal.",
    color: "#635bff",
  },
  {
    num: "03",
    title: "Complete and review",
    subtitle: "A 30-second feedback loop",
    desc: "Check off your tasks as you go. When you're done for the day, leave a quick review: was it too easy, just right, or overwhelming? Add any notes about what went well or what was difficult.",
    detail: "This review takes less than 30 seconds, but it's the most powerful part of Threely. Your feedback directly shapes what happens next.",
    color: "#635bff",
  },
  {
    num: "04",
    title: "AI adapts and coaches",
    subtitle: "Smarter every day",
    desc: "Threely Intelligence uses your review to generate a personalized coaching insight — a 2-3 sentence note that reflects on your progress and primes you for tomorrow. Then it calibrates your next set of tasks.",
    detail: "If yesterday was too hard, tomorrow gets recalibrated. If you're ahead of schedule, the AI pushes you further. It's a feedback loop that compounds — the more you use it, the better it gets.",
    color: "#635bff",
  },
];

export default function HowItWorksPage() {
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
            From goal to done,<br />
            <span style={{ color: "#635bff" }}>every single day</span>
          </h1>
          <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 540, margin: "0 auto" }}>
            Threely is a daily coaching loop. Describe your goal once, then get a personalized plan that evolves with you — automatically.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section style={{ padding: "4rem 1.5rem", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {STEPS.map((step, i) => (
            <div key={step.num} style={{
              display: "flex",
              gap: 24,
              alignItems: "flex-start",
              marginBottom: i < STEPS.length - 1 ? "3.5rem" : 0,
              position: "relative",
            }}>
              {/* Step number + line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "#635bff", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem", fontWeight: 800,
                }}>
                  {step.num}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 40,
                    background: "linear-gradient(to bottom, #635bff, rgba(255,255,255,0.12))",
                    marginTop: 8,
                  }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#635bff", textTransform: "uppercase", marginBottom: 4 }}>
                  {step.subtitle}
                </div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>
                  {step.title}
                </h2>
                <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 10 }}>
                  {step.desc}
                </p>
                <p style={{
                  fontSize: "0.875rem", color: "#8898aa", lineHeight: 1.65,
                  padding: "0.75rem 1rem",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Example daily plan */}
      <section style={{ padding: "4rem 1.5rem", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontSize: "clamp(1.3rem, 3.5vw, 1.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "0.5rem",
          }}>
            Here&apos;s what a typical day looks like
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "2rem", fontSize: "0.95rem" }}>
            A real example from someone building a side business.
          </p>

          <div style={{
            maxWidth: 420, margin: "0 auto",
            background: "#0a0a0a",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            padding: "1.5rem",
            textAlign: "left",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: "#8898aa", textTransform: "uppercase" }}>
                TODAY&apos;S PLAN
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 600, background: "#ede9ff", color: "#635bff", padding: "2px 8px", borderRadius: 10 }}>
                Day 24
              </div>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4 }}>Learn conversational Spanish</div>
            <div style={{ fontSize: "0.75rem", color: "#8898aa", marginBottom: 16 }}>30 min/day &middot; Moderate intensity</div>

            {[
              { text: "Practice 15 new vocabulary words from the \"food & restaurant\" category using flashcards", time: "10m", done: true },
              { text: "Listen to a 10-minute Spanish podcast episode and write down 5 new phrases you hear", time: "12m", done: true },
              { text: "Write a short paragraph in Spanish describing what you ate today — use at least 3 new words", time: "8m", done: false },
            ].map(task => (
              <div key={task.text} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  border: task.done ? "none" : "2px solid rgba(255,255,255,0.12)",
                  background: task.done ? "#635bff" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 1,
                }}>
                  {task.done && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontSize: "0.85rem",
                    color: task.done ? "#8898aa" : "#e8e8e8",
                    textDecoration: task.done ? "line-through" : "none",
                    lineHeight: 1.4,
                  }}>
                    {task.text}
                  </span>
                </div>
                <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#8898aa", flexShrink: 0, marginTop: 2 }}>
                  {task.time}
                </span>
              </div>
            ))}

            {/* Coach note */}
            <div style={{
              marginTop: 14, padding: "10px 12px",
              background: "rgba(255,255,255,0.02)", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#635bff", letterSpacing: "0.05em", marginBottom: 4 }}>
                AI COACHING INSIGHT
              </div>
              <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>
                Your vocabulary retention is strong — you&apos;re consistently remembering 80%+ from previous sessions. Tomorrow I&apos;ll introduce a conversational roleplay exercise to build your confidence speaking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why 3 */}
      <section style={{ padding: "4rem 1.5rem", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 650, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontSize: "clamp(1.3rem, 3.5vw, 1.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "1.25rem",
          }}>
            Why three tasks?
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: "1rem" }}>
            Decision fatigue is real. The more choices you face, the less likely you are to act. Psychologists call it cognitive overload — and it&apos;s the #1 reason people abandon their goals.
          </p>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: "1rem" }}>
            Three sits in the sweet spot: enough to make meaningful progress, few enough to stay focused. It&apos;s why we remember things in threes, present ideas in threes, and structure stories in three acts.
          </p>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
            Three tasks is a commitment you can keep. And consistency — not intensity — is what gets you to your goals.
          </p>
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
            Ready to try it?
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.8)", marginBottom: "1.5rem" }}>
            Describe your first goal. Get 3 personalized tasks in under a minute.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
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
            <Link href="/pricing" style={{
              display: "inline-block",
              padding: "0.875rem 2rem",
              background: "transparent",
              color: "#fff",
              fontWeight: 600,
              fontSize: "1rem",
              borderRadius: 10,
              textDecoration: "none",
              border: "1.5px solid rgba(255,255,255,0.3)",
            }}>
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
