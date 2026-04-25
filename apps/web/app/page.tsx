"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase-client";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

/* ─── Brand tokens ─────────────────────────────────────────────────────────── */
const NAVY = "#0a2540";
const GOLD = "#D4A843";
const TEXT = "#0f172a";
const SUBTEXT = "#475569";
const BORDER = "#e6ebf1";
const BG_SOFT = "#f8fafc";

/* ─── Tile gradients (mirrors in-app /launch hub) ──────────────────────────── */
const GRAD = {
  amber:  { bg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", fg: "#92400e" },
  blue:   { bg: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)", fg: "#1e40af" },
  green:  { bg: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)", fg: "#065f46" },
  violet: { bg: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)", fg: "#5b21b6" },
  red:    { bg: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)", fg: "#991b1b" },
  pink:   { bg: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)", fg: "#9d174d" },
  purple: { bg: "linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)", fg: "#6b21a8" },
};

type GradKey = keyof typeof GRAD;

/* ─── SVG Icons ────────────────────────────────────────────────────────────── */
function Icon({ name, color, size = 26 }: { name: string; color: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "logo":    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>;
    case "tag":     return <svg {...p}><path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83Z"/><circle cx="7" cy="7" r="1.5" fill={color}/></svg>;
    case "package": return <svg {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/></svg>;
    case "camera":  return <svg {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>;
    case "store":   return <svg {...p}><path d="M3 9h18l-1.5-5h-15L3 9ZM4 9v11h16V9M9 14h6v6H9z"/></svg>;
    case "doc":     return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>;
    case "play":    return <svg {...p}><polygon points="6 4 20 12 6 20 6 4" fill={color}/></svg>;
    case "spark":   return <svg {...p}><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/></svg>;
    case "check":   return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case "x":       return <svg {...p}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>;
    default: return null;
  }
}

/* ─── Data ─────────────────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  { quote: "I fr grew my shopify store with Threely. 10/10 recommend to everyone.", author: "George T.", label: "Ecommerce", image: "/George.png" },
  { quote: "Was so confused on how to start an ecommerce brand until Threely. In a month my store was actually making money.", author: "Daniel", label: "Brand Owner", image: "/daniel.png" },
  { quote: "Had no idea where to start with my clothing brand. Threely grew it way faster than I thought possible. This app is insane.", author: "Nikolay M.", label: "Clothing Brand", image: "/nikolay.png" },
];

const WHAT_YOU_GET: { title: string; desc: string; icon: string; grad: GradKey; premium?: boolean }[] = [
  { title: "Business name + logo", desc: "A brand identity built for your niche — name, mark, and direction.", icon: "logo", grad: "amber" },
  { title: "Product selected", desc: "We pick a winning product so you don't waste weeks researching.", icon: "tag", grad: "blue" },
  { title: "Product photos", desc: "Studio-style product imagery ready for your store and ads.", icon: "camera", grad: "green" },
  { title: "Shopify store setup", desc: "We configure the storefront — theme, structure, navigation.", icon: "store", grad: "violet" },
  { title: "Product page + copy", desc: "High-converting product page written and styled for you.", icon: "doc", grad: "red" },
  { title: "Weekly ad creatives", desc: "5 fresh static ads delivered to your inbox every week.", icon: "play", grad: "pink" },
  { title: "AI UGC ads", desc: "Scroll-stopping AI creator-style video ads.", icon: "spark", grad: "purple", premium: true },
];

const HOW_IT_WORKS = [
  { step: 1, title: "Answer a few questions", desc: "Tell us your direction, your audience, and how hands-on you want to be." },
  { step: 2, title: "We build your business", desc: "Brand, product, store, photos, and product page — built for you within days." },
  { step: 3, title: "You launch + get weekly ads", desc: "Connect payment, go live, and receive 5 fresh ad creatives every week." },
];

const PAIN_POINTS = [
  { pain: "I don't know what product to sell.", fix: "We pick a winner for you based on your niche and audience." },
  { pain: "I have no logo, no brand, no store.", fix: "We build the full identity — logo, name, store, photos, copy." },
  { pain: "I've been planning for months and still haven't launched.", fix: "First assets in 48 hours. Full store within a week." },
  { pain: "I don't know how to run ads.", fix: "5 ready-to-run creatives delivered every week. Just upload." },
];

const AD_MOCKS: { num: number; hook: string; sub: string; grad: GradKey }[] = [
  { num: 1, hook: "Stop scrolling.", sub: "If you've ever struggled with this…", grad: "amber" },
  { num: 2, hook: "POV: you finally found it.", sub: "The product everyone's reordering.", grad: "pink" },
  { num: 3, hook: "I tested 14 — this won.", sub: "Real results, not paid hype.", grad: "blue" },
  { num: 4, hook: "What 1 week looked like.", sub: "Before & after, no filter.", grad: "green" },
  { num: 5, hook: "Why this is selling out.", sub: "Grab one before it does.", grad: "violet" },
];

const TIMELINE = [
  { when: "Day 1", what: "Choose your direction" },
  { when: "Day 2", what: "Brand + product generated" },
  { when: "Day 3", what: "Shopify store + product page set up" },
  { when: "Week 1", what: "First 5 ad creatives delivered" },
  { when: "Ongoing", what: "5 new ads in your inbox every week" },
];

const FAQ = [
  { q: "Do I need any business experience?", a: "No. Threely is built for absolute beginners. Every part of the build — brand, product, store, copy, ads — is done for you." },
  { q: "Do I need to already have a Shopify store?", a: "No. If you don't have one yet, we walk you through the connection. We set up the storefront, theme, product page, and copy through the integration once you connect." },
  { q: "Do you guarantee sales?", a: "No. Anyone who promises guaranteed sales is lying. What we do guarantee is that you go from zero to a launch-ready store, with weekly ad creatives so you can start testing." },
  { q: "What do I still need to do myself?", a: "Connect Shopify and Stripe (one-time setup), fulfill orders if you ship yourself, and run the ad campaigns we deliver. Everything else is built for you." },
  { q: "How fast is setup?", a: "First brand and product assets land within 48 hours. Your full store, product page, and photos are typically ready within a week." },
  { q: "What ads do I get every week?", a: "5 fresh static ad creatives — hooks, angles, and visuals — ready to upload to Meta. AI UGC video ads are available as a premium upgrade." },
  { q: "What is AI UGC?", a: "Scroll-stopping creator-style video ads generated for your product — the format that consistently outperforms static creative on Meta and TikTok." },
  { q: "Can I use my own product?", a: "Yes. If you already have something to sell, we'll build the brand, store, photos, and ads around it." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel from your account in one click. No contracts. No hidden fees." },
];

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !session.user.is_anonymous) setLoggedIn(true);
    });
  }, []);

  const ctaHref = loggedIn ? "/dashboard" : "/start";
  const ctaLabel = loggedIn ? "Go to Dashboard" : "Get My Business Built";

  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("revealed"); });
    }, { threshold: 0.12 });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* ─── Reusable styles ──────────────────────────────────────────────────── */
  const ctaPrimary: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "1.05rem 2.2rem", fontSize: "1.02rem", fontWeight: 700,
    color: "#fff", background: NAVY, borderRadius: 12,
    textDecoration: "none", boxShadow: "0 12px 28px rgba(10,37,64,0.22)",
    transition: "transform 0.15s, box-shadow 0.15s",
    letterSpacing: "-0.01em", minHeight: 56,
  };
  const eyebrowStyle: React.CSSProperties = {
    fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.12em",
    textTransform: "uppercase", color: GOLD, marginBottom: 14,
  };
  const h2Style: React.CSSProperties = {
    fontSize: "clamp(1.85rem, 4.5vw, 2.75rem)", fontWeight: 800, color: TEXT,
    letterSpacing: "-0.025em", lineHeight: 1.1, margin: "0 auto 14px", maxWidth: 760,
  };
  const subPara: React.CSSProperties = {
    fontSize: "1.02rem", color: SUBTEXT, lineHeight: 1.6, maxWidth: 620, margin: "0 auto",
  };
  const sectionPad = "clamp(4rem, 7vw, 6rem) clamp(1.25rem, 3vw, 2rem)";
  const checkBadge: React.CSSProperties = {
    width: 22, height: 22, borderRadius: 6, background: "rgba(22,163,74,0.12)",
    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: TEXT, background: "#fff", overflowX: "hidden", minHeight: "100vh" }}>
      <style>{`
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .revealed { opacity: 1; transform: translateY(0); }
        .reveal-d1 { transition-delay: 0.08s; } .reveal-d2 { transition-delay: 0.16s; }
        .reveal-d3 { transition-delay: 0.24s; } .reveal-d4 { transition-delay: 0.32s; }
        .lp-grid-7 { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
        @media (max-width: 1024px) { .lp-grid-7 { grid-template-columns: repeat(3,1fr); } }
        @media (max-width: 768px)  { .lp-grid-7 { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 480px)  { .lp-grid-7 { grid-template-columns: 1fr; } }
        .lp-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; }
        @media (max-width: 768px) { .lp-grid-3 { grid-template-columns: 1fr; } }
        .lp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: stretch; }
        @media (max-width: 768px) { .lp-grid-2 { grid-template-columns: 1fr; } }
        .lp-hero-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 56px; align-items: center; }
        @media (max-width: 1024px) { .lp-hero-grid { grid-template-columns: 1fr; gap: 40px; text-align: center; } .lp-hero-grid > div:last-child { margin-inline: auto; } }
        .lp-ad-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 14px; }
        @media (max-width: 1024px) { .lp-ad-grid { grid-template-columns: repeat(3,1fr); } }
        @media (max-width: 600px)  { .lp-ad-grid { grid-template-columns: repeat(2,1fr); } }
        .lp-pain-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; }
        @media (max-width: 768px) { .lp-pain-grid { grid-template-columns: 1fr; } }
        .lp-tile-hover { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        .lp-tile-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,23,42,0.08); border-color: #cbd5e1; }
        .lp-cta-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 30px rgba(10,37,64,0.25); }
        .lp-cta-btn:active { transform: translateY(0); }
        @keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .lp-pulse { animation: pulseDot 1.6s ease-in-out infinite; }
      `}</style>

      <MarketingNav />

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)", padding: "clamp(3rem, 7vw, 5.5rem) clamp(1.25rem, 3vw, 2rem) clamp(3rem, 6vw, 4.5rem)", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }} className="lp-hero-grid">
          <div className="reveal revealed">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0.4rem 0.9rem", borderRadius: 999, background: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.35)", color: "#92400e", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 22 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD }} className="lp-pulse" />
              Done for you · Built in days
            </div>
            <h1 style={{ fontSize: "clamp(2.25rem, 5.6vw, 3.75rem)", fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.035em", color: TEXT, margin: "0 0 20px" }}>
              Your online business,<br />
              <span style={{ color: NAVY }}>built for you.</span>
            </h1>
            <p style={{ fontSize: "clamp(1rem, 1.8vw, 1.15rem)", color: SUBTEXT, lineHeight: 1.6, maxWidth: 540, margin: "0 0 28px" }}>
              Skip the design tutorials, product research, and Shopify rabbit holes. We build your brand, store, product page, and weekly ad creatives — so you can launch instead of plan.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Link href={ctaHref} className="lp-cta-btn" style={ctaPrimary}>{ctaLabel} <span>→</span></Link>
              <span style={{ fontSize: "0.9rem", color: SUBTEXT }}>$1 to start · Cancel anytime</span>
            </div>
            <p style={{ marginTop: 18, fontSize: "0.85rem", color: SUBTEXT, lineHeight: 1.55, maxWidth: 480 }}>
              Built for beginners who want the business done <em>with</em> them — not another course.
            </p>
          </div>
          <div className="reveal revealed reveal-d1"><BuildDashboardMock /></div>
        </div>
      </section>

      {/* ── 2. WHAT WE BUILD FOR YOU ────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={eyebrowStyle}>What we build for you</div>
            <h2 style={h2Style}>Everything your business needs — done.</h2>
            <p style={subPara}>You bring the direction. We build the brand, product, store, and ads.</p>
          </div>
          <div className="lp-grid-7">
            {WHAT_YOU_GET.map((tile, i) => {
              const g = GRAD[tile.grad];
              return (
                <div key={i} className={`reveal reveal-d${(i % 4) + 1} lp-tile-hover`} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ aspectRatio: "16/9", background: g.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={tile.icon} color={g.fg} />
                    </div>
                    {tile.premium && (
                      <span style={{ position: "absolute", top: 12, right: 12, fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", background: GOLD, color: "#1a1100", padding: "3px 9px", borderRadius: 999 }}>Premium</span>
                    )}
                  </div>
                  <div style={{ padding: "16px 18px 18px", flex: 1 }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: TEXT, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{tile.title}</h3>
                    <p style={{ fontSize: "0.86rem", color: SUBTEXT, lineHeight: 1.5, margin: 0 }}>{tile.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={eyebrowStyle}>How it works</div>
            <h2 style={h2Style}>From stuck to launched in 3 steps.</h2>
          </div>
          <div className="lp-grid-3">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.step} className={`reveal reveal-d${i + 1}`} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 20, padding: "28px 24px", boxShadow: "0 6px 18px rgba(15,23,42,0.04)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.05rem", marginBottom: 18, letterSpacing: "-0.02em" }}>{s.step}</div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: TEXT, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{s.title}</h3>
                <p style={{ fontSize: "0.95rem", color: SUBTEXT, lineHeight: 1.55, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <Link href={ctaHref} className="lp-cta-btn" style={ctaPrimary}>{ctaLabel} <span>→</span></Link>
          </div>
        </div>
      </section>

      {/* ── 4. WHY BEGINNERS FAIL ───────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={eyebrowStyle}>Why beginners fail</div>
            <h2 style={h2Style}>The friction we remove.</h2>
            <p style={subPara}>Most people don&apos;t fail because they&apos;re lazy. They fail because no one will just <em>build the first version for them</em>.</p>
          </div>
          <div className="lp-pain-grid">
            {PAIN_POINTS.map((p, i) => (
              <div key={i} className={`reveal reveal-d${(i % 4) + 1}`} style={{ background: BG_SOFT, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#7c2d12", fontSize: "1rem", fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(220,38,38,0.1)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="x" color="#b91c1c" size={20} />
                  </span>
                  &ldquo;{p.pain}&rdquo;
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, color: TEXT, fontSize: "0.95rem", fontWeight: 500, lineHeight: 1.55, paddingTop: 12, borderTop: `1px dashed ${BORDER}` }}>
                  <span style={{ ...checkBadge, marginTop: 1 }}>
                    <Icon name="check" color="#16a34a" size={18} />
                  </span>
                  {p.fix}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. WEEKLY AD DROPS ──────────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={eyebrowStyle}>Weekly ad drops</div>
            <h2 style={h2Style}>5 fresh ad creatives in your inbox every week.</h2>
            <p style={subPara}>New angles. New hooks. Ready to upload to Meta.</p>
          </div>
          <div className="lp-ad-grid">
            {AD_MOCKS.map((ad, i) => {
              const g = GRAD[ad.grad];
              return (
                <div key={i} className={`reveal reveal-d${(i % 4) + 1} lp-tile-hover`} style={{ background: g.bg, borderRadius: 18, border: `1px solid ${BORDER}`, padding: 18, display: "flex", flexDirection: "column", gap: 12, minHeight: 220, position: "relative" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: g.fg, letterSpacing: "0.08em", textTransform: "uppercase" }}>Ad #{ad.num}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: g.fg, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{ad.hook}</div>
                  <div style={{ fontSize: "0.85rem", color: g.fg, opacity: 0.85, lineHeight: 1.45, flex: 1 }}>{ad.sub}</div>
                  <div style={{ marginTop: "auto", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.55)", backdropFilter: "blur(4px)", color: g.fg, fontSize: "0.78rem", fontWeight: 700, alignSelf: "flex-start" }}>
                    Ready to upload
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: "center", marginTop: 40, fontSize: "0.9rem", color: SUBTEXT }}>
            Static creatives included on Pro · UGC video ads available as Premium upgrade
          </p>
        </div>
      </section>

      {/* ── 6. UGC PREMIUM ──────────────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }} className="lp-grid-2">
          <div className="reveal">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.35rem 0.85rem", borderRadius: 999, background: "rgba(212,168,67,0.15)", color: "#92400e", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18 }}>
              Premium upgrade
            </div>
            <h2 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 800, color: TEXT, lineHeight: 1.12, letterSpacing: "-0.025em", margin: "0 0 16px" }}>
              Turn your product into scroll-stopping AI creator ads.
            </h2>
            <p style={{ fontSize: "1.02rem", color: SUBTEXT, lineHeight: 1.6, margin: "0 0 24px" }}>
              UGC-style video ads consistently outperform static creative on Meta and TikTok. With Premium, we generate creator-style video ads for your product — no filming, no editing, no influencer outreach.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "AI creator-style video ads for your product",
                "Multiple hooks and angles tested for you",
                "Vertical format — Reels, TikTok, Shorts ready",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "center", color: TEXT, fontSize: "0.95rem" }}>
                  <span style={checkBadge}><Icon name="check" color="#16a34a" size={18} /></span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href={ctaHref} className="lp-cta-btn" style={ctaPrimary}>Start with Pro <span>→</span></Link>
          </div>
          <div className="reveal reveal-d1" style={{ display: "flex", justifyContent: "center" }}>
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* ── 7. SHOPIFY ──────────────────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }} className="lp-grid-2">
          <div className="reveal" style={{ order: 2 }}>
            <div style={eyebrowStyle}>Built into Shopify</div>
            <h2 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 800, color: TEXT, lineHeight: 1.12, letterSpacing: "-0.025em", margin: "0 0 16px" }}>
              Built directly into your Shopify store.
            </h2>
            <p style={{ fontSize: "1.02rem", color: SUBTEXT, lineHeight: 1.6, margin: "0 0 14px" }}>
              We set up your storefront, theme, product page, photos, and copy through the Shopify integration. You connect Shopify and Stripe (one-time, takes minutes), and we build the rest.
            </p>
            <p style={{ fontSize: "0.92rem", color: SUBTEXT, lineHeight: 1.55, margin: "0 0 24px" }}>
              Honest note: connecting Shopify and payments is on you. Building the actual store, product page, and creatives is on us.
            </p>
            <Link href={ctaHref} className="lp-cta-btn" style={ctaPrimary}>{ctaLabel} <span>→</span></Link>
          </div>
          <div className="reveal reveal-d1" style={{ order: 1 }}><ShopifyMock /></div>
        </div>
      </section>

      {/* ── 8. BEFORE / AFTER ───────────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: NAVY, color: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ ...eyebrowStyle, color: GOLD, marginBottom: 12 }}>Before & after Threely</div>
            <h2 style={{ fontSize: "clamp(1.85rem, 4.5vw, 2.75rem)", fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.025em", margin: 0 }}>
              From <span style={{ color: "rgba(255,255,255,0.5)" }}>nothing</span> to <span style={{ color: GOLD }}>launched</span>.
            </h2>
          </div>
          <div className="lp-grid-2">
            <div className="reveal" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "28px" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 18 }}>Before</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "No idea what to sell",
                  "No logo, no brand identity",
                  "No store, no product page",
                  "No ad creatives — nothing to test",
                  "Stuck in tutorial loops, never launching",
                ].map((item, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, alignItems: "center", color: "rgba(255,255,255,0.55)", fontSize: "0.96rem", textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.25)" }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(255,255,255,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="x" color="rgba(255,255,255,0.55)" size={18} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="reveal reveal-d1" style={{ background: "linear-gradient(135deg, rgba(212,168,67,0.18) 0%, rgba(212,168,67,0.06) 100%)", border: "1px solid rgba(212,168,67,0.4)", borderRadius: 20, padding: "28px", boxShadow: "0 20px 60px rgba(212,168,67,0.12)" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: GOLD, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 18 }}>After</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Brand name + logo built for your niche",
                  "Product picked, photographed, page written",
                  "Shopify store set up and styled",
                  "5 fresh ad creatives in your inbox every week",
                  "Live, launched, and testing",
                ].map((item, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, alignItems: "center", color: "#fff", fontSize: "0.96rem", fontWeight: 500 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(212,168,67,0.25)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="check" color={GOLD} size={18} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. TIMELINE ─────────────────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: "#fff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={eyebrowStyle}>Timeline</div>
            <h2 style={h2Style}>What your first week looks like.</h2>
          </div>
          <div style={{ position: "relative", paddingLeft: 32 }}>
            <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 2, background: `linear-gradient(180deg, ${GOLD} 0%, ${BORDER} 100%)` }} />
            {TIMELINE.map((t, i) => (
              <div key={i} className={`reveal reveal-d${(i % 4) + 1}`} style={{ position: "relative", padding: "14px 0 24px", display: "flex", alignItems: "flex-start", gap: 20 }}>
                <div style={{ position: "absolute", left: -32, top: 16, width: 24, height: 24, borderRadius: "50%", background: i < TIMELINE.length - 1 ? GOLD : NAVY, border: "4px solid #fff", boxShadow: "0 0 0 2px " + (i < TIMELINE.length - 1 ? GOLD : NAVY) }} />
                <div style={{ minWidth: 90, fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: GOLD, paddingTop: 4 }}>{t.when}</div>
                <div style={{ flex: 1, fontSize: "1.05rem", fontWeight: 600, color: TEXT, lineHeight: 1.4 }}>{t.what}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10. TESTIMONIALS ────────────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={eyebrowStyle}>Real founders</div>
            <h2 style={h2Style}>Built for people who actually launched.</h2>
          </div>
          <div className="lp-grid-3">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={`reveal reveal-d${i + 1}`} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, padding: "26px 24px 24px", display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 6px 18px rgba(15,23,42,0.04)" }}>
                <div style={{ display: "flex", gap: 2, color: GOLD, fontSize: "0.95rem" }}>★★★★★</div>
                <p style={{ fontSize: "0.98rem", color: TEXT, lineHeight: 1.6, margin: 0, flex: 1, fontWeight: 500 }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={t.image} alt={t.author} width={48} height={48} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: TEXT }}>{t.author}</div>
                    <div style={{ fontSize: "0.82rem", color: SUBTEXT }}>{t.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 11. PRICING ─────────────────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={eyebrowStyle}>Pricing</div>
            <h2 style={h2Style}>Get your business built for $1.</h2>
            <p style={subPara}>Everything done for you · Cancel anytime · No contracts.</p>
          </div>
          <div className="reveal reveal-d1" style={{ background: "#fff", border: `2px solid ${NAVY}`, borderRadius: 24, padding: "36px 28px 32px", boxShadow: "0 24px 60px rgba(10,37,64,0.12)", position: "relative" }}>
            <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: GOLD, color: "#1a1100", padding: "5px 16px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              Done for you
            </div>
            <div style={{ textAlign: "center", marginTop: 6 }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: NAVY, marginBottom: 14 }}>Threely Pro</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: "clamp(2.5rem, 7vw, 3.25rem)", fontWeight: 800, letterSpacing: "-0.03em", color: TEXT, lineHeight: 1 }}>$1</span>
                <span style={{ fontSize: "1rem", color: SUBTEXT }}>today</span>
              </div>
              <p style={{ fontSize: "0.95rem", color: SUBTEXT, lineHeight: 1.55, margin: "0 auto 24px", maxWidth: 420 }}>
                Then <strong style={{ color: TEXT }}>$39/month</strong> after your 3-day Launch Preview. Cancel inside the preview and you won&apos;t be charged a cent more.
              </p>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Business name + logo direction",
                "Product selection + winning niche",
                "Shopify store setup + theme",
                "Product photos + product page copy",
                "5 fresh ad creatives every week",
                "Mobile dashboard + progress tracking",
              ].map((line, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.95rem", color: TEXT, padding: "10px 14px", background: BG_SOFT, borderRadius: 10 }}>
                  <span style={checkBadge}><Icon name="check" color="#16a34a" size={18} /></span>
                  {line}
                </li>
              ))}
            </ul>
            <Link href={ctaHref} className="lp-cta-btn" style={{ display: "block", textAlign: "center", padding: "1.05rem 1.5rem", background: NAVY, color: "#fff", borderRadius: 14, fontWeight: 700, fontSize: "1.02rem", textDecoration: "none", boxShadow: "0 12px 28px rgba(10,37,64,0.22)", transition: "transform 0.15s, box-shadow 0.15s", letterSpacing: "-0.01em" }}>
              {ctaLabel} →
            </Link>
            <p style={{ fontSize: "0.78rem", color: SUBTEXT, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              Cancel anytime · 14-day refund on first Pro charge · No contracts
            </p>
          </div>
          <div className="reveal reveal-d2" style={{ marginTop: 32, textAlign: "center" }}>
            <p style={{ fontSize: "0.82rem", fontWeight: 700, color: SUBTEXT, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Available add-ons</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {["More weekly ads", "AI UGC video pack", "Faster build", "Premium product photos"].map((tag, i) => (
                <span key={i} style={{ padding: "6px 14px", background: BG_SOFT, border: `1px solid ${BORDER}`, borderRadius: 999, fontSize: "0.82rem", color: TEXT, fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 12. FAQ ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: sectionPad, background: BG_SOFT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={eyebrowStyle}>FAQ</div>
            <h2 style={h2Style}>Everything else you might be wondering.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ.map((faq, i) => {
              const open = openFaq === i;
              return (
                <div key={i} className="reveal" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
                  <button onClick={() => setOpenFaq(open ? null : i)} style={{ width: "100%", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, cursor: "pointer", background: "transparent", border: "none", color: TEXT, fontSize: "1rem", fontWeight: 700, textAlign: "left", letterSpacing: "-0.01em" }}>
                    {faq.q}
                    <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: BG_SOFT, display: "inline-flex", alignItems: "center", justifyContent: "center", color: NAVY, fontSize: "1.1rem", fontWeight: 700, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
                  </button>
                  {open && (
                    <div style={{ padding: "0 22px 20px", fontSize: "0.93rem", color: SUBTEXT, lineHeight: 1.65 }}>{faq.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 13. FINAL CTA ───────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(5rem, 9vw, 7rem) clamp(1.25rem, 3vw, 2rem)", background: `radial-gradient(ellipse at 50% 0%, rgba(212,168,67,0.18) 0%, ${NAVY} 60%)`, color: "#fff", textAlign: "center" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="reveal revealed" style={{ ...eyebrowStyle, color: GOLD, marginBottom: 18 }}>
            Stop planning. Start launching.
          </div>
          <h2 className="reveal" style={{ fontSize: "clamp(2rem, 5.5vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 22px", color: "#fff" }}>
            Get your business built.
          </h2>
          <p className="reveal reveal-d1" style={{ fontSize: "clamp(1rem, 2vw, 1.15rem)", color: "rgba(255,255,255,0.75)", lineHeight: 1.6, maxWidth: 560, margin: "0 auto 36px" }}>
            Brand. Product. Store. Photos. Weekly ads. Done for you. $1 to start.
          </p>
          <Link href={ctaHref} className="lp-cta-btn reveal reveal-d2" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "1.2rem 2.75rem", fontSize: "1.1rem", fontWeight: 800, color: "#1a1100", background: `linear-gradient(135deg, #F5D37E 0%, ${GOLD} 50%, #B8862D 100%)`, borderRadius: 14, textDecoration: "none", boxShadow: "0 16px 40px rgba(212,168,67,0.4)", transition: "transform 0.15s, box-shadow 0.15s", letterSpacing: "-0.01em", minHeight: 60 }}>
            {ctaLabel} <span>→</span>
          </Link>
          <p className="reveal reveal-d3" style={{ marginTop: 18, fontSize: "0.85rem", color: "rgba(255,255,255,0.55)" }}>
            $1 today · Cancel anytime · 14-day refund
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

/* ─── Hero "Build Dashboard" Mock ──────────────────────────────────────────── */
function BuildDashboardMock() {
  const items: { label: string; value: string; status: "done" | "loading"; grad: GradKey; icon: string }[] = [
    { label: "Brand name", value: "The Coffee Edit", status: "done", grad: "amber", icon: "logo" },
    { label: "Logo", value: "Ready", status: "done", grad: "blue", icon: "tag" },
    { label: "Product", value: "Selected", status: "done", grad: "green", icon: "package" },
    { label: "Product photos", value: "Ready", status: "done", grad: "violet", icon: "camera" },
    { label: "Shopify store", value: "Connecting…", status: "loading", grad: "red", icon: "store" },
    { label: "Ads this week", value: "5 ready", status: "done", grad: "pink", icon: "play" },
  ];

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 24, boxShadow: "0 30px 80px rgba(15,23,42,0.10), 0 6px 18px rgba(15,23,42,0.04)", overflow: "hidden", maxWidth: 540, margin: "0 auto" }}>
      <div style={{ padding: "12px 18px", background: BG_SOFT, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        <span style={{ marginLeft: 10, fontSize: "0.78rem", color: SUBTEXT, fontWeight: 600 }}>Your Business · Build Dashboard</span>
      </div>
      <div style={{ padding: "20px 22px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: GOLD, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Done for you</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: TEXT, letterSpacing: "-0.02em" }}>Your business build</div>
        </div>
        <div style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(22,163,74,0.12)", color: "#15803d", fontSize: "0.74rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a" }} />
          5 of 6 ready
        </div>
      </div>
      <div style={{ padding: "0 22px 16px" }}>
        <div style={{ height: 8, background: BG_SOFT, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: "83%", height: "100%", background: `linear-gradient(90deg, ${GOLD}, #B8862D)`, borderRadius: 999 }} />
        </div>
      </div>
      <div style={{ padding: "0 14px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it, i) => {
          const g = GRAD[it.grad];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: g.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={it.icon} color={g.fg} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>{it.label}</div>
                <div style={{ fontSize: "0.78rem", color: SUBTEXT, marginTop: 1 }}>{it.value}</div>
              </div>
              {it.status === "done" ? (
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(22,163,74,0.12)", color: "#15803d", fontSize: "0.7rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Icon name="check" color="#15803d" size={14} />
                </span>
              ) : (
                <span className="lp-pulse" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(212,168,67,0.15)", color: "#92400e", fontSize: "0.7rem", fontWeight: 700 }}>In progress</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Phone (UGC) mock ─────────────────────────────────────────────────────── */
function PhoneMock() {
  return (
    <div style={{ width: "min(280px, 100%)", aspectRatio: "9/19", borderRadius: 36, background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)", padding: 10, boxShadow: "0 30px 60px rgba(15,23,42,0.25)", position: "relative" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 28, background: "linear-gradient(135deg, #fce7f3 0%, #ddd6fe 50%, #dbeafe 100%)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 80, height: 18, borderRadius: 999, background: "#0f172a" }} />
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(15,23,42,0.2)" }}>
          <Icon name="play" color={NAVY} />
        </div>
        <div style={{ position: "absolute", bottom: 22, left: 16, right: 16, padding: "10px 14px", borderRadius: 14, background: "rgba(15,23,42,0.78)", color: "#fff", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.35, backdropFilter: "blur(4px)" }}>
          &ldquo;Bro you have to try this product…&rdquo;
        </div>
      </div>
    </div>
  );
}

/* ─── Shopify storefront mock ──────────────────────────────────────────────── */
function ShopifyMock() {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 16px 48px rgba(15,23,42,0.08)" }}>
      <div style={{ padding: "10px 14px", background: "#f1f5f9", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        <div style={{ flex: 1, marginLeft: 8, padding: "4px 10px", borderRadius: 6, background: "#fff", fontSize: "0.72rem", color: SUBTEXT, border: `1px solid ${BORDER}` }}>
          thecoffeeedit.myshopify.com
        </div>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT, letterSpacing: "-0.01em" }}>The Coffee Edit</div>
          <div style={{ display: "flex", gap: 12, fontSize: "0.78rem", color: SUBTEXT }}>
            <span>Shop</span><span>About</span><span>Cart</span>
          </div>
        </div>
        <div style={{ aspectRatio: "16/9", borderRadius: 12, background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#92400e", fontSize: "0.82rem", fontWeight: 700 }}>
          Brewed for the early hours.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {(["amber", "green", "blue"] as GradKey[]).map((k, i) => (
            <div key={i} style={{ aspectRatio: "1", borderRadius: 10, background: GRAD[k].bg, display: "flex", alignItems: "center", justifyContent: "center", color: GRAD[k].fg, fontSize: "1.4rem" }}>☕</div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: BG_SOFT, borderRadius: 10, fontSize: "0.82rem" }}>
          <span style={{ color: TEXT, fontWeight: 700 }}>Add to cart</span>
          <span style={{ color: SUBTEXT }}>$24.00</span>
        </div>
      </div>
    </div>
  );
}
