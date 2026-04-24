"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseStatus = "done" | "active" | "pending";

interface Phase {
  id: string;
  title: string;
  blurb: string;
  week: string;
  status: PhaseStatus;
}

type AssetKind = "logo" | "product_page" | "ad" | "ugc" | "email" | "store";

interface Asset {
  id: string;
  kind: AssetKind;
  title: string;
  deliveredAgo: string;
  status: "ready" | "in_review" | "in_progress";
  thumb?: string;
}

interface UpcomingMove {
  id: string;
  title: string;
  eta: string;
  detail: string;
}

// ─── Sample data (to be replaced with real API once backend lands) ───────────

const PHASES: Phase[] = [
  { id: "p1", title: "Foundation",  blurb: "Business name, niche, positioning locked in.",       week: "Week 1",   status: "done"    },
  { id: "p2", title: "Branding",    blurb: "Logo, color palette, brand voice delivered.",        week: "Week 1–2", status: "done"    },
  { id: "p3", title: "Store",       blurb: "Shopify store live with winning product.",           week: "Week 2",   status: "active"  },
  { id: "p4", title: "First Ads",   blurb: "First Meta ad creatives launched with $20/day test.", week: "Week 3",   status: "pending" },
  { id: "p5", title: "Scale",       blurb: "Winning angles found, budget scaled, retargeting on.",week: "Week 4–6", status: "pending" },
  { id: "p6", title: "Growth",      blurb: "UGC library, email flows, cross-sell offers live.",   week: "Week 6–8", status: "pending" },
];

const ASSETS: Asset[] = [
  { id: "a1", kind: "logo",         title: "Primary logo + 3 variants",  deliveredAgo: "4 days ago",  status: "ready"       },
  { id: "a2", kind: "store",        title: "Shopify storefront",          deliveredAgo: "2 days ago",  status: "ready"       },
  { id: "a3", kind: "product_page", title: "Hero product landing page",   deliveredAgo: "1 day ago",   status: "ready"       },
  { id: "a4", kind: "ad",           title: "Ad creative pack · 6 variants",deliveredAgo: "today",      status: "in_review"   },
  { id: "a5", kind: "ugc",          title: "UGC video · unboxing hook",   deliveredAgo: "in progress", status: "in_progress" },
  { id: "a6", kind: "email",        title: "Welcome + abandoned cart flow",deliveredAgo: "in progress", status: "in_progress" },
];

