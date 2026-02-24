"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const TESTIMONIALS = [
  { quote: "The tasks feel like they were written by a coach who actually knows my situation.", author: "Sarah K." },
  { quote: "Three tasks a day changed how I work. It adapts when I struggle and pushes when I'm ready.", author: "Marcus T." },
  { quote: "I've tried every productivity app. This is the first one that actually learns from me.", author: "Priya R." },
];

const FAQ = [
  {
    q: "Does it work for any goal?",
    a: "Yes. Threely works for anything — fitness, learning, creative projects, career goals, side businesses. You describe your goal in your own words and Threely Intelligence breaks it into a structured plan with daily tasks tailored to your experience, timeline, and available hours.",
  },
  {
    q: "How personalized is it really?",
    a: "Very. Threely Intelligence factors in your goal details, your daily time budget, your intensity preference, what you completed yesterday, and your review feedback. Every set of tasks is generated fresh — not pulled from a template. The more you use it, the better it gets.",
  },
  {
    q: "What happens after I complete my tasks?",
    a: "You leave a quick review — how difficult it felt, what went well, any notes. Threely Intelligence uses that feedback to generate a personalized coaching insight and calibrate tomorrow's tasks. It's a daily feedback loop that compounds over time.",
  },
  {
    q: "What if I miss a day?",
    a: "No guilt, no penalty. Just open Threely and pick up where you left off. Your streak resets, but your progress and goal context are preserved. The AI picks back up right where you were.",
  },
  {
    q: "Is it free?",
    a: "Threely offers a free 7-day trial so you can experience the full AI coaching loop. After that, it's a small subscription to keep Threely Intelligence generating your daily tasks and insights.",
  },
];

