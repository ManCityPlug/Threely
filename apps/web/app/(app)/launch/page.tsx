"use client";

import { useCallback, useEffect, useState } from "react";
import {
  launchApi,
  type LaunchAsset,
  type LaunchAssetKind,
  type LaunchEvent,
  type LaunchSummary,
} from "@/lib/api-client";

// ─── Phase template ──────────────────────────────────────────────────────────
// Phases are fixed in code (not DB) — simpler to evolve. Launch.currentPhase
// (1..6) determines which row is "active"; earlier rows are "done", later ones "pending".

type PhaseStatus = "done" | "active" | "pending";

interface Phase {
  order: number;
  title: string;
  blurb: string;
  week: string;
}

const PHASES: Phase[] = [
  { order: 1, title: "Foundation",  blurb: "Business name, niche, positioning locked in.",          week: "Week 1"    },
  { order: 2, title: "Branding",    blurb: "Logo, color palette, brand voice delivered.",           week: "Week 1–2"  },
  { order: 3, title: "Store",       blurb: "Shopify store live with winning product.",              week: "Week 2"    },
  { order: 4, title: "First Ads",   blurb: "First Meta ad creatives launched with $20/day test.",   week: "Week 3"    },
  { order: 5, title: "Scale",       blurb: "Winning angles found, budget scaled, retargeting on.",  week: "Week 4–6"  },
  { order: 6, title: "Growth",      blurb: "UGC library, email flows, cross-sell offers live.",     week: "Week 6–8"  },
];

