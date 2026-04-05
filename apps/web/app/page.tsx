"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase-client";

const TESTIMONIALS: { quote: string; author: string; label: string; image?: string }[] = [
  { quote: "I had a Shopify store just sitting there. Threely laid out the plan — SEO, emails, what to fix first. First time I felt like I knew what I was doing.", author: "George T.", label: "E-commerce", image: "/George.png" },
  { quote: "I was so confused on how to start an ecommerce brand until I started using Threely. It truly told me step by step what to do and by month 2 i'm making 7k/month from my new store.", author: "Daniel", label: "Brand Owner", image: "/daniel.png" },
  { quote: "This app is actually very useful. Been getting amazing progress in the gym with it.", author: "Nikolay M.", label: "Fitness", image: "/nikolay.png" },
];

const FAQ = [
  { q: "Is it free?", a: "7-day free trial with full access. After that, choose a plan to keep going. Cancel anytime." },
  { q: "What if I miss a day?", a: "No guilt. Just open Threely and pick up where you left off. Your progress is saved." },
  { q: "Does it work for fitness too?", a: "Yes. Threely builds real workout plans based on your experience level, schedule, and goals. It adapts every day based on how your sessions went." },
  { q: "How long before I see results?", a: "Most users notice a difference within the first week. You're doing 3 focused tasks every single day — that compounds fast." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel in your settings whenever you want. No contracts, no hidden fees, no questions asked." },
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

  const ctaHref = loggedIn ? "/dashboard" : "/signup";
  const ctaLabel = loggedIn ? "Go to Dashboard" : "Lock TF In →";

  // Scroll reveal — fade in on enter, fade out on leave
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
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#e8e8e8", background: "#0a0a0a", overflowX: "hidden", minHeight: "100vh" }}>
      <style>{`
        @keyframes logoBreathe {
          0%,100% { transform: scale(1); filter: drop-shadow(0 0 16px rgba(212,168,67,0.4)) drop-shadow(0 0 40px rgba(212,168,67,0.15)); }
          50% { transform: scale(1.14); filter: drop-shadow(0 0 36px rgba(212,168,67,0.8)) drop-shadow(0 0 70px rgba(212,168,67,0.3)); }
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(212,168,67,0.2); } 50% { box-shadow: 0 0 40px rgba(212,168,67,0.4); } }
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
      `}</style>

      {/* ─── Nav ──────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,10,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 1.5rem", height: 64,
        display: "flex", alignItems: "center", justifyContent: "center",
        maxWidth: 1200, margin: "0 auto", width: "100%",
      }}>
        <div style={{ position: "absolute", left: "1.5rem", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#fff", letterSpacing: "-0.02em" }}>Threely</span>
        </div>
        {!isMobile ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {[
                { label: "How It Works", href: "#how-it-works" },
                { label: "Pricing", href: "/pricing" },
                { label: "Support", href: "/support" },
              ].map(item => (
                <Link key={item.label} href={item.href} style={{
                  padding: "0.4rem 0.75rem", fontSize: "0.85rem", fontWeight: 500,
                  color: "rgba(255,255,255,0.6)", textDecoration: "none", borderRadius: 6,
                  transition: "color 0.15s",
                }}>{item.label}</Link>
              ))}
            </div>
            <div style={{ position: "absolute", right: "1.5rem", display: "flex", alignItems: "center", gap: 6 }}>
              <Link href="/login" style={{
                padding: "0.4rem 0.875rem", fontSize: "0.85rem", fontWeight: 600,
                color: "rgba(255,255,255,0.7)", textDecoration: "none",
              }}>Log In</Link>
              <Link href={ctaHref} style={{
                padding: "0.5rem 1.25rem", fontSize: "0.85rem", fontWeight: 600,
                color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 8,
                textDecoration: "none",
              }}>{ctaLabel}</Link>
            </div>
          </>
        ) : (
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            position: "absolute", right: "1.5rem",
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
            { label: "Support", href: "/support" },
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
            color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 12,
            textDecoration: "none", textAlign: "center",
          }}>{ctaLabel}</Link>
        </div>
      )}

      {/* ─── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="reveal revealed" style={{
        minHeight: "90vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: isMobile ? "3rem 1.5rem" : "5rem 2rem",
        background: "radial-gradient(ellipse at 50% 0%, rgba(212,168,67,0.08) 0%, transparent 60%)",
        position: "relative",
      }}>
        {/* Breathing logo */}
        <div className="hero-logo" style={{ marginBottom: 28 }}>
          <img src="/favicon.png" alt="" width={64} height={64} style={{ borderRadius: 18 }} />
        </div>

        {/* Pill badge */}
        <div style={{
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
        <h1 style={{
          fontSize: isMobile ? "2.5rem" : "4.5rem",
          fontWeight: 800, lineHeight: 1.05,
          letterSpacing: "-0.03em", color: "#fff",
          maxWidth: 800, margin: "0 0 24px",
        }}>
          10x Your Productivity.<br />
          <span style={{ color: "rgba(255,255,255,0.5)" }}>Become</span><br />
          <span style={{ color: "rgba(255,255,255,0.5)" }}>Rich as F*ck.</span>
        </h1>

        {/* CTA */}
        <Link href={ctaHref} className="hero-cta" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "1rem 3rem", fontSize: "1.05rem", fontWeight: 700,
          color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 14,
          textDecoration: "none", transition: "transform 0.15s, box-shadow 0.15s",
          boxShadow: "0 0 30px rgba(212,168,67,0.3)",
        }}>
          {ctaLabel}
        </Link>

        <p style={{ marginTop: 16, fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>
          $0 due today · 7-day free trial · Cancel anytime
        </p>
      </section>

      {/* ─── ChatGPT comparison ──────────────────────────────────────────────── */}
      <section className="reveal" style={{
        padding: isMobile ? "4rem 1.5rem" : "6rem 2rem",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, textAlign: "center" }}>
            How is this different from ChatGPT?
          </p>
          <h2 style={{ fontSize: isMobile ? "1.6rem" : "2.4rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 24, lineHeight: 1.15, textAlign: "center" }}>
            You{"'"}ve had ChatGPT for 4 years.<br />What have you accomplished?
          </h2>
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: isMobile ? "1.75rem" : "2.5rem 3rem",
            marginBottom: 32, textAlign: "center",
          }}>
            <p style={{ fontSize: isMobile ? "0.95rem" : "1.05rem", fontWeight: 600, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, margin: 0 }}>
              Threely tells you exactly what{"'"}s needed, personalized to you — not generic BS that{"'"}s keeping you stuck.
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <Link href={ctaHref} style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "0.85rem 2.5rem", fontSize: "1rem", fontWeight: 700,
              color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 12,
              textDecoration: "none",
            }}>
              Lock In →
            </Link>
          </div>
        </div>
      </section>

      {/* Subtle divider */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {/* ─── How It Works ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{
        padding: isMobile ? "4rem 1.5rem" : "6rem 2rem",
        maxWidth: 1000, margin: "0 auto",
      }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 60 }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>How It Works</p>
          <h2 style={{ fontSize: isMobile ? "1.8rem" : "2.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            Stop guessing.
          </h2>
        </div>

        <div className="reveal" style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          {[
            { step: "01", title: "Tell us your goal", desc: "\"I want to launch my Shopify store and hit $5K in revenue.\" That's all Threely needs. The AI asks the right questions, builds a roadmap around your experience, timeline, and schedule." },
            { step: "02", title: "Wake up to your plan", desc: "Not 'work on marketing.' You'll get: 'Rewrite your product description to highlight the pain point from your customer research yesterday.' Specific. Actionable. Built for today." },
            { step: "03", title: "Execute, review, evolve", desc: "Complete your tasks, rate the difficulty. The AI recalibrates. Struggling? It eases up. Crushing it? It pushes harder. A daily coaching loop that compounds." },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: isMobile ? 16 : 32, alignItems: "flex-start" }}>
              <div style={{
                fontSize: "0.8rem", fontWeight: 700, color: "#D4A843",
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
          <p className="reveal" style={{ fontSize: "0.8rem", fontWeight: 600, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 48, textAlign: "center" }}>Results</p>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: 20,
          }}>
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
                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: 16 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fff" }}>{t.author}</div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>{t.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? "4rem 1.5rem" : "6rem 2rem",
        maxWidth: 700, margin: "0 auto",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <h2 className="reveal" style={{ fontSize: isMobile ? "1.8rem" : "2.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", textAlign: "center", marginBottom: 40 }}>
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
        <h2 className="reveal" style={{ fontSize: isMobile ? "1.8rem" : "2.8rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 32 }}>
          Lock The F*ck In.
        </h2>
        <Link href={ctaHref} style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "1rem 3rem", fontSize: "1.05rem", fontWeight: 700,
          color: "#000", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", borderRadius: 14,
          textDecoration: "none",
          boxShadow: "0 0 30px rgba(212,168,67,0.3)",
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
