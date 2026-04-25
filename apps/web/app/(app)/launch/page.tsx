"use client";

import { useCallback, useEffect, useState } from "react";
import {
  launchApi,
  statsApi,
  type LaunchAsset,
  type LaunchAssetKind,
  type LaunchSummary,
  type Stats,
} from "@/lib/api-client";
import DfyModal from "@/components/DfyModal";
import OfferBanner from "@/components/OfferBanner";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LaunchPage() {
  const [loading, setLoading] = useState(true);
  const [launch, setLaunch] = useState<LaunchSummary | null>(null);
  const [assets, setAssets] = useState<LaunchAsset[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [launchRes, statsRes] = await Promise.all([
        launchApi.get(),
        statsApi.get().catch(() => null),
      ]);
      setLaunch(launchRes.launch);
      setAssets(launchRes.assets ?? []);
      if (statsRes) setStats(statsRes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load launch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LaunchSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!launch) return <EmptyState onCreated={load} />;

  return <LaunchHub launch={launch} assets={assets} stats={stats} onAssetDelivered={load} />;
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

type DfyKind = "names" | "products" | "logo";

const ACTION_TILES: Array<{
  key: string;
  title: string;
  blurb: string;
  cta: string;
  dfy?: DfyKind;
  comingSoon?: boolean;
  icon: React.ReactNode;
  bg: string;
  fg: string;
}> = [
  {
    key: "logo",
    title: "Logo",
    blurb: "Pick a logo for your brand in 30 seconds.",
    cta: "Get my logo",
    dfy: "logo",
    icon: <IconLogo />,
    bg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    fg: "#92400e",
  },
  {
    key: "name",
    title: "Business name",
    blurb: "Five clean, brandable names tailored to your niche.",
    cta: "Get name ideas",
    dfy: "names",
    icon: <IconName />,
    bg: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
    fg: "#1e40af",
  },
  {
    key: "product",
    title: "Winning product",
    blurb: "Top-performing products with supplier costs and margins.",
    cta: "Pick my product",
    dfy: "products",
    icon: <IconProduct />,
    bg: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
    fg: "#166534",
  },
  {
    key: "storefront",
    title: "Storefront",
    blurb: "A full Shopify storefront, designed and ready to publish.",
    cta: "Build my store",
    comingSoon: true,
    icon: <IconStore />,
    bg: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
    fg: "#5b21b6",
  },
  {
    key: "ads",
    title: "Ad creatives",
    blurb: "Scroll-stopping Meta ad videos tested at $20/day.",
    cta: "Make my ads",
    comingSoon: true,
    icon: <IconAd />,
    bg: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
    fg: "#991b1b",
  },
  {
    key: "ugc",
    title: "UGC videos",
    blurb: "AI actors filming your product in any setting.",
    cta: "Make UGC",
    comingSoon: true,
    icon: <IconUgc />,
    bg: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)",
    fg: "#9d174d",
  },
];

function LaunchHub({
  launch,
  assets,
  stats,
  onAssetDelivered,
}: {
  launch: LaunchSummary;
  assets: LaunchAsset[];
  stats: Stats | null;
  onAssetDelivered: () => void;
}) {
  const [openDfy, setOpenDfy] = useState<DfyKind | null>(null);
  const [hasOffer, setHasOffer] = useState(false);
  const streak = stats?.streak ?? 0;

  const readyAssets = assets.filter(a => a.status === "ready");

  return (
    <div className="launch-page">
      {/* Header */}
      <header className="launch-header">
        <div className="launch-header-row">
          <div>
            <div className="launch-eyebrow">Your launch</div>
            <h1 className="launch-title">{launch.businessName}</h1>
            <div className="launch-sub">
              {capitalize(launch.niche)} · We&apos;re building this for you
            </div>
          </div>
          {streak > 0 && (
            <div className="launch-streak" aria-label={`${streak} day streak`}>
              <span className="launch-streak-flame">🔥</span>
              <span className="launch-streak-num">{streak}</span>
              <span className="launch-streak-label">day{streak === 1 ? "" : "s"} in</span>
            </div>
          )}
        </div>
      </header>

      {/* Special offer */}
      <div style={{ marginBottom: hasOffer ? 24 : 0 }}>
        <OfferBanner onActiveChange={setHasOffer} />
      </div>

      {/* Action grid — click-to-get */}
      <section className="launch-section">
        <div className="launch-section-head">
          <h2 className="launch-section-title">What do you want first?</h2>
          <p className="launch-section-sub">
            Tap any tile. We do the work. You keep what you love.
          </p>
        </div>

        <div className="launch-action-grid">
          {ACTION_TILES.map(tile => (
            <button
              key={tile.key}
              type="button"
              className={`launch-tile${tile.comingSoon ? " is-coming-soon" : ""}`}
              disabled={tile.comingSoon}
              onClick={() => tile.dfy && setOpenDfy(tile.dfy)}
            >
              <div className="launch-tile-art" style={{ background: tile.bg, color: tile.fg }}>
                <div className="launch-tile-icon">{tile.icon}</div>
              </div>
              <div className="launch-tile-body">
                <div className="launch-tile-title-row">
                  <h3 className="launch-tile-title">{tile.title}</h3>
                  {tile.comingSoon && <span className="launch-tile-pill">Soon</span>}
                </div>
                <p className="launch-tile-blurb">{tile.blurb}</p>
                <span className={`launch-tile-cta${tile.comingSoon ? " is-disabled" : ""}`}>
                  {tile.cta}
                  {!tile.comingSoon && <span className="launch-tile-cta-arrow">→</span>}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Asset library */}
      <section className="launch-section">
        <div className="launch-section-head">
          <h2 className="launch-section-title">Your assets</h2>
          <p className="launch-section-sub">
            Everything we&apos;ve made for {launch.businessName}.
          </p>
        </div>

        {readyAssets.length === 0 ? (
          <div className="launch-empty">
            <div className="launch-empty-mark">✦</div>
            <div className="launch-empty-title">Nothing yet</div>
            <div className="launch-empty-sub">
              Tap a tile above and your first asset will land here.
            </div>
          </div>
        ) : (
          <div className="launch-asset-grid">
            {readyAssets.map(a => <AssetCard key={a.id} asset={a} />)}
          </div>
        )}
      </section>

      {openDfy && (
        <DfyModal
          type={openDfy}
          taskText={
            openDfy === "logo"     ? `Design a logo for ${launch.businessName}` :
            openDfy === "names"    ? `Pick a name for my ${launch.niche} business` :
                                     `Pick a winning product in ${launch.niche}`
          }
          onClose={() => setOpenDfy(null)}
          onDelivered={() => { onAssetDelivered(); }}
        />
      )}
    </div>
  );
}

// ─── Empty / error / loading ──────────────────────────────────────────────────

function EmptyState({ onCreated }: { onCreated: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [niche, setNiche] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

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
    <div className="launch-page" style={{ maxWidth: 540 }}>
      <div className="launch-eyebrow">Your launch</div>
      <h1 className="launch-title" style={{ marginBottom: 12 }}>
        Let&apos;s start your business.
      </h1>
      <p className="launch-sub" style={{ marginBottom: 28, fontSize: "1rem" }}>
        Tell us two things and we handle the rest. First assets within 48 hours.
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

        {err && <div style={{ color: "var(--danger)", fontSize: "0.88rem" }}>{err}</div>}

        <button
          type="submit"
          disabled={submitting || !businessName.trim() || !niche.trim()}
          className="launch-primary-btn"
        >
          {submitting ? "Starting your launch…" : "Start my launch"}
        </button>
      </form>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="launch-page" style={{ textAlign: "center", maxWidth: 480 }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>⚠</div>
      <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
        Couldn&apos;t load your launch
      </div>
      <div style={{ fontSize: "0.9rem", color: "var(--subtext)", marginBottom: 18 }}>{message}</div>
      <button onClick={onRetry} className="launch-primary-btn" style={{ width: "auto", padding: "10px 22px" }}>
        Retry
      </button>
    </div>
  );
}

function LaunchSkeleton() {
  return (
    <div className="launch-page">
      <div style={{ height: 14, width: 100, background: "var(--border)", borderRadius: 4, marginBottom: 10 }} />
      <div style={{ height: 36, width: "60%", background: "var(--border)", borderRadius: 8, marginBottom: 8 }} />
      <div style={{ height: 14, width: "40%", background: "var(--border)", borderRadius: 4, marginBottom: 28 }} />
      <div className="launch-action-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ height: 220, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16 }} />
        ))}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: LaunchAsset }) {
  const thumb = assetThumbUrl(asset);

  return (
    <div className="launch-asset-card">
      <div className="launch-asset-thumb">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={asset.title} />
        ) : (
          <div className="launch-asset-thumb-placeholder">{assetEmoji(asset.kind)}</div>
        )}
      </div>
      <div className="launch-asset-meta">
        <div className="launch-asset-kind">{assetLabel(asset.kind)}</div>
        <div className="launch-asset-title">{asset.title}</div>
        <div className="launch-asset-time">
          {asset.deliveredAt ? formatAgo(asset.deliveredAt) : formatAgo(asset.createdAt)}
        </div>
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
        className="launch-input"
      />
    </label>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5 12 2" />
    </svg>
  );
}
function IconName() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}
function IconProduct() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
function IconStore() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="12" rx="1" />
      <path d="M3 9V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}
function IconAd() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function IconUgc() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="12" cy="11" r="3" />
      <path d="M9 17h6" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function assetEmoji(k: LaunchAssetKind): string {
  return ({ logo: "◆", store: "🛍", product_page: "📄", ad: "🎬", ugc: "📱", email: "✉" } as Record<LaunchAssetKind, string>)[k];
}
function assetLabel(k: LaunchAssetKind): string {
  return ({ logo: "Logo", store: "Storefront", product_page: "Product page", ad: "Ad creative", ugc: "UGC video", email: "Email flow" } as Record<LaunchAssetKind, string>)[k];
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