const UPCOMING: UpcomingMove[] = [
  { id: "u1", title: "First ad goes live",        eta: "Thursday",   detail: "Starting at $20/day. We'll tune after 48h of data." },
  { id: "u2", title: "Second UGC video delivered", eta: "Friday",     detail: "Testimonial-style hook for retargeting audience."  },
  { id: "u3", title: "Weekly performance recap",   eta: "Sunday",     detail: "Spend, impressions, first revenue (if any)."       },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LaunchPage() {
  const [businessName, setBusinessName] = useState<string>("");

  useEffect(() => {
    try {
      const n = localStorage.getItem("threely_dfy_business_name");
      if (n) setBusinessName(n);
    } catch { /* ignore */ }
  }, []);

  const currentPhase = PHASES.find(p => p.status === "active") ?? PHASES[0];
  const doneCount    = PHASES.filter(p => p.status === "done").length;
  const progressPct  = Math.round((doneCount / PHASES.length) * 100);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "1.75rem 1.25rem 4rem" }}>

      {/* ── Top header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={GOLD_LABEL}>Your launch</div>
        <h1 style={{
          fontSize: "clamp(1.75rem, 4.5vw, 2.35rem)",
          fontWeight: 800,
          letterSpacing: "-0.025em",
          color: "var(--text)",
          lineHeight: 1.15,
          marginTop: 6,
        }}>
          {businessName ? `${businessName} is being built` : "Your business is being built"}
        </h1>
        <div style={{ fontSize: "0.98rem", color: "var(--subtext)", marginTop: 8 }}>
          You focus on your life. We run the launch.
        </div>
      </div>

      {/* ── Hero status card ────────────────────────────────────────────────── */}
      <div style={HERO_CARD}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Current phase
            </div>
            <div style={{ fontSize: "1.55rem", fontWeight: 800, color: "#fff", marginTop: 4, letterSpacing: "-0.02em" }}>
              {currentPhase.title}
            </div>
            <div style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
              {currentPhase.week} · {progressPct}% of launch complete
            </div>
          </div>

          <div style={{ display: "flex", gap: 18, flexShrink: 0 }}>
            <HeroStat label="Assets delivered" value={String(ASSETS.filter(a => a.status === "ready").length)} />
            <HeroStat label="In progress"      value={String(ASSETS.filter(a => a.status !== "ready").length)} />
            <HeroStat label="Phases done"      value={`${doneCount} / ${PHASES.length}`} />
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 22, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            width: `${progressPct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #D4A843, #E8C547)",
            borderRadius: 999,
            transition: "width 400ms ease",
          }} />
        </div>

        <div style={{ marginTop: 16, fontSize: "0.88rem", color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#3ecf8e" }} />
          <span><b style={{ color: "#fff" }}>Latest move:</b> Shopify storefront went live — product page publishing tonight.</span>
        </div>
      </div>

      {/* ── Launch timeline ─────────────────────────────────────────────────── */}
      <SectionHeader title="Launch timeline" subtitle="What we're building for you, in order." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PHASES.map((p, i) => <PhaseRow key={p.id} phase={p} index={i} />)}
      </div>

      {/* ── Asset library ───────────────────────────────────────────────────── */}
      <SectionHeader title="Asset library" subtitle="Everything we've made for your business." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {ASSETS.map(a => <AssetCard key={a.id} asset={a} />)}
      </div>

      {/* ── This week's deliverables ────────────────────────────────────────── */}
      <SectionHeader title="This week" subtitle="Moves landing in the next few days." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {UPCOMING.map(m => <UpcomingRow key={m.id} move={m} />)}
      </div>

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 40,
        padding: "20px 22px",
        borderRadius: 14,
        background: "rgba(212,168,67,0.06)",
        border: "1px solid rgba(212,168,67,0.18)",
        fontSize: "0.9rem",
        color: "var(--subtext)",
        lineHeight: 1.5,
      }}>
        <b style={{ color: "#D4A843" }}>How this works:</b> you don&apos;t need to do anything. We ship every phase automatically.
        If you want to change something — a color, a name, an angle — tap any asset and you can swap it.
        Nothing blocks on your decisions.
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginTop: 36, marginBottom: 14 }}>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.015em" }}>
        {title}
      </div>
      <div style={{ fontSize: "0.88rem", color: "var(--subtext)", marginTop: 2 }}>
        {subtitle}
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function PhaseRow({ phase, index }: { phase: Phase; index: number }) {
  const color =
    phase.status === "done"   ? "#3ecf8e" :
    phase.status === "active" ? "#D4A843" :
                                "rgba(255,255,255,0.25)";

  const label =
    phase.status === "done"   ? "Done" :
    phase.status === "active" ? "In progress" :
                                "Pending";

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
      padding: "16px 18px",
      borderRadius: 12,
      background: "var(--card)",
      border: `1px solid ${phase.status === "active" ? "rgba(212,168,67,0.35)" : "var(--border)"}`,
      boxShadow: phase.status === "active" ? "0 0 0 3px rgba(212,168,67,0.08)" : "none",
    }}>
      {/* Step number / check */}
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: phase.status === "done" ? "rgba(62,207,142,0.15)" : phase.status === "active" ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.04)",
        color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.9rem", fontWeight: 800,
        flexShrink: 0,
        border: `1.5px solid ${color}`,
      }}>
        {phase.status === "done" ? "\u2713" : index + 1}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
            {phase.title}
          </div>
          <div style={{ fontSize: "0.74rem", color, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {label} · {phase.week}
          </div>
        </div>
        <div style={{ fontSize: "0.88rem", color: "var(--subtext)", marginTop: 4, lineHeight: 1.5 }}>
          {phase.blurb}
        </div>
      </div>
    </div>
  );
}

function AssetCard({ asset }: { asset: Asset }) {
  const badgeColor =
    asset.status === "ready"       ? "#3ecf8e" :
    asset.status === "in_review"   ? "#D4A843" :
                                     "var(--muted)";

  const badgeLabel =
    asset.status === "ready"       ? "Ready" :
    asset.status === "in_review"   ? "In review" :
                                     "In progress";

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      cursor: asset.status === "ready" ? "pointer" : "default",
      transition: "transform 150ms ease, border-color 150ms ease",
    }}
      onMouseEnter={(e) => {
        if (asset.status === "ready") {
          e.currentTarget.style.borderColor = "rgba(212,168,67,0.5)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Thumb / placeholder */}
      <div style={{
        aspectRatio: "16 / 10",
        background: `linear-gradient(135deg, ${assetBg(asset.kind)}, rgba(255,255,255,0.02))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 32, opacity: 0.85 }}>{assetEmoji(asset.kind)}</div>
      </div>

      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
          {assetLabel(asset.kind)}
        </div>
        <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
          {asset.title}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <div style={{ fontSize: "0.76rem", color: "var(--subtext)" }}>
            {asset.deliveredAgo}
          </div>
          <div style={{
            fontSize: "0.68rem", fontWeight: 700,
            color: badgeColor,
            padding: "3px 8px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${badgeColor === "var(--muted)" ? "var(--border)" : badgeColor}`,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}>
            {badgeLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

function UpcomingRow({ move }: { move: UpcomingMove }) {
  return (
    <div style={{
      display: "flex",
      gap: 14,
      padding: "14px 18px",
      borderRadius: 12,
      background: "var(--card)",
      border: "1px solid var(--border)",
    }}>
      <div style={{
        flexShrink: 0,
        width: 56,
        fontSize: "0.74rem",
        color: "#D4A843",
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        paddingTop: 2,
      }}>
        {move.eta}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.96rem", fontWeight: 700, color: "var(--text)" }}>
          {move.title}
        </div>
        <div style={{ fontSize: "0.84rem", color: "var(--subtext)", marginTop: 2, lineHeight: 1.5 }}>
          {move.detail}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assetEmoji(k: AssetKind): string {
  return ({
    logo: "◆", store: "🛍", product_page: "📄", ad: "🎬", ugc: "📱", email: "✉",
  } as Record<AssetKind, string>)[k];
}

function assetLabel(k: AssetKind): string {
  return ({
    logo: "Logo", store: "Storefront", product_page: "Product page", ad: "Ad creative", ugc: "UGC video", email: "Email flow",
  } as Record<AssetKind, string>)[k];
}

function assetBg(k: AssetKind): string {
  return ({
    logo: "rgba(212,168,67,0.12)", store: "rgba(99,91,255,0.14)", product_page: "rgba(62,207,142,0.12)",
    ad: "rgba(245,158,11,0.14)", ugc: "rgba(236,72,153,0.14)", email: "rgba(99,91,255,0.12)",
  } as Record<AssetKind, string>)[k];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD_LABEL: React.CSSProperties = {
  fontSize: "0.74rem",
  fontWeight: 800,
  color: "#D4A843",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const HERO_CARD: React.CSSProperties = {
  padding: "24px 26px",
  borderRadius: 18,
  background: "linear-gradient(135deg, #1a1a1a 0%, #222 100%)",
  border: "1px solid rgba(212,168,67,0.2)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(212,168,67,0.05)",
};