function phaseStatus(phase: Phase, currentPhase: number): PhaseStatus {
  if (phase.order <  currentPhase) return "done";
  if (phase.order === currentPhase) return "active";
  return "pending";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LaunchPage() {
  const [loading, setLoading]   = useState(true);
  const [launch,  setLaunch]    = useState<LaunchSummary | null>(null);
  const [assets,  setAssets]    = useState<LaunchAsset[]>([]);
  const [events,  setEvents]    = useState<LaunchEvent[]>([]);
  const [error,   setError]     = useState<string>("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await launchApi.get();
      setLaunch(res.launch);
      setAssets(res.assets ?? []);
      setEvents(res.events ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load launch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LaunchSkeleton />;
  if (error)   return <ErrorState message={error} onRetry={load} />;
  if (!launch) return <EmptyState onCreated={load} />;

  return <LaunchDashboard launch={launch} assets={assets} events={events} />;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function LaunchDashboard({
  launch, assets, events,
}: { launch: LaunchSummary; assets: LaunchAsset[]; events: LaunchEvent[] }) {
  const currentPhase = PHASES.find(p => p.order === launch.currentPhase) ?? PHASES[0];
  const doneCount    = Math.max(0, launch.currentPhase - 1);
  const progressPct  = Math.round((doneCount / PHASES.length) * 100);

  const readyCount      = assets.filter(a => a.status === "ready").length;
  const inProgressCount = assets.length - readyCount;

  const latestMove = events[0] ?? null;
  const upcoming   = events.filter(e => e.kind === "upcoming");

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "1.75rem 1.25rem 4rem" }}>

      {/* Header */}
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
          {launch.businessName} is being built
        </h1>
        <div style={{ fontSize: "0.98rem", color: "var(--subtext)", marginTop: 8 }}>
          You focus on your life. We run the launch.
        </div>
      </div>

      {/* Hero status card */}
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
            <HeroStat label="Assets delivered" value={String(readyCount)} />
            <HeroStat label="In progress"      value={String(inProgressCount)} />
            <HeroStat label="Phases done"      value={`${doneCount} / ${PHASES.length}`} />
          </div>
        </div>

        <div style={{ marginTop: 22, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            width: `${progressPct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #D4A843, #E8C547)",
            borderRadius: 999,
            transition: "width 400ms ease",
          }} />
        </div>

        {latestMove && (
          <div style={{ marginTop: 16, fontSize: "0.88rem", color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#3ecf8e", marginTop: 6, flexShrink: 0 }} />
            <span>
              <b style={{ color: "#fff" }}>Latest move:</b> {latestMove.title}
              {latestMove.detail && <span style={{ opacity: 0.85 }}> — {latestMove.detail}</span>}
            </span>
          </div>
        )}
      </div>

      {/* Launch timeline */}
      <SectionHeader title="Launch timeline" subtitle="What we're building for you, in order." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PHASES.map(p => <PhaseRow key={p.order} phase={p} status={phaseStatus(p, launch.currentPhase)} />)}
      </div>

      {/* Asset library */}
      <SectionHeader title="Asset library" subtitle="Everything we've made for your business." />
      {assets.length === 0 ? (
        <div style={EMPTY_TILE}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
          <div style={{ color: "var(--subtext)", fontSize: "0.92rem" }}>
            Your first assets land within 48 hours.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {assets.map(a => <AssetCard key={a.id} asset={a} />)}
        </div>
      )}

      {/* This week */}
      {upcoming.length > 0 && (
        <>
          <SectionHeader title="This week" subtitle="Moves landing in the next few days." />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcoming.map(e => <UpcomingRow key={e.id} event={e} />)}
          </div>
        </>
      )}

      {/* Footer note */}
      <div style={FOOTER_NOTE}>
        <b style={{ color: "#D4A843" }}>How this works:</b> you don&apos;t need to do anything. We ship every phase automatically.
        If you want to change something — a color, a name, an angle — tap any asset and you can swap it.
        Nothing blocks on your decisions.
      </div>
    </div>
  );
}

// ─── Empty / error / loading ──────────────────────────────────────────────────

function EmptyState({ onCreated }: { onCreated: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [niche, setNiche]               = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [err, setErr]                   = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !niche.trim()) return;
    setSubmitting(true);
    setErr("");
    try {
      await launchApi.create(businessName.trim(), niche.trim());
      onCreated();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to start launch");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <div style={GOLD_LABEL}>Your launch</div>
      <h1 style={{
        fontSize: "2rem",
        fontWeight: 800,
        letterSpacing: "-0.025em",
        color: "var(--text)",
        lineHeight: 1.15,
        marginTop: 6,
        marginBottom: 12,
      }}>
        Let&apos;s start your business.
      </h1>
      <p style={{ fontSize: "1rem", color: "var(--subtext)", marginBottom: 28, lineHeight: 1.55 }}>
        Tell us two things and we&apos;ll handle the rest. First assets within 48 hours.
      </p>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field
          label="Business name"
          value={businessName}
          onChange={setBusinessName}
          placeholder="e.g. The Coffee Edit"
          maxLength={50}
        />
        <Field
          label="Niche or product category"
          value={niche}
          onChange={setNiche}
          placeholder="e.g. coffee, yoga, pet accessories"
          maxLength={60}
        />

        {err && (
          <div style={{ color: "#ff6b6b", fontSize: "0.88rem" }}>{err}</div>
        )}

        <button
          type="submit"
          disabled={submitting || !businessName.trim() || !niche.trim()}
          style={{
            marginTop: 8,
            padding: "14px 20px",
            borderRadius: 12,
            background: submitting ? "rgba(212,168,67,0.5)" : "#D4A843",
            color: "#000",
            fontSize: "1rem",
            fontWeight: 800,
            border: "none",
            cursor: submitting ? "default" : "pointer",
            letterSpacing: "-0.01em",
          }}
        >
          {submitting ? "Starting your launch…" : "Start my launch"}
        </button>

        <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center", marginTop: 6 }}>
          We&apos;ll start building immediately. You can change the name or niche anytime.
        </p>
      </form>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "3rem 1.25rem", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>⚠</div>
      <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
        Couldn&apos;t load your launch
      </div>
      <div style={{ fontSize: "0.9rem", color: "var(--subtext)", marginBottom: 18 }}>{message}</div>
      <button onClick={onRetry} style={{
        padding: "10px 18px", borderRadius: 10,
        background: "#D4A843", color: "#000", border: "none",
        fontWeight: 700, cursor: "pointer",
      }}>
        Retry
      </button>
    </div>
  );
}

function LaunchSkeleton() {
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "1.75rem 1.25rem" }}>
      <div style={{ height: 18, width: 120, background: "var(--border)", borderRadius: 4, marginBottom: 12 }} />
      <div style={{ height: 40, width: "70%", background: "var(--border)", borderRadius: 8, marginBottom: 28 }} />
      <div style={{ height: 180, background: "var(--card)", borderRadius: 18, border: "1px solid var(--border)", marginBottom: 28 }} />
      <div style={{ height: 22, width: 180, background: "var(--border)", borderRadius: 4, marginBottom: 14 }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ height: 72, background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 10 }} />
      ))}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginTop: 36, marginBottom: 14 }}>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.015em" }}>{title}</div>
      <div style={{ fontSize: "0.88rem", color: "var(--subtext)", marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function PhaseRow({ phase, status }: { phase: Phase; status: PhaseStatus }) {
  const color =
    status === "done"   ? "#3ecf8e" :
    status === "active" ? "#D4A843" :
                          "rgba(255,255,255,0.25)";

  const label =
    status === "done"   ? "Done" :
    status === "active" ? "In progress" :
                          "Pending";

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
      padding: "16px 18px",
      borderRadius: 12,
      background: "var(--card)",
      border: `1px solid ${status === "active" ? "rgba(212,168,67,0.35)" : "var(--border)"}`,
      boxShadow: status === "active" ? "0 0 0 3px rgba(212,168,67,0.08)" : "none",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: status === "done" ? "rgba(62,207,142,0.15)" : status === "active" ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.04)",
        color, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.9rem", fontWeight: 800, flexShrink: 0,
        border: `1.5px solid ${color}`,
      }}>
        {status === "done" ? "\u2713" : phase.order}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>{phase.title}</div>
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

function AssetCard({ asset }: { asset: LaunchAsset }) {
  const badgeColor =
    asset.status === "ready"     ? "#3ecf8e" :
    asset.status === "in_review" ? "#D4A843" :
                                   "var(--muted)";
  const badgeLabel =
    asset.status === "ready"     ? "Ready" :
    asset.status === "in_review" ? "In review" :
                                   "In progress";

  // Try to pull a thumb URL from payload when available.
  const thumb = assetThumbUrl(asset);

  return (
    <div
      style={{
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
      <div style={{
        aspectRatio: "16 / 10",
        background: thumb ? undefined : `linear-gradient(135deg, ${assetBg(asset.kind)}, rgba(255,255,255,0.02))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "1px solid var(--border)",
        overflow: "hidden",
      }}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={asset.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ fontSize: 32, opacity: 0.85 }}>{assetEmoji(asset.kind)}</div>
        )}
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
            {asset.deliveredAt ? formatAgo(asset.deliveredAt) : formatAgo(asset.createdAt)}
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

