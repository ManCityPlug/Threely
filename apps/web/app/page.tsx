"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase-client";

const TESTIMONIALS: { quote: string; author: string; label: string; image?: string }[] = [
  { quote: "I fr grew my shopify store with Threely. 10/10 recommend to everyone.", author: "George T.", label: "E-commerce", image: "/George.png" },
  { quote: "Was so confused on how to start an ecommerce brand until Threely. In a month my store was actually making money.", author: "Daniel", label: "Brand Owner", image: "/daniel.png" },
  { quote: "Had no idea where to start with my clothing brand. Threely grew it way faster than I thought possible. This app is insane.", author: "Nikolay M.", label: "Clothing Brand", image: "/nikolay.png" },
];

const SOCIAL_PROOF_LINES = [
  "Built for beginners who are tired of overthinking.",
  "Designed for people who want action, not theory.",
  "Made for first-time entrepreneurs.",
];

const WHAT_YOU_GET = [
  { icon: "🧭", title: "Business Direction", desc: "Clear path picked for your niche — no more overthinking." },
  { icon: "🏷️", title: "AI Brand Name", desc: "Ready-to-use business names generated for you." },
  { icon: "🎨", title: "Logo Concepts", desc: "Logo directions styled to match your brand." },
  { icon: "📦", title: "Product Suggestions", desc: "Winning products picked for your audience." },
  { icon: "🗺️", title: "Launch Roadmap", desc: "Step-by-step path from idea to live store." },
  { icon: "🎬", title: "Weekly Ad Creatives", desc: "Fresh static + UGC ad angles every week." },
  { icon: "⚡", title: "Daily Progress System", desc: "One clear move per day — momentum over hustle." },
  { icon: "📱", title: "Mobile App Dashboard", desc: "Your business in your pocket, always in motion." },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Answer a few questions", desc: "Tell us what you want to build and how much help you want." },
  { step: "2", title: "Get your custom launch preview", desc: "Brand name, logo direction, product, and roadmap — built for you." },
  { step: "3", title: "Build and grow with Threely", desc: "Daily moves, weekly creatives, and a dashboard to track momentum." },
];

const PAIN_POINTS = [
  { icon: "📱", title: "Too many videos. Too much noise.", desc: "You've watched 100 TikToks and still haven't launched anything." },
  { icon: "🤷", title: "Don't know what product or niche to choose.", desc: "Paralysis hits before you even get started." },
  { icon: "⏳", title: "Never take action consistently.", desc: "Without a clear path, motivation dies in a week." },
];

