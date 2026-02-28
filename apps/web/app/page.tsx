"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase-client";

const TESTIMONIALS = [
  { quote: "I said I wanted to learn guitar. Next morning it told me to practice the G-C-D chord switch for 10 minutes. Not 'learn chords' — the exact thing I needed.", author: "Sarah K." },
  { quote: "Three tasks. That's it. I stopped overthinking and started doing. 47 days straight and counting.", author: "Marcus T." },
  { quote: "I've tried every productivity app. This one doesn't give me a list — it gives me a plan that changes every day based on what I actually did.", author: "Priya R." },
];

const FAQ = [
  {
    q: "Does it work for any goal?",
    a: "Yes. Fitness, learning an instrument, launching a side project, reading more, career goals — anything. You describe what you want in your own words and Threely breaks it into a real daily plan tailored to your experience, timeline, and schedule.",
  },
  {
    q: "How personalized is it really?",
    a: "Very. Threely factors in your goal details, how much time you have, your intensity preference, what you completed yesterday, and your review feedback. Every set of tasks is generated fresh — not pulled from a template. The more you use it, the better it gets.",
  },
  {
    q: "What happens after I complete my tasks?",
    a: "You leave a quick review — how difficult it felt, what went well, any notes. Threely uses that feedback to generate a coaching insight and adjust tomorrow's tasks. It's a daily feedback loop that compounds over time.",
  },
  {
    q: "What if I miss a day?",
    a: "No guilt, no penalty. Just open Threely and pick up where you left off. Your streak resets, but your progress and goal context are preserved. The AI picks back up right where you were.",
  },
  {
    q: "Is it free?",
    a: "Threely offers a free 3-day trial so you can experience the full AI coaching loop — no credit card required. After that, choose a plan to keep your daily tasks and insights generating.",
  },
];

/* ─── SVG Store Badges ──────────────────────────────────────────────────────── */

function AppleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
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
  const [isMobile, setIsMobile] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    // Detect iPadOS 13+ (reports as Macintosh with touch support)
    const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const mobile = isIPad || /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    setIsMobile(mobile);
    if (/iPhone|iPod/i.test(ua) || isIPad) {
      setPlatform("ios");
    } else if (/Android/i.test(ua)) {
      setPlatform("android");
    }

    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) setLoggedIn(true);
    });
  }, []);

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0a2540", overflowX: "hidden", background: "#fff" }}>
      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e3e8ef",
        padding: "0 1.25rem",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/favicon.png" alt="Threely" width={34} height={34} style={{ borderRadius: 9 }} />
            <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.02em" }}>Threely</span>
          </div>
          {/* Desktop nav links */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {[
                { label: "How It Works", href: "#how-it-works" },
                { label: "Pricing", href: "/pricing" },
                { label: "FAQ", href: "/faq" },
                { label: "About", href: "/about" },
              ].map(item => (
                <Link key={item.label} href={item.href} style={{
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "#425466",
                  borderRadius: 6,
                  textDecoration: "none",
                }}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isMobile && !loggedIn && (
            <Link href="/login" style={{
              padding: "0.4rem 0.875rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#425466",
              borderRadius: 8,
            }}>
              Sign in
            </Link>
          )}
          {!isMobile && (
            <Link href={loggedIn ? "/dashboard" : "/register"} style={{
              padding: "0.4rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#fff",
              background: "#635bff",
              borderRadius: 8,
            }}>
              {loggedIn ? "Go to dashboard" : "Get started"}
            </Link>
          )}
          {/* Hamburger — mobile only */}
          {isMobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 6, display: "flex", flexDirection: "column", gap: 4,
                marginLeft: 4,
              }}
              aria-label="Menu"
            >
              <span style={{ width: 20, height: 2, background: "#0a2540", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "#0a2540", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "#0a2540", borderRadius: 1, display: "block" }} />
            </button>
          )}
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div style={{
          position: "sticky", top: 60, zIndex: 99,
          background: "#fff",
          borderBottom: "1px solid #e3e8ef",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          padding: "0.75rem 1.5rem",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {[
            { label: "How It Works", href: "#how-it-works" },
            { label: "FAQ", href: "/faq" },
            { label: "Pricing", href: "/pricing" },
            { label: "About", href: "/about" },
          ].map(item => (
            <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} style={{
              padding: "0.6rem 0",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#0a2540",
              borderBottom: "1px solid #f0f0f0",
              textDecoration: "none",
              display: "block",
            }}>
              {item.label}
            </Link>
          ))}

          {/* Auth buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {loggedIn ? (
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} style={{
                flex: 1, textAlign: "center",
                padding: "0.6rem 0",
                fontSize: "0.875rem", fontWeight: 600,
                color: "#fff",
                background: "#635bff",
                borderRadius: 8,
                textDecoration: "none",
              }}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} style={{
                  flex: 1, textAlign: "center",
                  padding: "0.6rem 0",
                  fontSize: "0.875rem", fontWeight: 600,
                  color: "#425466",
                  border: "1.5px solid #e3e8ef",
                  borderRadius: 8,
                  textDecoration: "none",
                }}>
                  Sign in
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)} style={{
                  flex: 1, textAlign: "center",
                  padding: "0.6rem 0",
                  fontSize: "0.875rem", fontWeight: 600,
                  color: "#fff",
                  background: "#635bff",
                  borderRadius: 8,
                  textDecoration: "none",
                }}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(135deg, #f6f9fc 0%, #ede9ff 100%)",
        padding: isMobile ? "1.5rem 1.5rem 2.5rem" : "5rem 1.5rem 3.5rem",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {/* Logo mark */}
          <img src="/favicon.png" alt="Threely" width={isMobile ? 56 : 64} height={isMobile ? 56 : 64} style={{
            borderRadius: isMobile ? 14 : 16,
            margin: isMobile ? "0 auto 1rem" : "0 auto 1.5rem",
            boxShadow: "0 8px 24px rgba(99,91,255,0.25)",
            display: "block",
          }} />

          <p style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#635bff",
            textTransform: "uppercase" as const,
            marginBottom: isMobile ? "0.5rem" : "0.75rem",
          }}>
            Do Less. Achieve More.
          </p>

          <h1 style={{
            fontSize: "clamp(2.5rem, 7vw, 4rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            marginBottom: isMobile ? "1rem" : "1.25rem",
          }}>
            Tell us your goal.<br />
            <span style={{ color: "#635bff" }}>Wake up knowing exactly what to do.</span>
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2.5vw, 1.15rem)",
            color: "#425466",
            lineHeight: 1.7,
            maxWidth: 540,
            margin: isMobile ? "0 auto 1.5rem" : "0 auto 2.5rem",
          }}>
            Not sure where to start? Don't have a plan? That's the whole point. Tell us your goal — Threely figures out your next steps and gives you a clear path forward, every single day.
          </p>

          {/* Get started button */}
          <div style={{ marginBottom: isMobile ? "1rem" : "1.5rem" }}>
            <Link href={loggedIn ? "/dashboard" : "/register"} style={{
              display: "inline-block",
              padding: "0.875rem 2.5rem",
              background: "#635bff",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1.05rem",
              borderRadius: 12,
              boxShadow: "0 4px 14px rgba(99,91,255,0.35)",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}>
              {loggedIn ? "Go to dashboard" : "Get started \u2192"}
            </Link>
          </div>

          {/* Platform availability banner */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: isMobile ? "8px 20px" : "10px 24px",
            background: "#ede9ff",
            borderRadius: 24,
            marginBottom: isMobile ? "1rem" : "1.25rem",
          }}>
            <span style={{ fontSize: isMobile ? "0.95rem" : "1.05rem" }}>{isMobile ? "📱" : "📱"}</span>
            <span style={{ fontSize: isMobile ? "0.9rem" : "0.95rem", fontWeight: 600, color: "#635bff" }}>
              {isMobile ? "Now available on mobile" : "Now available on mobile"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {platform !== "android" && (
              <Link href="/" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "14px 28px 14px 18px",
                minWidth: 190,
                background: "#0a2540",
                color: "#fff",
                borderRadius: 12,
                fontSize: "0.95rem",
                fontWeight: 600,
                textDecoration: "none",
                position: "relative" as const,
                border: "1.5px solid rgba(10,37,64,0.25)",
              }}>
                <span className="new-badge" style={{ position: "absolute" as const, top: -14, right: -10 }}>New</span>
                <AppleIcon />
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 400, opacity: 0.8 }}>Download on the</span>
                  <span style={{ fontSize: "1.05rem" }}>App Store</span>
                </span>
              </Link>
            )}
            {platform !== "ios" && (
              <Link href="/" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "14px 28px 14px 18px",
                minWidth: 190,
                background: "#0a2540",
                color: "#fff",
                borderRadius: 12,
                fontSize: "0.95rem",
                fontWeight: 600,
                textDecoration: "none",
                position: "relative" as const,
                border: "1.5px solid rgba(10,37,64,0.25)",
              }}>
                <span className="new-badge" style={{ position: "absolute" as const, top: -14, right: -10 }}>New</span>
                <PlayIcon />
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 400, opacity: 0.8 }}>Get it on</span>
                  <span style={{ fontSize: "1.05rem" }}>Google Play</span>
                </span>
              </Link>
            )}
          </div>

          {/* Social proof */}
          <div style={{
            marginTop: isMobile ? "1.25rem" : "2rem",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <div style={{ color: "#f5a623", fontSize: "1.1rem", letterSpacing: 2 }}>
              ★★★★★
            </div>
            <p style={{ fontSize: "0.85rem", color: "#8898aa", fontWeight: 500 }}>
              Join 2,000+ people making real progress every day
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
            Turn any goal into a real plan.
          </h2>
          <p style={{ color: "#425466", textAlign: "center", marginBottom: "3rem", fontSize: "0.95rem" }}>
            You bring the ambition. We bring the plan.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginBottom: "3rem",
          }}>
            {[
              { step: "01", title: "Share your goal", desc: "Type it in plain English — 'Run a 5K in 8 weeks' or 'Launch my side project by April.' Be specific. The more detail you give about your experience, timeline, and schedule, the more targeted your tasks will be." },
              { step: "02", title: "Get 3 real tasks every morning", desc: "Not 'work on your project.' You'll get things like 'Draft the pricing page copy focusing on 3 pain points from your user interviews.' Specific. Actionable. Sized to fit your time." },
              { step: "03", title: "Review & watch it adapt", desc: "Finish your tasks, rate the difficulty, leave a quick note. Threely adjusts tomorrow's plan — harder if you're cruising, easier if you're struggling. A daily loop that gets smarter over time." },
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
            Most apps give you a to-do list.<br />
            <span style={{ color: "#635bff" }}>Threely gives you a game plan.</span>
          </h2>
          <p style={{
            fontSize: "1rem", color: "#425466", lineHeight: 1.8,
            marginBottom: "1.5rem",
          }}>
            To-do apps let you write down tasks. But they don&apos;t know what to work on, in what order, or how much you can handle today. You still have to figure everything out yourself.
          </p>
          <p style={{
            fontSize: "1rem", color: "#425466", lineHeight: 1.8,
          }}>
            Threely is different. You share your goal, and our AI builds a daily plan around your experience, your schedule, and what you did yesterday. Three tasks. Specific. Actionable. Designed for exactly where you are right now.
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
            Every detail adapts to how you work, how much time you have, and how you did yesterday.
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1.25rem",
          }}>
            {[
              {
                icon: "🧠",
                title: "Gets Smarter Every Day",
                desc: "After each session you leave a quick review. Threely uses your feedback to calibrate difficulty, shift focus, and generate better tasks tomorrow.",
              },
              {
                icon: "⏱",
                title: "Fits Your Real Schedule",
                desc: "Tell us if you have 15 minutes or 2 hours. Every task is scoped to fit your actual day — not an idealized version of it.",
              },
              {
                icon: "🎚",
                title: "Your Intensity, Your Pace",
                desc: "Choose steady, committed, or all-in. Threely adjusts the challenge so you're always progressing — without burning out.",
              },
              {
                icon: "💬",
                title: "Daily Coaching Insights",
                desc: "After your review, get an AI coaching note that reflects on your progress and tells you what to focus on next.",
              },
              {
                icon: "🔄",
                title: "Tasks That Build on Each Other",
                desc: "Today's tasks reference what you did yesterday. Every day compounds — you're never starting from scratch.",
              },
              {
                icon: "🎯",
                title: "Multiple Goals, One Plan",
                desc: "Track fitness, business, learning, and more — all at once. Threely mixes tasks across your goals so nothing falls behind.",
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
            Not a one-time plan. A coaching relationship that gets better every day.
          </p>
          {[
            {
              num: "1",
              title: "Describe your goal in plain language",
              desc: "\"I want to launch a side project in 3 months. I can spend 30 minutes a day and I'm a beginner at marketing.\" — That's it. Be as specific as you can. The AI extracts your timeline, experience level, and constraints automatically.",
            },
            {
              num: "2",
              title: "Wake up knowing exactly what to do",
              desc: "Not 'work on marketing' — you'll get things like 'Write 3 cold outreach emails using pain points from your user interviews.' Sized to your schedule. Built on what you did yesterday. Ready to go.",
            },
            {
              num: "3",
              title: "Complete, review, and watch it adapt",
              desc: "Rate the difficulty. Leave a quick note. Threely generates a coaching insight, then uses your feedback, your pace, and your progress to build a better plan for tomorrow.",
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
            Do Less. Achieve More.
          </h2>
          <p style={{
            fontSize: "1.05rem",
            color: "rgba(255,255,255,0.8)",
            lineHeight: 1.6,
            marginBottom: "2rem",
          }}>
            Set your first goal and get 3 personalized tasks in under a minute.
          </p>
          <Link href="/register" style={{
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
            {platform !== "android" && (
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
            )}
            {platform !== "ios" && (
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
            )}
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────────────── */}
      <footer style={{
        background: "#0a2540",
        color: "rgba(255,255,255,0.5)",
        padding: isMobile ? "2.5rem 1.5rem 5rem" : "2.5rem 1.5rem",
        textAlign: "center",
        fontSize: "0.825rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          <img src="/favicon.png" alt="Threely" width={28} height={28} style={{ borderRadius: 7 }} />
          <span style={{ color: "#fff", fontWeight: 600 }}>Threely</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
          <Link href="/login" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.825rem" }}>
            Sign in
          </Link>
          <Link href="/register" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.825rem" }}>
            Get started
          </Link>
          <Link href="/faq" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.825rem" }}>
            FAQ
          </Link>
          <Link href="/pricing" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.825rem" }}>
            Pricing
          </Link>
          <Link href="/about" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.825rem" }}>
            About
          </Link>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
          <Link href="/privacy" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.775rem" }}>
            Privacy Policy
          </Link>
          <Link href="/terms" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.775rem" }}>
            Terms of Service
          </Link>
        </div>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} Threely. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
