"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase-client";

const TESTIMONIALS = [
  { quote: "I had a Shopify store just sitting there. Threely laid out the plan — SEO, emails, what to fix first. First time I felt like I knew what I was doing.", author: "James R.", label: "E-commerce" },
  { quote: "Been running my brand for a year and still wasn't getting much done. This app gave me a step by step plan that made sense. Revenue is way up.", author: "Daniel K.", label: "Brand Owner" },
  { quote: "I always went to the gym and did random stuff. Threely mapped out what to do each day with science-backed workouts. 2 months in, haven't missed a day.", author: "Melissa T.", label: "Fitness" },
];

const FAQ = [
  { q: "Does it work for any goal?", a: "Fitness, launching a business, learning a skill — anything. You describe what you want and Threely builds a real daily plan tailored to your experience, timeline, and schedule." },
  { q: "How personalized is it?", a: "Every set of tasks is generated fresh based on your goal, what you completed yesterday, your review feedback, and your available time. It gets better the more you use it." },
  { q: "What if I miss a day?", a: "No guilt. Just open Threely and pick up where you left off. Your progress and goal context are preserved." },
  { q: "Is it free?", a: "7-day free trial with full access. After that, choose a plan to keep your daily tasks and coaching generating." },
];

export default function LandingPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    setIsMobile(isIPad || /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua));
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) setLoggedIn(true);
    });
  }, []);

  const ctaHref = loggedIn ? "/dashboard" : "/start";
  const ctaLabel = loggedIn ? "Go to Dashboard" : "Start Free →";

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#e8e8e8", background: "#0a0a0a", overflowX: "hidden", minHeight: "100vh" }}>
      <style>{`
        @keyframes logoBreathe {
          0%,100% { transform: scale(1); filter: drop-shadow(0 0 16px rgba(99,91,255,0.4)) drop-shadow(0 0 40px rgba(99,91,255,0.15)); }
          50% { transform: scale(1.14); filter: drop-shadow(0 0 36px rgba(99,91,255,0.8)) drop-shadow(0 0 70px rgba(99,91,255,0.3)); }
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 30px rgba(99,91,255,0.2); } 50% { box-shadow: 0 0 50px rgba(99,91,255,0.4); } }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .fade-up-d1 { animation: fadeUp 0.6s ease 0.1s both; }
        .fade-up-d2 { animation: fadeUp 0.6s ease 0.2s both; }
        .fade-up-d3 { animation: fadeUp 0.6s ease 0.3s both; }
        .hero-cta { animation: glow 3s ease-in-out infinite; }
        .hero-logo { animation: logoBreathe 3s ease-in-out infinite; }
      `}</style>

      {/* ─── Nav ──────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,10,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 1.5rem", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        maxWidth: 1200, margin: "0 auto", width: "100%",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/favicon.png" alt="Threely" width={32} height={32} style={{ borderRadius: 8 }} />
          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#fff", letterSpacing: "-0.02em" }}>Threely</span>
        </div>
        {!isMobile ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {[
              { label: "How It Works", href: "#how-it-works" },
              { label: "Pricing", href: "/pricing" },
            ].map(item => (
              <Link key={item.label} href={item.href} style={{
                padding: "0.4rem 0.75rem", fontSize: "0.85rem", fontWeight: 500,
                color: "rgba(255,255,255,0.6)", textDecoration: "none", borderRadius: 6,
                transition: "color 0.15s",
              }}>{item.label}</Link>
            ))}
            <Link href="/login" style={{
              padding: "0.4rem 0.875rem", fontSize: "0.85rem", fontWeight: 600,
              color: "rgba(255,255,255,0.7)", textDecoration: "none", marginLeft: 8,
            }}>Log In</Link>
            <Link href={ctaHref} style={{
              padding: "0.5rem 1.25rem", fontSize: "0.85rem", fontWeight: 600,
              color: "#fff", background: "#635bff", borderRadius: 8,
              textDecoration: "none", marginLeft: 4,
            }}>{ctaLabel}</Link>
          </div>
        ) : (
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            background: "none", border: "none", cursor: "pointer", padding: 6,
            display: "flex", flexDirection: "column", gap: 5,
          }} aria-label="Menu">
            <span style={{ width: 22, height: 2, background: "#fff", borderRadius: 1, display: "block" }} />
            <span style={{ width: 22, height: 2, background: "#fff", borderRadius: 1, display: "block" }} />
            <span style={{ width: 22, height: 2, background: "#fff", borderRadius: 1, display: "block" }} />
          </button>
        )}
      </nav>

      {/* Mobile menu */}
      {isMobile && menuOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
          background: "rgba(0,0,0,0.95)", backdropFilter: "blur(20px)",
          padding: "80px 2rem 2rem", display: "flex", flexDirection: "column", gap: 8,
        }}>
          <button onClick={() => setMenuOpen(false)} style={{
            position: "absolute", top: 20, right: 20, background: "none", border: "none",
            color: "#fff", fontSize: 28, cursor: "pointer",
          }}>×</button>
          {[
            { label: "How It Works", href: "#how-it-works" },
            { label: "Pricing", href: "/pricing" },
            { label: "Log In", href: "/login" },
          ].map(item => (
            <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} style={{
              padding: "1rem 0", fontSize: "1.1rem", fontWeight: 600,
              color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.08)",
              textDecoration: "none",
            }}>{item.label}</Link>
          ))}
          <Link href={ctaHref} onClick={() => setMenuOpen(false)} style={{
            marginTop: 20, padding: "0.9rem 2rem", fontSize: "1rem", fontWeight: 700,
            color: "#fff", background: "#635bff", borderRadius: 12,
            textDecoration: "none", textAlign: "center",
          }}>{ctaLabel}</Link>
        </div>
      )}

      {/* ─── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: "90vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: isMobile ? "3rem 1.5rem" : "5rem 2rem",
        background: "radial-gradient(ellipse at 50% 0%, rgba(99,91,255,0.08) 0%, transparent 60%)",
        position: "relative",
      }}>
        {/* Floating logo */}
        <div className="hero-logo" style={{ marginBottom: 24 }}>
          <img src="/favicon.png" alt="" width={56} height={56} style={{ borderRadius: 16, opacity: 0.9 }} />
        </div>

        {/* Pill badge */}
        <div className="fade-up" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "0.4rem 1.25rem", borderRadius: 100,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          marginBottom: 32, fontSize: "0.8rem", fontWeight: 600,
          color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}>
          The Fastest Path To Success
        </div>

        {/* Headline */}
        <h1 className="fade-up-d1" style={{
          fontSize: isMobile ? "2.5rem" : "4.5rem",
          fontWeight: 800, lineHeight: 1.05,
          letterSpacing: "-0.03em", color: "#fff",
          maxWidth: 800, margin: "0 0 24px",
        }}>
          10x Your Productivity.<br />
          <span style={{ color: "rgba(255,255,255,0.5)" }}>Become Unrecognizable.</span>
        </h1>

        {/* Sub */}
        <p className="fade-up-d2" style={{
          fontSize: isMobile ? "1rem" : "1.2rem",
          color: "rgba(255,255,255,0.5)", lineHeight: 1.6,
          maxWidth: 520, margin: "0 0 40px",
        }}>
          Know exactly what to do when you open the app.<br />Every single day.
        </p>

        {/* CTA */}
        <Link href={ctaHref} className="hero-cta fade-up-d3" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "1rem 3rem", fontSize: "1.05rem", fontWeight: 700,
          color: "#fff", background: "#635bff", borderRadius: 14,
          textDecoration: "none", transition: "transform 0.15s, box-shadow 0.15s",
          boxShadow: "0 0 40px rgba(99,91,255,0.3)",
        }}>
          {ctaLabel}
        </Link>

        <p style={{ marginTop: 16, fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>
          $0 due today · 7-day free trial · Cancel anytime
        </p>
      </section>

      {/* Subtle divider */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {/* ─── How It Works ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{
        padding: isMobile ? "4rem 1.5rem" : "6rem 2rem",
        maxWidth: 1000, margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#635bff", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>How It Works</p>
          <h2 style={{ fontSize: isMobile ? "1.8rem" : "2.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            Stop guessing. Start executing.
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          {[
            { step: "01", title: "Tell us your goal", desc: "\"I want to launch my Shopify store and hit $5K in revenue.\" That's all Threely needs. The AI asks the right questions, builds a roadmap around your experience, timeline, and schedule." },
            { step: "02", title: "Wake up to your plan", desc: "Not 'work on marketing.' You'll get: 'Rewrite your product description to highlight the pain point from your customer research yesterday.' Specific. Actionable. Built for today." },
            { step: "03", title: "Execute, review, evolve", desc: "Complete your tasks, rate the difficulty. The AI recalibrates. Struggling? It eases up. Crushing it? It pushes harder. A daily coaching loop that compounds." },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: isMobile ? 16 : 32, alignItems: "flex-start" }}>
              <div style={{
                fontSize: "0.8rem", fontWeight: 700, color: "#635bff",
                minWidth: 40, paddingTop: 4,
              }}>{item.step}</div>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 600 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? "4rem 1.5rem" : "6rem 2rem",
        background: "rgba(255,255,255,0.02)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#635bff", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, textAlign: "center" }}>Results</p>
          <h2 style={{ fontSize: isMobile ? "1.8rem" : "2.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", textAlign: "center", marginBottom: 48 }}>
            Real people. Real progress.
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: 20,
          }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: "1.75rem",
              }}>
                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: 16 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 100, background: "rgba(99,91,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: "#635bff" }}>
                    {t.author[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>{t.author}</div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{t.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? "4rem 1.5rem" : "6rem 2rem",
        maxWidth: 1000, margin: "0 auto",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: isMobile ? "1.8rem" : "2.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            Built for people who want results.
          </h2>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap: 20,
        }}>
          {[
            { icon: "🎯", title: "AI that actually listens", desc: "Tell it your situation — what you have, what you've tried, where you're stuck. It builds from there, not from a template." },
            { icon: "📋", title: "3 tasks every morning", desc: "Specific actions with exact steps, tools, and what 'done' looks like. No vague advice." },
            { icon: "📈", title: "Adapts daily", desc: "Struggling? Easier tasks. Crushing it? Harder ones. The AI coaches based on your actual performance." },
            { icon: "💪", title: "Fitness & business", desc: "Whether you're building muscle or building revenue, the same daily system works. Real workouts. Real business plans." },
          ].map((f, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: "2rem",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? "4rem 1.5rem" : "6rem 2rem",
        maxWidth: 700, margin: "0 auto",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <h2 style={{ fontSize: isMobile ? "1.8rem" : "2.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", textAlign: "center", marginBottom: 40 }}>
          Questions
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {FAQ.map((faq, i) => (
            <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%", background: "none", border: "none", cursor: "pointer",
                  padding: "1.25rem 0", display: "flex", justifyContent: "space-between", alignItems: "center",
                  color: "#fff", fontSize: "1rem", fontWeight: 600, textAlign: "left",
                }}
              >
                {faq.q}
                <span style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.3)", transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
              </button>
              {openFaq === i && (
                <p style={{ padding: "0 0 1.25rem", fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? "4rem 1.5rem" : "6rem 2rem",
        textAlign: "center",
        background: "transparent",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <h2 style={{ fontSize: isMobile ? "1.8rem" : "2.8rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 16 }}>
          Ready to level up?
        </h2>
        <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", marginBottom: 32 }}>
          Your first 7 days are free. No credit card required.
        </p>
        <Link href={ctaHref} style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "1rem 3rem", fontSize: "1.05rem", fontWeight: 700,
          color: "#fff", background: "#635bff", borderRadius: 14,
          textDecoration: "none",
          boxShadow: "0 0 40px rgba(99,91,255,0.3)",
        }}>
          {ctaLabel}
        </Link>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{
        padding: "2rem",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        maxWidth: 1000, margin: "0 auto",
        flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>
          © {new Date().getFullYear()} Threely. All rights reserved.
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {[
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
            { label: "Support", href: "/support" },
          ].map(item => (
            <Link key={item.label} href={item.href} style={{
              fontSize: "0.8rem", color: "rgba(255,255,255,0.3)",
              textDecoration: "none",
            }}>{item.label}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
