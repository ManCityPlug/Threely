"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { getSupabase } from "@/lib/supabase-client";

/* ─── Brand tokens (mirrors /app/page.tsx) ──────────────────────────────────── */
const NAVY = "#0a2540";
const GOLD = "#D4A843";
const TEXT = "#0f172a";
const SUBTEXT = "#475569";
const BORDER = "#e6ebf1";
const BG_SOFT = "#f8fafc";

type Plan = "monthly" | "yearly";
type Tier = "standard" | "pro";

interface TierDef {
  id: Tier;
  name: string;
  tagline: string;
  /** Monthly = displayed monthly billing price, Yearly = displayed yearly billing price. */
  monthly: { price: number; perDay: string; afterTrial: string; saveYearly: string };
  yearly:  { price: number; perDay: string; afterTrial: string; equivMonthly: string; savings: string };
  features: string[];
  highlight?: boolean;
}

// Standard yearly = $99 vs $39*12=$468 → saves $369
// Pro yearly      = $199 vs $79*12=$948 → saves $749
const TIERS: TierDef[] = [
  {
    id: "standard",
    name: "Standard",
    tagline: "Everything you need to launch.",
    monthly: {
      price: 39,
      perDay: "$1.30/day",
      afterTrial: "Then $39/month after your 3-day Launch Preview.",
      saveYearly: "Save $369/yr with Annual",
    },
    yearly: {
      price: 99,
      perDay: "$0.27/day",
      afterTrial: "Then $99/year after your 3-day Launch Preview.",
      equivMonthly: "$8.25/mo",
      savings: "Save $369/yr vs monthly",
    },
    features: [
      "Business name + logo direction",
      "Product / niche selection",
      "Shopify store + theme setup",
      "Product page + product copy",
      "Standard product photos",
      "5 fresh static ad creatives every week",
      "Mobile dashboard + progress tracking",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Everything in Standard, plus AI UGC video ads.",
    monthly: {
      price: 79,
      perDay: "$2.63/day",
      afterTrial: "Then $79/month after your 3-day Launch Preview.",
      saveYearly: "Save $749/yr with Annual",
    },
    yearly: {
      price: 199,
      perDay: "$0.55/day",
      afterTrial: "Then $199/year after your 3-day Launch Preview.",
      equivMonthly: "$16.58/mo",
      savings: "Save $749/yr vs monthly",
    },
    features: [
      "Everything in Standard",
      "5 AI UGC video ads every week (creator-style, ready for Reels & TikTok)",
      "Premium product photos",
      "Priority build (faster delivery)",
      "Add-on credits for extra ads or products",
    ],
    highlight: true,
  },
];

const FAQS = [
  { q: "What exactly is the $1 Launch Preview?", a: "3 days of access to your personalized preview — brand name, logo direction, product recommendation, Shopify setup, launch roadmap, and sample ad concepts. After 3 days, your selected plan activates." },
  { q: "Can I cancel during the preview?", a: "Yes. Cancel during your 3-day preview and you won't be charged anything beyond the $1. After activation, cancel any time from your account — you keep access until the end of your billing period." },
  { q: "What's the difference between Standard and Pro?", a: "Standard gives you everything to launch — brand, store, product page, photos, and 5 fresh static ads every week. Pro adds AI UGC-style video ads for Reels and TikTok, premium product photos, priority build, and add-on credits." },
  { q: "Is there a refund policy?", a: "Yes. 14-day no-questions-asked refund on your first paid charge. Email refund@threely.co and we'll refund in full." },
];

/* ─── Tiny inline icon (avoid adding any new dep) ─────────────────────────── */
function Check({ size = 18, color = "#16a34a" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function PricingPageClient() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>("yearly");
  const [loggedIn, setLoggedIn] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Auth-aware CTA
  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !session.user.is_anonymous) setLoggedIn(true);
    });
  }, []);

  // Restore prior tier preference if any (so toggling pricing → quiz → back keeps it)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("threely_pricing_plan");
      if (saved === "monthly" || saved === "yearly") setPlan(saved);
    } catch { /* ignore */ }
  }, []);

  // Persist plan choice
  useEffect(() => {
    try { localStorage.setItem("threely_pricing_plan", plan); } catch { /* ignore */ }
  }, [plan]);

  function handleCTA(tier: Tier) {
    try { localStorage.setItem("threely_pricing_tier", tier); } catch { /* ignore */ }
    if (loggedIn) {
      router.push(`/checkout?plan=${plan}&tier=${tier}`);
    } else {
      // Logged-out flow — send to /start (the funnel will pick up the saved tier)
      router.push("/start");
    }
  }

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: TEXT,
      background: "#fff",
      minHeight: "100vh",
    }}>
      <style>{`
        .price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: stretch; }
        @media (max-width: 880px) { .price-grid { grid-template-columns: 1fr; gap: 32px; } }
        .price-card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .price-card-hover:hover { transform: translateY(-2px); }
        .pill-btn { transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease; }
      `}</style>

      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
        padding: "clamp(3.5rem, 7vw, 5.5rem) clamp(1.25rem, 3vw, 2rem) clamp(2rem, 4vw, 3rem)",
        textAlign: "center",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "0.4rem 0.9rem", borderRadius: 999,
            background: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.35)",
            color: "#92400e", fontSize: "0.78rem", fontWeight: 700,
            letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 22,
          }}>
            Done for you · $1 Launch Preview
          </div>
          <h1 style={{
            fontSize: "clamp(2rem, 5.4vw, 3.25rem)",
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
            margin: "0 0 18px",
            color: TEXT,
          }}>
            Pick the plan that<br />
            <span style={{ color: NAVY }}>builds your business.</span>
          </h1>
          <p style={{ fontSize: "1.05rem", color: SUBTEXT, lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
            Both plans start at $1 today. Cancel inside your 3-day Launch Preview and you won&apos;t pay another cent.
          </p>
        </div>

        {/* ── Billing toggle ────────────────────────────────────────────── */}
        <div style={{
          marginTop: 32,
          display: "inline-flex",
          padding: 4,
          borderRadius: 999,
          background: BG_SOFT,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
          gap: 4,
        }}>
          {(["yearly", "monthly"] as const).map((p) => {
            const active = plan === p;
            return (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className="pill-btn"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "0.65rem 1.25rem",
                  borderRadius: 999,
                  border: "none",
                  background: active ? "#fff" : "transparent",
                  color: active ? TEXT : SUBTEXT,
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  boxShadow: active ? "0 4px 14px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.06)" : "none",
                  minHeight: 40,
                }}
              >
                {p === "yearly" ? "Annual" : "Monthly"}
                {p === "yearly" && (
                  <span style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(22,163,74,0.12)",
                    color: "#15803d",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                  }}>
                    Save up to $749
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {plan === "yearly" && (
          <p style={{ marginTop: 14, fontSize: "0.82rem", color: SUBTEXT, letterSpacing: "0.02em" }}>
            Limited-time annual pricing — same $1 entry, lower monthly equivalent.
          </p>
        )}
      </section>

      {/* ── Plan cards ─────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(2.5rem, 5vw, 4rem) clamp(1.25rem, 3vw, 2rem) clamp(3rem, 6vw, 5rem)", background: "#fff" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div className="price-grid">
            {TIERS.map((tier) => (
              <PlanCard
                key={tier.id}
                tier={tier}
                plan={plan}
                loggedIn={loggedIn}
                onCTA={() => handleCTA(tier.id)}
                onSwitchToAnnual={() => setPlan("yearly")}
              />
            ))}
          </div>

          {/* Trust line under cards */}
          <p style={{
            marginTop: 32,
            textAlign: "center",
            fontSize: "0.85rem",
            color: SUBTEXT,
            lineHeight: 1.6,
          }}>
            $1 today on either plan · Cancel inside the 3-day preview, pay nothing more · 14-day refund on first paid charge
          </p>
        </div>
      </section>

      {/* ── Comparison row ─────────────────────────────────────────────── */}
      <section style={{
        padding: "clamp(3rem, 5vw, 4.5rem) clamp(1.25rem, 3vw, 2rem)",
        background: BG_SOFT,
        borderTop: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.12em",
              textTransform: "uppercase", color: GOLD, marginBottom: 14,
            }}>
              At a glance
            </div>
            <h2 style={{
              fontSize: "clamp(1.6rem, 3.8vw, 2.25rem)",
              fontWeight: 800,
              color: TEXT,
              letterSpacing: "-0.025em",
              margin: 0,
              lineHeight: 1.15,
            }}>
              Standard vs. Pro
            </h2>
          </div>
          <div style={{
            background: "#fff",
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
          }}>
            {[
              { label: "Brand, logo, store, product page", standard: true, pro: true },
              { label: "5 static ad creatives / week",      standard: true, pro: true },
              { label: "Mobile dashboard + tracking",        standard: true, pro: true },
              { label: "AI UGC video ads / week",            standard: false, pro: true },
              { label: "Premium product photos",             standard: false, pro: true },
              { label: "Priority build",                     standard: false, pro: true },
              { label: "Add-on credits",                     standard: false, pro: true },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : "none",
                background: i % 2 === 0 ? "#fff" : BG_SOFT,
              }}>
                <span style={{ fontSize: "0.92rem", color: TEXT, fontWeight: 500 }}>{row.label}</span>
                <span style={{ textAlign: "center" }}>
                  {row.standard
                    ? <Check size={18} color="#16a34a" />
                    : <span style={{ color: "#cbd5e1", fontSize: "1.1rem", fontWeight: 700 }}>—</span>}
                </span>
                <span style={{ textAlign: "center" }}>
                  {row.pro
                    ? <Check size={18} color="#16a34a" />
                    : <span style={{ color: "#cbd5e1", fontSize: "1.1rem", fontWeight: 700 }}>—</span>}
                </span>
              </div>
            ))}
            {/* Header row at the bottom for column-clarity */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr",
              padding: "12px 20px",
              borderTop: `1px solid ${BORDER}`,
              background: "#fff",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: SUBTEXT,
            }}>
              <span>Feature</span>
              <span style={{ textAlign: "center" }}>Standard</span>
              <span style={{ textAlign: "center", color: NAVY }}>Pro</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(3.5rem, 6vw, 5rem) clamp(1.25rem, 3vw, 2rem)", background: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{
              fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.12em",
              textTransform: "uppercase", color: GOLD, marginBottom: 14,
            }}>
              Billing questions
            </div>
            <h2 style={{
              fontSize: "clamp(1.6rem, 3.8vw, 2.25rem)",
              fontWeight: 800,
              color: TEXT,
              letterSpacing: "-0.025em",
              margin: 0,
              lineHeight: 1.15,
            }}>
              Everything before you commit.
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} style={{
                  background: "#fff",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 14,
                  overflow: "hidden",
                }}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    style={{
                      width: "100%", padding: "18px 22px",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                      cursor: "pointer", background: "transparent", border: "none",
                      color: TEXT, fontSize: "1rem", fontWeight: 700,
                      textAlign: "left", letterSpacing: "-0.01em",
                    }}
                  >
                    {f.q}
                    <span style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: 8,
                      background: BG_SOFT, display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: NAVY, fontSize: "1.1rem", fontWeight: 700,
                      transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s",
                    }}>+</span>
                  </button>
                  {open && (
                    <div style={{ padding: "0 22px 20px", fontSize: "0.93rem", color: SUBTEXT, lineHeight: 1.65 }}>
                      {f.a}
                      {i === 3 && (
                        <Link href="/refund" style={{
                          display: "inline-block", marginTop: 12,
                          color: NAVY, textDecoration: "underline",
                          fontWeight: 600, fontSize: "0.88rem",
                        }}>
                          View Refund Policy →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

/* ─── Plan card ──────────────────────────────────────────────────────────── */
function PlanCard({ tier, plan, loggedIn, onCTA, onSwitchToAnnual }: {
  tier: TierDef;
  plan: Plan;
  loggedIn: boolean;
  onCTA: () => void;
  onSwitchToAnnual: () => void;
}) {
  const isPro = tier.id === "pro";
  const period = plan === "yearly" ? "/yr" : "/mo";
  const block = plan === "yearly" ? tier.yearly : tier.monthly;
  const monthlyComparePrice = plan === "yearly" ? tier.monthly.price : null;

  const ctaLabel = useMemo(() => {
    if (loggedIn) return "Go to Dashboard";
    return isPro ? `Get Pro for $1` : `Start for $1`;
  }, [loggedIn, isPro]);

  // Border + shadow tier styling
  const borderColor = isPro ? NAVY : BORDER;
  const borderWidth = isPro ? 2 : 1;
  const shadow = isPro
    ? "0 24px 60px rgba(10,37,64,0.16), 0 6px 18px rgba(10,37,64,0.08)"
    : "0 8px 24px rgba(15,23,42,0.06)";

  return (
    <div
      className="price-card-hover"
      style={{
        position: "relative",
        background: "#fff",
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: 22,
        padding: "34px 28px 30px",
        boxShadow: shadow,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {isPro && (
        <div style={{
          position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
          background: GOLD, color: "#1a1100",
          padding: "5px 16px", borderRadius: 999,
          fontSize: "0.72rem", fontWeight: 800,
          letterSpacing: "0.08em", textTransform: "uppercase",
          whiteSpace: "nowrap",
          boxShadow: "0 6px 18px rgba(212,168,67,0.35)",
        }}>
          Most Popular
        </div>
      )}

      {/* Eyebrow */}
      <div style={{
        fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: isPro ? NAVY : SUBTEXT,
        marginBottom: 8,
        marginTop: isPro ? 6 : 0,
      }}>
        {tier.name}
      </div>

      {/* Tagline */}
      <p style={{
        margin: "0 0 22px",
        fontSize: "0.95rem",
        color: SUBTEXT,
        lineHeight: 1.5,
      }}>
        {tier.tagline}
      </p>

      {/* Price hero */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        {monthlyComparePrice !== null && (
          <span style={{
            fontSize: "1.4rem", color: "#94a3b8", textDecoration: "line-through",
            textDecorationThickness: 2, fontWeight: 700, letterSpacing: "-0.02em",
          }}>
            ${monthlyComparePrice}
          </span>
        )}
        <span style={{
          fontSize: "clamp(2.5rem, 5vw, 3.25rem)", fontWeight: 800,
          letterSpacing: "-0.03em", color: TEXT, lineHeight: 1,
        }}>
          ${block.price}
        </span>
        <span style={{ fontSize: "1rem", color: SUBTEXT, fontWeight: 600 }}>{period}</span>
      </div>

      {/* $X/day micro-callout */}
      <div style={{ fontSize: "0.85rem", color: SUBTEXT, marginBottom: 16 }}>
        Just <strong style={{ color: TEXT }}>{block.perDay}</strong>
        {plan === "yearly" && (
          <span style={{ color: SUBTEXT }}> · {tier.yearly.equivMonthly} equivalent</span>
        )}
      </div>

      {/* $1 framing */}
      <div style={{
        background: BG_SOFT,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 18,
      }}>
        <div style={{ fontSize: "0.95rem", color: TEXT, fontWeight: 700, marginBottom: 4 }}>
          $1 today
        </div>
        <p style={{ margin: 0, fontSize: "0.82rem", color: SUBTEXT, lineHeight: 1.5 }}>
          {block.afterTrial} Cancel inside the preview, pay nothing more.
        </p>
      </div>

      {/* "Save with annual" link or "Yearly savings" badge */}
      {plan === "monthly" && (
        <button
          onClick={onSwitchToAnnual}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", padding: 0, marginBottom: 18,
            color: NAVY, fontSize: "0.85rem", fontWeight: 700,
            cursor: "pointer", textAlign: "left", letterSpacing: "-0.01em",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {tier.monthly.saveYearly}
        </button>
      )}
      {plan === "yearly" && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 999,
          background: "rgba(22,163,74,0.1)",
          color: "#15803d",
          fontSize: "0.78rem",
          fontWeight: 800, letterSpacing: "0.02em",
          marginBottom: 18, alignSelf: "flex-start",
        }}>
          {tier.yearly.savings}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onCTA}
        className="pill-btn"
        style={{
          width: "100%",
          padding: "1rem 1.25rem",
          borderRadius: 14,
          border: "none",
          background: isPro ? NAVY : "#fff",
          color: isPro ? "#fff" : NAVY,
          boxShadow: isPro
            ? "0 12px 28px rgba(10,37,64,0.22)"
            : `0 0 0 1.5px ${NAVY} inset`,
          fontSize: "1rem",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          cursor: "pointer",
          marginBottom: 22,
          minHeight: 54,
        }}
      >
        {ctaLabel} →
      </button>

      {/* Features */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {tier.features.map((f) => (
          <li key={f} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            fontSize: "0.92rem", color: TEXT, lineHeight: 1.5,
          }}>
            <span style={{
              flexShrink: 0,
              width: 22, height: 22, borderRadius: 6,
              background: "rgba(22,163,74,0.12)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginTop: 1,
            }}>
              <Check size={14} color="#16a34a" />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