/* ─── SVG Store Badges ──────────────────────────────────────────────────────── */

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 17 20" fill="currentColor">
      <path d="M.517 1.206A1.4 1.4 0 0 0 0 2.275v15.45a1.4 1.4 0 0 0 .517 1.069l.056.05 8.662-8.663v-.204L.573 1.156l-.056.05z"/>
      <path d="M12.122 13.068l-2.887-2.887v-.204l2.887-2.887.065.037 3.42 1.943c.977.555.977 1.463 0 2.018l-3.42 1.943-.065.037z"/>
      <path d="M12.187 13.031L9.235 10.08.517 18.794c.322.34.856.382 1.456.043l10.214-5.806"/>
      <path d="M12.187 7.127L1.973 1.322C1.373.982.84 1.024.517 1.365L9.235 10.08l2.952-2.952z"/>
    </svg>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }, []);

  function handleMobileCTA(e: React.MouseEvent) {
    if (isMobile && window.__openThreelyAppPrompt) {
      e.preventDefault();
      window.__openThreelyAppPrompt();
    }
    // On desktop, the default Link/anchor behavior proceeds normally
  }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0a2540", overflowX: "hidden", background: "#fff" }}>
      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e3e8ef",
        padding: "0 2rem",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "#635bff", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700,
          }}>3</div>
          <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.02em" }}>Threely</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/login" style={{
            padding: "0.4rem 0.875rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#425466",
            borderRadius: 8,
          }}>
            Sign in
          </Link>
          <Link href="/register" onClick={handleMobileCTA} style={{
            padding: "0.4rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#fff",
            background: "#635bff",
            borderRadius: 8,
          }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* ─── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(135deg, #f6f9fc 0%, #ede9ff 100%)",
        padding: "5rem 1.5rem 3.5rem",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {/* Logo mark */}
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "#635bff", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 800,
            margin: "0 auto 2rem",
            boxShadow: "0 8px 24px rgba(99,91,255,0.25)",
          }}>3</div>

          <h1 style={{
            fontSize: "clamp(2.5rem, 7vw, 4rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            marginBottom: "1.25rem",
          }}>
            Your AI coach.<br />
            <span style={{ color: "#635bff" }}>Three tasks a day.</span>
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2.5vw, 1.15rem)",
            color: "#425466",
            lineHeight: 1.7,
            maxWidth: 540,
            margin: "0 auto 2.5rem",
          }}>
            Threely Intelligence learns your goals, your schedule, and your progress — then generates three personalized tasks every day that actually move you forward. Review, adapt, repeat.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" onClick={handleMobileCTA} style={{
              padding: "0.875rem 2rem",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#fff",
              background: "#635bff",
              borderRadius: 10,
              display: "inline-block",
              boxShadow: "0 4px 14px rgba(99,91,255,0.3)",
            }}>
              Start for free →
            </Link>
            <a href="#how-it-works" style={{
              padding: "0.875rem 2rem",
              fontSize: "1rem",
              fontWeight: 600,
              color: "#635bff",
              background: "#fff",
              border: "1.5px solid #e3e8ef",
              borderRadius: 10,
              display: "inline-block",
            }}>
              Learn more
            </a>
          </div>

          {/* App Store badges */}
          <div style={{
            marginTop: "1.5rem",
            display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap",
          }}>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 16px",
              background: "#0a2540",
              color: "#fff",
              borderRadius: 8,
              fontSize: "0.8rem",
              fontWeight: 600,
            }}>
              <AppleIcon />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Download on the</span>
                <span>App Store</span>
              </span>
            </Link>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 16px",
              background: "#0a2540",
              color: "#fff",
              borderRadius: 8,
              fontSize: "0.8rem",
              fontWeight: 600,
            }}>
              <PlayIcon />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Get it on</span>
                <span>Google Play</span>
              </span>
            </Link>
          </div>

          {/* Social proof */}
          <div style={{
            marginTop: "2rem",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <div style={{ color: "#f5a623", fontSize: "1.1rem", letterSpacing: 2 }}>
              ★★★★★
            </div>
            <p style={{ fontSize: "0.85rem", color: "#8898aa", fontWeight: 500 }}>
              Join 2,000+ people hitting their goals every day
            </p>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ──────────────────────────────────────────────────────── */}
      <section style={{ padding: "3rem 1.5rem", background: "#fff" }}>
        <div style={{
          maxWidth: 900, margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1.25rem",
        }}>
          {TESTIMONIALS.map(t => (
            <div key={t.author} style={{
              padding: "1.5rem",
              background: "#f6f9fc",
              borderRadius: 14,
              border: "1px solid #e3e8ef",
            }}>
              <p style={{
                fontSize: "0.95rem", fontStyle: "italic",
                color: "#0a2540", lineHeight: 1.6, marginBottom: 12,
              }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#8898aa" }}>
                — {t.author}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works (visual) ─────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "4.5rem 1.5rem", background: "#f6f9fc" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
            marginBottom: "0.5rem",
          }}>
            From goal to done in three steps.
          </h2>
          <p style={{ color: "#425466", textAlign: "center", marginBottom: "3rem", fontSize: "0.95rem" }}>
            Describe your goal. Get a personalized daily plan. Complete, review, and watch the AI adapt.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginBottom: "3rem",
          }}>
            {[
              { step: "01", title: "Describe your goal", desc: "Tell Threely what you're working toward in your own words — your experience level, timeline, and how much time you have each day." },
              { step: "02", title: "Get tailored tasks", desc: "Threely Intelligence generates three specific, actionable tasks calibrated to your skill level, schedule, and what you've already accomplished." },
              { step: "03", title: "Review & evolve", desc: "Complete your tasks, rate the difficulty, and leave feedback. The AI uses your review to generate coaching insights and refine tomorrow's plan." },
            ].map(item => (
              <div key={item.step} style={{
                background: "#fff",
                borderRadius: 14,
                padding: "1.5rem",
                border: "1px solid #e3e8ef",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}>
                <div style={{
                  fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em",
                  color: "#635bff", marginBottom: 12,
                }}>
                  STEP {item.step}
                </div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "#425466", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Visual mockup card — advanced example */}
          <div style={{
            maxWidth: 420, margin: "0 auto",
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e3e8ef",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            padding: "1.5rem",
          }}>
            {/* Header with goal + badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div style={{
                fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em",
                color: "#8898aa", textTransform: "uppercase",
              }}>
                TODAY&apos;S PLAN
              </div>
              <div style={{
                fontSize: "0.65rem", fontWeight: 600,
                background: "#ede9ff", color: "#635bff",
                padding: "2px 8px", borderRadius: 10,
              }}>
                Day 12
              </div>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4 }}>
              Launch my SaaS product
            </div>
            <div style={{ fontSize: "0.75rem", color: "#8898aa", marginBottom: 16 }}>
              30 min/day &middot; Moderate intensity
            </div>

            {/* Tasks with time badges */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { text: "Draft 3 cold outreach emails using the pain points from user interviews", time: "15m", done: true },
                { text: "Set up Stripe test mode and connect webhook to your /api/payments route", time: "10m", done: true },
                { text: "Write the hero section copy for your landing page — focus on the outcome, not features", time: "5m", done: false },
              ].map(task => (
                <div key={task.text} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    border: task.done ? "none" : "2px solid #e3e8ef",
                    background: task.done ? "#635bff" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: 1,
                  }}>
                    {task.done && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontSize: "0.85rem",
                      color: task.done ? "#8898aa" : "#0a2540",
                      textDecoration: task.done ? "line-through" : "none",
                      lineHeight: 1.4,
                    }}>
                      {task.text}
                    </span>
                  </div>
                  <span style={{
                    fontSize: "0.7rem", fontWeight: 600,
                    color: "#8898aa", flexShrink: 0, marginTop: 2,
                  }}>
                    {task.time}
                  </span>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div style={{
              marginTop: 16, display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                flex: 1, height: 6, background: "#e3e8ef", borderRadius: 3, overflow: "hidden",
              }}>
                <div style={{
                  width: "66%", height: "100%",
                  background: "linear-gradient(90deg, #635bff, #7c74ff)",
                  borderRadius: 3,
                }} />
              </div>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#635bff" }}>
                2 of 3
              </span>
            </div>

            {/* Coach note preview */}
            <div style={{
              marginTop: 14, padding: "10px 12px",
              background: "#f6f9fc", borderRadius: 10,
              border: "1px solid #e3e8ef",
            }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#635bff", letterSpacing: "0.05em", marginBottom: 4 }}>
                AI COACHING INSIGHT
              </div>
              <p style={{ fontSize: "0.78rem", color: "#425466", lineHeight: 1.5, margin: 0 }}>
                You&apos;re ahead of schedule on the technical setup. Tomorrow I&apos;ll shift focus to your go-to-market messaging since the outreach emails are drafted.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── The Problem ───────────────────────────────────────────────────────── */}
      <section style={{ padding: "4.5rem 1.5rem", background: "#fff" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            marginBottom: "1.5rem",
          }}>
            Other apps give you a list.<br />
            <span style={{ color: "#635bff" }}>Threely gives you a coach.</span>
          </h2>
          <p style={{
            fontSize: "1rem", color: "#425466", lineHeight: 1.8,
            marginBottom: "1.5rem",
          }}>
            Most productivity tools dump an overwhelming list on you and hope you figure it out. They don&apos;t know your experience level. They don&apos;t know how much time you have. They don&apos;t care if yesterday was hard.
          </p>
          <p style={{
            fontSize: "1rem", color: "#425466", lineHeight: 1.8,
          }}>
            Threely Intelligence is different. It understands your specific goals, adapts to your daily feedback, and generates exactly three tasks designed for where you are right now — not where some template assumes you should be.
          </p>
        </div>
      </section>

      {/* ─── Personalization Features ──────────────────────────────────────────── */}
      <section style={{ padding: "4.5rem 1.5rem", background: "#f6f9fc" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
            marginBottom: "0.5rem",
          }}>
            Built around you, not a template.
          </h2>
          <p style={{ color: "#425466", textAlign: "center", marginBottom: "3rem", fontSize: "0.95rem" }}>
            Every detail of Threely is designed to adapt to how you work.
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1.25rem",
          }}>
            {[
              {
                icon: "🧠",
                title: "AI That Learns From You",
                desc: "After every session, you leave a quick review. Threely Intelligence uses your feedback to calibrate difficulty, shift focus areas, and generate smarter tasks tomorrow.",
              },
              {
                icon: "⏱",
                title: "Fits Your Schedule",
                desc: "Set how much time you have each day — 15 minutes or 2 hours. Every task is scoped to fit your real life, not an idealized version of it.",
              },
              {
                icon: "🎚",
                title: "Your Intensity, Your Pace",
                desc: "Choose from light to maximum. Threely adjusts the challenge level so you're always in the zone — building habits without burning out.",
              },
              {
                icon: "💬",
                title: "Daily Coaching Insights",
                desc: "After your review, get a personalized AI coaching note that reflects on your progress and primes you for what's next.",
              },
              {
                icon: "🔄",
                title: "Tasks That Build on Each Other",
                desc: "Today's tasks reference what you did yesterday. Every day compounds — so you're not starting from scratch each morning.",
              },
              {
                icon: "🎯",
                title: "Multiple Goals, One Plan",
                desc: "Track fitness, business, learning, and more — all at once. Threely mixes tasks across goals so nothing falls behind.",
              },
            ].map(f => (
              <div key={f.title} style={{
                padding: "1.25rem",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e3e8ef",
              }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
                <p style={{ fontSize: "0.825rem", color: "#425466", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── The Loop ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: "4.5rem 1.5rem", background: "#fff" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
            marginBottom: "0.5rem",
          }}>
            The daily loop that compounds.
          </h2>
          <p style={{ color: "#425466", textAlign: "center", marginBottom: "3rem", fontSize: "0.95rem" }}>
            This isn&apos;t a one-time plan. It&apos;s an ongoing coaching relationship.
          </p>
          {[
            {
              num: "1",
              title: "Describe your goal in plain language",
              desc: "\"I want to launch a side project in 3 months. I can spend 30 minutes a day and I'm a beginner at marketing.\" — That's all Threely needs. The AI extracts your timeline, experience level, and constraints automatically.",
            },
            {
              num: "2",
              title: "Get three tasks built for today",
              desc: "Threely Intelligence generates tasks that are specific, actionable, and sized to fit your time budget. No vague suggestions — real next steps based on where you are in your journey right now.",
            },
            {
              num: "3",
              title: "Complete, review, and watch it adapt",
              desc: "After finishing, rate the difficulty and leave a quick note. The AI generates a coaching insight, then uses everything — your feedback, your pace, your progress — to craft a better plan tomorrow.",
            },
          ].map((item, i) => (
            <div key={item.num} style={{
              display: "flex", gap: 20, alignItems: "flex-start",
              marginBottom: i < 2 ? "2.5rem" : 0,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "#635bff", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.1rem", fontWeight: 800,
                flexShrink: 0,
              }}>
                {item.num}
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: "0.95rem", color: "#425466", lineHeight: 1.7 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Why Three ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "4.5rem 1.5rem", background: "#f6f9fc" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "1.5rem",
          }}>
            There&apos;s real science behind the number.
          </h2>
          <p style={{
            fontSize: "1rem", color: "#425466", lineHeight: 1.8,
            marginBottom: "1.25rem",
          }}>
            Decision fatigue is real. The more choices you face, the worse your decisions get — and the less likely you are to act at all. Psychologists call it cognitive overload.
          </p>
          <p style={{
            fontSize: "1rem", color: "#425466", lineHeight: 1.8,
            marginBottom: "1.25rem",
          }}>
            Three sits in the sweet spot: enough to make meaningful progress, few enough to stay focused. It&apos;s why we remember things in threes, present ideas in threes, and structure stories in three acts.
          </p>
          <p style={{
            fontSize: "1rem", color: "#425466", lineHeight: 1.8,
          }}>
            Three tasks is a commitment you can keep. And consistency — not intensity — is what gets you to your goals.
          </p>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "4.5rem 1.5rem", background: "#fff" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
            marginBottom: "2.5rem",
          }}>
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {FAQ.map(item => (
              <div key={item.q} style={{
                background: "#f6f9fc",
                borderRadius: 14,
                padding: "1.25rem 1.5rem",
                border: "1px solid #e3e8ef",
              }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>
                  {item.q}
                </h3>
                <p style={{ fontSize: "0.9rem", color: "#425466", lineHeight: 1.7 }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────────────── */}
      <section style={{
        padding: "5rem 1.5rem",
        background: "linear-gradient(135deg, #635bff 0%, #5144e8 100%)",
        textAlign: "center",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "1rem",
          }}>
            Ready to start?
          </h2>
          <p style={{
            fontSize: "1.05rem",
            color: "rgba(255,255,255,0.8)",
            lineHeight: 1.6,
            marginBottom: "2rem",
          }}>
            Set your first goal and get a personalized daily plan in under a minute.
          </p>
          <Link href="/register" onClick={handleMobileCTA} style={{
            display: "inline-block",
            padding: "0.875rem 2.5rem",
            background: "#fff",
            color: "#635bff",
            fontWeight: 700,
            fontSize: "1rem",
            borderRadius: 10,
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
          }}>
            Create free account →
          </Link>

          {/* App store badges in CTA */}
          <div style={{
            marginTop: "1.5rem",
            display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap",
          }}>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 16px",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              borderRadius: 8,
              fontSize: "0.8rem",
              fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.25)",
            }}>
              <AppleIcon />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Download on the</span>
                <span>App Store</span>
              </span>
            </Link>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 16px",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              borderRadius: 8,
              fontSize: "0.8rem",
              fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.25)",
            }}>
              <PlayIcon />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Get it on</span>
                <span>Google Play</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────────────── */}
      <footer style={{
        background: "#0a2540",
        color: "rgba(255,255,255,0.5)",
        padding: "2.5rem 1.5rem",
        textAlign: "center",
        fontSize: "0.825rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "#635bff", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700,
          }}>3</div>
          <span style={{ color: "#fff", fontWeight: 600 }}>Threely</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 16 }}>
          <Link href="/login" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.825rem" }}>
            Sign in
          </Link>
          <Link href="/register" onClick={handleMobileCTA} style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.825rem" }}>
            Get started
          </Link>
        </div>
        <p style={{ marginBottom: 8 }}>
          © {new Date().getFullYear()} Threely. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