const FAQ = [
  { q: "Do I need experience?", a: "No. Threely is built for complete beginners. We walk you through every step." },
  { q: "Do I need coding skills?", a: "No. Zero tech skills required. If you can use Instagram, you can use Threely." },
  { q: "Can I use my own product?", a: "Yes. If you already have something to sell, we'll build everything around it. If not, we'll help you find a winner." },
  { q: "What happens after signup?", a: "You get your launch dashboard instantly — brand, logo, product direction, ad ideas, and your day-by-day roadmap." },
  { q: "Is this for beginners?", a: "Yes. If you've never launched anything before, this is built for you." },
  { q: "How much is it?", a: "$1 to start. Cancel anytime." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel in your settings whenever you want. No contracts, no hidden fees." },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !session.user.is_anonymous) setLoggedIn(true);
    });
  }, []);

  const ctaHref = loggedIn ? "/dashboard" : "/start";
  const ctaLabel = loggedIn ? "Go to Dashboard" : "Start for $1 →";

  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('revealed');
        } else {
          e.target.classList.remove('revealed');
        }
      });
    }, { threshold: 0.12 });
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#e8e8e8", background: "#141414", overflowX: "hidden", minHeight: "100vh" }}>
      <style>{`
        @keyframes logoBreathe {
          0%,100% { transform: scale(1); filter: drop-shadow(0 0 16px rgba(212,168,67,0.4)) drop-shadow(0 0 40px rgba(212,168,67,0.15)); }
          50% { transform: scale(1.14); filter: drop-shadow(0 0 36px rgba(212,168,67,0.8)) drop-shadow(0 0 70px rgba(212,168,67,0.3)); }
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(212,168,67,0.2); } 50% { box-shadow: 0 0 40px rgba(212,168,67,0.4); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes cardFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .fade-up-d1 { animation: fadeUp 0.6s ease 0.1s both; }
        .fade-up-d2 { animation: fadeUp 0.6s ease 0.2s both; }
        .fade-up-d3 { animation: fadeUp 0.6s ease 0.3s both; }
        .hero-cta { animation: glow 3s ease-in-out infinite; }
        .hero-logo { animation: logoBreathe 3s ease-in-out infinite; }
        .reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .revealed { opacity: 1; transform: translateY(0); }
        .reveal-d1 { transition-delay: 0.1s; }
        .reveal-d2 { transition-delay: 0.2s; }
        .reveal-d3 { transition-delay: 0.3s; }
        .landing-desktop-nav { display: flex; }
        .landing-mobile-toggle { display: none; }
        @media (max-width: 768px) {
          .landing-desktop-nav { display: none !important; }
          .landing-mobile-toggle { display: flex !important; }
          .landing-nav { padding: 0 1rem !important; }
        }
        .landing-testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 768px) {
          .landing-testimonials-grid { grid-template-columns: 1fr; }
        }
        .landing-steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 48px;
        }
        @media (max-width: 768px) {
          .landing-steps-grid { grid-template-columns: 1fr; gap: 40px; }
        }
        .landing-features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .landing-features-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .landing-features-grid { grid-template-columns: 1fr; }
        }
        .landing-pain-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 768px) {
          .landing-pain-grid { grid-template-columns: 1fr; }
        }
        .mock-dashboard {
          position: relative;
          width: 100%;
          max-width: 560px;
          aspect-ratio: 16/10;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.95) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 120px rgba(212,168,67,0.08);
          overflow: hidden;
          margin: 0 auto;
        }
        .mock-shimmer::after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent 30%, rgba(212,168,67,0.08) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: shimmer 4s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      {/* ─── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="landing-nav" style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#000000",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 1.5rem", height: 64,
        display: "flex", alignItems: "center", justifyContent: "center",
        maxWidth: 1200, margin: "0 auto", width: "100%",
      }}>
        <div style={{ position: "absolute", left: "1.5rem", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#fff", letterSpacing: "-0.02em" }}>Threely</span>
        </div>
        <div className="landing-desktop-nav" style={{ alignItems: "center", gap: 6 }}>
          {[
            { label: "How It Works", href: "#how-it-works" },
            { label: "Pricing", href: "/pricing" },
            { label: "Support", href: "/support" },
          ].map(item => (
            <Link key={item.label} href={item.href} style={{
              padding: "0.5rem 0.75rem", fontSize: "0.85rem", fontWeight: 500,
              color: "rgba(255,255,255,0.6)", textDecoration: "none", borderRadius: 6,
              transition: "color 0.15s", minHeight: 44, display: "inline-flex", alignItems: "center",
            }}>{item.label}</Link>
          ))}
        </div>
        <div className="landing-desktop-nav" style={{ position: "absolute", right: "1.5rem", alignItems: "center", gap: 6 }}>
          {!loggedIn && (
            <Link href="/login" style={{
              padding: "0.5rem 0.875rem", fontSize: "0.85rem", fontWeight: 600,
              color: "rgba(255,255,255,0.7)", textDecoration: "none",
              minHeight: 44, display: "inline-flex", alignItems: "center",
            }}>Log In</Link>
          )}
          <Link href={ctaHref} style={{
            padding: "0.6rem 1.25rem", fontSize: "0.85rem", fontWeight: 600,
            color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 8,
            textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center",
          }}>{ctaLabel}</Link>
        </div>
        <button
          className="landing-mobile-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            position: "absolute", right: "0.75rem",
            background: "none", border: "none", cursor: "pointer",
            width: 44, height: 44,
            alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 5,
          }}
          aria-label="Menu"
        >
          <span style={{ width: 22, height: 2, background: "#fff", borderRadius: 1, display: "block" }} />
          <span style={{ width: 22, height: 2, background: "#fff", borderRadius: 1, display: "block" }} />
          <span style={{ width: 22, height: 2, background: "#fff", borderRadius: 1, display: "block" }} />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
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
            { label: "Support", href: "/support" },
            ...(!loggedIn ? [{ label: "Log In", href: "/login" }] : []),
          ].map(item => (
            <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} style={{
              padding: "1rem 0", fontSize: "1.1rem", fontWeight: 600,
              color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.08)",
              textDecoration: "none",
            }}>{item.label}</Link>
          ))}
          <Link href={ctaHref} onClick={() => setMenuOpen(false)} style={{
            marginTop: 20, padding: "0.9rem 2rem", fontSize: "1rem", fontWeight: 700,
            color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 12,
            textDecoration: "none", textAlign: "center",
          }}>{ctaLabel}</Link>
        </div>
      )}

      {/* ─── SECTION 1: HERO ──────────────────────────────────────────────────── */}
      <section className="reveal revealed" style={{
        minHeight: "90vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: "clamp(3rem, 6vw, 5rem) clamp(1.25rem, 3vw, 2rem)",
        background: "radial-gradient(ellipse at 50% 0%, rgba(212,168,67,0.08) 0%, transparent 60%)",
        position: "relative",
      }}>
        <div className="hero-logo" style={{ marginBottom: 28 }}>
          <img src="/favicon.png" alt="" width={64} height={64} style={{ borderRadius: 18, maxWidth: "100%", height: "auto" }} />
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "0.4rem 1.25rem", borderRadius: 100,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          marginBottom: 32, fontSize: "0.8rem", fontWeight: 600,
          color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}>
          AI Business Launch Platform
        </div>

        <h1 style={{
          fontSize: "clamp(2rem, 7vw, 4.5rem)",
          fontWeight: 800, lineHeight: 1.05,
          letterSpacing: "-0.03em", color: "#fff",
          maxWidth: 900, margin: "0 0 24px",
        }}>
          Launch Your Online Business<br />
          <span style={{ color: "rgba(255,255,255,0.85)" }}>In Days, Not Months.</span>
        </h1>

        <p style={{
          fontSize: "clamp(1rem, 2.2vw, 1.15rem)",
          color: "rgba(255,255,255,0.7)",
          maxWidth: 680, lineHeight: 1.6,
          margin: "0 0 36px",
        }}>
          Get your business idea, brand, logo, launch roadmap, growth dashboard, and weekly progress system in one place.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href={ctaHref} className="hero-cta" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "1rem 3rem", fontSize: "1.05rem", fontWeight: 700,
            color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 14,
            textDecoration: "none", transition: "transform 0.15s, box-shadow 0.15s",
            boxShadow: "0 0 30px rgba(212,168,67,0.3)",
            minHeight: 52,
          }}>
            {ctaLabel}
          </Link>
          <Link href="#how-it-works" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "1rem 2rem", fontSize: "1rem", fontWeight: 600,
            color: "#fff", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14,
            textDecoration: "none", minHeight: 52,
          }}>
            See How It Works
          </Link>
        </div>

        <p style={{ marginTop: 16, fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>
          Cancel anytime · No experience needed
        </p>

        {/* Dashboard mockup */}
        <div className="mock-dashboard mock-shimmer" style={{ marginTop: 64 }}>
          <div style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
            <span style={{ marginLeft: 12, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Threely — My Launch</span>
          </div>
          <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: "calc(100% - 44px)" }}>
            <div style={{
              background: "rgba(212,168,67,0.08)",
              border: "1px solid rgba(212,168,67,0.2)",
              borderRadius: 12, padding: 16,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <div style={{ fontSize: "0.7rem", color: "#D4A843", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Your Brand</div>
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: 4 }}>Lumière Co.</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Ready to launch</div>
              </div>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Launch Progress</div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: "72%", height: "100%", background: "linear-gradient(90deg, #E8C547, #D4A843)", borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: "0.8rem", color: "#fff", fontWeight: 600 }}>5 of 7 done</div>
            </div>
            <div style={{
              gridColumn: "1 / -1",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: 16,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ fontSize: 24 }}>📦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>Today: Add your first product page</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Est. 12 min · We set up the template</div>
              </div>
              <div style={{
                padding: "6px 12px", borderRadius: 8,
                background: "rgba(212,168,67,0.15)", color: "#D4A843",
                fontSize: "0.72rem", fontWeight: 600,
              }}>Do it</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: PAIN / PROBLEM AGITATION ──────────────────────────────── */}
      <section className="reveal" style={{
        padding: "clamp(4rem, 8vw, 6rem) clamp(1.25rem, 3vw, 2rem)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, textAlign: "center" }}>
            The Problem
          </p>
          <h2 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 48, textAlign: "center", lineHeight: 1.15 }}>
            Why Most People Never Start
          </h2>
          <div className="landing-pain-grid">
            {PAIN_POINTS.map((p, i) => (
              <div key={i} className={`reveal reveal-d${i + 1}`} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: "1.75rem",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>{p.icon}</div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.3 }}>{p.title}</h3>
                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 48, textAlign: "center",
            padding: "2rem",
            background: "linear-gradient(135deg, rgba(212,168,67,0.08) 0%, rgba(212,168,67,0.02) 100%)",
            border: "1px solid rgba(212,168,67,0.2)",
            borderRadius: 16,
            maxWidth: 700, marginInline: "auto",
          }}>
            <p style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.4rem)", fontWeight: 700, color: "#fff", lineHeight: 1.4 }}>
              Threely solves all 3.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: WHAT YOU GET ─────────────────────────────────────────── */}
      <section className="reveal" style={{
        padding: "clamp(4rem, 8vw, 6rem) clamp(1.25rem, 3vw, 2rem)",
        background: "rgba(255,255,255,0.02)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, textAlign: "center" }}>
            What You Get
          </p>
          <h2 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 48, textAlign: "center", lineHeight: 1.15 }}>
            Everything You Need To Launch
          </h2>
          <div className="landing-features-grid">
            {WHAT_YOU_GET.map((f, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, padding: "1.5rem",
                transition: "border-color 0.2s, transform 0.2s",
              }}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff", marginBottom: 6, letterSpacing: "-0.01em" }}>{f.title}</h3>
                <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{f.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <Link href={ctaHref} style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "0.9rem 2.5rem", fontSize: "1rem", fontWeight: 700,
              color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 12,
              textDecoration: "none", minHeight: 48,
            }}>
              Start for $1 →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SECTION 4: HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="how-it-works" style={{
        padding: "clamp(4rem, 8vw, 6rem) clamp(1.25rem, 3vw, 2rem)",
        maxWidth: 1000, margin: "0 auto",
      }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 60 }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>How It Works</p>
          <h2 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            3 Steps To Start
          </h2>
        </div>

        <div className="reveal landing-steps-grid" style={{ textAlign: "center" }}>
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                border: "2px solid #D4A843", color: "#D4A843",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.3rem", fontWeight: 700, marginBottom: 24,
                background: "rgba(212,168,67,0.08)",
              }}>{item.step}</div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", marginBottom: 10, letterSpacing: "-0.01em" }}>{item.title}</h3>
              <p style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.6, maxWidth: 280 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 56 }}>
          <Link href={ctaHref} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "1rem 2.75rem", fontSize: "1rem", fontWeight: 700,
            color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 12,
            textDecoration: "none", minHeight: 48,
            boxShadow: "0 0 30px rgba(212,168,67,0.2)",
          }}>
            Start for $1 →
          </Link>
        </div>
      </section>

      {/* ─── SECTION 5: SOCIAL PROOF ─────────────────────────────────────────── */}
      <section style={{
        padding: "clamp(4rem, 8vw, 6rem) clamp(1.25rem, 3vw, 2rem)",
        background: "rgba(255,255,255,0.02)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="reveal" style={{ fontSize: "0.8rem", fontWeight: 600, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, textAlign: "center" }}>Real Founders, Real Results</p>
          <h2 className="reveal" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 48, textAlign: "center", lineHeight: 1.15 }}>
            Built For People Who Want To Win
          </h2>
          <div className="landing-testimonials-grid" style={{ marginBottom: 48 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={`reveal reveal-d${i + 1}`} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: "1.75rem",
                display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
              }}>
                {t.image ? (
                  <img src={t.image} alt={t.author} style={{ width: 80, height: 80, borderRadius: 100, objectFit: "cover", marginBottom: 16 }} />
                ) : (
                  <div style={{ width: 80, height: 80, borderRadius: 100, background: "rgba(212,168,67,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 700, color: "#D4A843", marginBottom: 16 }}>
                    {t.author[0]}
                  </div>
                )}
                <p style={{ fontSize: "0.9rem", color: "#fff", lineHeight: 1.7, marginBottom: 16 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fff" }}>{t.author}</div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)" }}>{t.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640, margin: "0 auto" }}>
            {SOCIAL_PROOF_LINES.map((line, i) => (
              <div key={i} className={`reveal reveal-d${i + 1}`} style={{
                padding: "1rem 1.5rem",
                background: "rgba(212,168,67,0.04)",
                border: "1px solid rgba(212,168,67,0.12)",
                borderRadius: 12,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ color: "#D4A843", fontSize: "1rem" }}>✓</span>
                <span style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 6: FUTURE COST FRAME ────────────────────────────────────── */}
      <section className="reveal" style={{
        padding: "clamp(5rem, 9vw, 7rem) clamp(1.25rem, 3vw, 2rem)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "radial-gradient(ellipse at 50% 50%, rgba(212,168,67,0.06) 0%, transparent 70%)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(1.8rem, 5.5vw, 3.2rem)",
            fontWeight: 800, color: "#fff",
            letterSpacing: "-0.02em", lineHeight: 1.1,
            marginBottom: 28,
          }}>
            Where Could You Be In 12 Months<br />If You Started Today?
          </h2>
          <p style={{
            fontSize: "clamp(1.05rem, 2.3vw, 1.25rem)",
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.6,
            maxWidth: 620, margin: "0 auto 40px",
          }}>
            If you spent the next year building instead of waiting, what could change?
          </p>
          <Link href={ctaHref} className="hero-cta" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "1.1rem 3.25rem", fontSize: "1.1rem", fontWeight: 700,
            color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 14,
            textDecoration: "none",
            boxShadow: "0 0 40px rgba(212,168,67,0.35)",
            minHeight: 56,
          }}>
            Start Now
          </Link>
          <p style={{ marginTop: 16, fontSize: "0.8rem", color: "rgba(255,255,255,0.35)" }}>
            Cancel anytime · 3-day intro access
          </p>
        </div>
      </section>

      {/* ─── SECTION 7: FAQ ──────────────────────────────────────────────────── */}
      <section style={{
        padding: "clamp(4rem, 8vw, 6rem) clamp(1.25rem, 3vw, 2rem)",
        maxWidth: 760, margin: "0 auto",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <h2 className="reveal" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", textAlign: "center", marginBottom: 48 }}>
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
                  minHeight: 56,
                }}
              >
                {faq.q}
                <span style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.3)", transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
              </button>
              {openFaq === i && (
                <p style={{ padding: "0 0 1.25rem", fontSize: "0.9rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.7 }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <a
              href="https://go.crisp.chat/chat/embed/?website_id=498b2c8b-bec0-4790-a2bb-795f9c295898"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "0.75rem 2rem", fontSize: "0.95rem", fontWeight: 600,
                color: "#fff", background: "none",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
                textDecoration: "none", minHeight: 48,
              }}
            >
              Support →
            </a>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────────────── */}
      <section style={{
        padding: "clamp(4rem, 8vw, 6rem) clamp(1.25rem, 3vw, 2rem)",
        textAlign: "center",
        background: "transparent",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <h2 className="reveal" style={{ fontSize: "clamp(1.8rem, 5vw, 2.8rem)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 32 }}>
          Stop Consuming.<br />Start Building.
        </h2>
        <Link href={ctaHref} style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "1rem 3rem", fontSize: "1.05rem", fontWeight: 700,
          color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 14,
          textDecoration: "none",
          boxShadow: "0 0 30px rgba(212,168,67,0.3)",
          minHeight: 52,
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