function UpcomingRow({ event }: { event: LaunchEvent }) {
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
        width: 64,
        fontSize: "0.74rem",
        color: "#D4A843",
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        paddingTop: 2,
      }}>
        {event.eta || "Soon"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.96rem", fontWeight: 700, color: "var(--text)" }}>{event.title}</div>
        {event.detail && (
          <div style={{ fontSize: "0.84rem", color: "var(--subtext)", marginTop: 2, lineHeight: 1.5 }}>
            {event.detail}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; maxLength?: number;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--subtext)", marginBottom: 6 }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{
          width: "100%",
          padding: "13px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          fontSize: "0.98rem",
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </label>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assetEmoji(k: LaunchAssetKind): string {
  return ({ logo: "◆", store: "🛍", product_page: "📄", ad: "🎬", ugc: "📱", email: "✉" } as Record<LaunchAssetKind, string>)[k];
}
function assetLabel(k: LaunchAssetKind): string {
  return ({ logo: "Logo", store: "Storefront", product_page: "Product page", ad: "Ad creative", ugc: "UGC video", email: "Email flow" } as Record<LaunchAssetKind, string>)[k];
}
function assetBg(k: LaunchAssetKind): string {
  return ({
    logo: "rgba(212,168,67,0.12)", store: "rgba(99,91,255,0.14)", product_page: "rgba(62,207,142,0.12)",
    ad: "rgba(245,158,11,0.14)", ugc: "rgba(236,72,153,0.14)", email: "rgba(99,91,255,0.12)",
  } as Record<LaunchAssetKind, string>)[k];
}

function assetThumbUrl(asset: LaunchAsset): string | null {
  const p = asset.payload;
  if (!p || typeof p !== "object") return null;
  const obj = p as Record<string, unknown>;
  const candidates = ["thumbUrl", "pngUrl", "imageUrl", "previewUrl"] as const;
  for (const k of candidates) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function formatAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD_LABEL: React.CSSProperties = {
  fontSize: "0.74rem", fontWeight: 800, color: "#D4A843",
  letterSpacing: "0.1em", textTransform: "uppercase",
};

const HERO_CARD: React.CSSProperties = {
  padding: "24px 26px",
  borderRadius: 18,
  background: "linear-gradient(135deg, #1a1a1a 0%, #222 100%)",
  border: "1px solid rgba(212,168,67,0.2)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(212,168,67,0.05)",
};

const EMPTY_TILE: React.CSSProperties = {
  padding: "32px 20px",
  borderRadius: 14,
  background: "var(--card)",
  border: "1px dashed var(--border)",
  textAlign: "center",
};

const FOOTER_NOTE: React.CSSProperties = {
  marginTop: 40,
  padding: "20px 22px",
  borderRadius: 14,
  background: "rgba(212,168,67,0.06)",
  border: "1px solid rgba(212,168,67,0.18)",
  fontSize: "0.9rem",
  color: "var(--subtext)",
  lineHeight: 1.5,
};
