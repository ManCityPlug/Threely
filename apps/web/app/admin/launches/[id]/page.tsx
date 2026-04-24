"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

// ─── Types (mirror API shapes) ────────────────────────────────────────────────

type AssetKind    = "logo" | "store" | "product_page" | "ad" | "ugc" | "email";
type AssetStatus  = "in_progress" | "in_review" | "ready";
type LaunchStatus = "active" | "paused" | "completed";
type EventKind    = "phase_change" | "asset_ready" | "note" | "upcoming";

interface Asset {
  id: string;
  kind: AssetKind;
  title: string;
  status: AssetStatus;
  payload: Record<string, unknown> | null;
  aiGenerated: boolean;
  createdAt: string;
  deliveredAt: string | null;
}

interface Event {
  id: string;
  kind: EventKind;
  title: string;
  detail: string | null;
  eta: string | null;
  createdAt: string;
}

interface LaunchDetail {
  id: string;
  userId: string;
  businessName: string;
  niche: string;
  currentPhase: number;
  status: LaunchStatus;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; createdAt: string; subscriptionStatus: string | null };
  assets: Asset[];
  events: Event[];
}

const PHASE_NAMES = ["Foundation", "Branding", "Store", "First Ads", "Scale", "Growth"];
const ASSET_KINDS: AssetKind[] = ["logo", "store", "product_page", "ad", "ugc", "email"];
const ASSET_STATUSES: AssetStatus[] = ["in_progress", "in_review", "ready"];

export default function AdminLaunchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [launch, setLaunch]   = useState<LaunchDetail | null>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch(`/api/admin/launches/${id}`);
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setLaunch(j.launch);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function patchLaunch(patch: Partial<Pick<LaunchDetail, "currentPhase" | "status" | "businessName" | "niche">>) {
    const r = await fetch(`/api/admin/launches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) { alert(await r.text()); return; }
    load();
  }

  async function patchAsset(assetId: string, patch: Partial<Pick<Asset, "status" | "title">>) {
    const r = await fetch(`/api/admin/launches/${id}/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) { alert(await r.text()); return; }
    load();
  }

  async function deleteAsset(assetId: string) {
    if (!confirm("Delete this asset?")) return;
    const r = await fetch(`/api/admin/launches/${id}/assets/${assetId}`, { method: "DELETE" });
    if (!r.ok) { alert(await r.text()); return; }
    load();
  }

  async function deleteLaunch() {
    if (!confirm("Delete this entire launch? This cannot be undone.")) return;
    const r = await fetch(`/api/admin/launches/${id}`, { method: "DELETE" });
    if (!r.ok) { alert(await r.text()); return; }
    router.push("/admin/launches");
  }

  if (loading && !launch) return <div style={{ color: "#71717a", padding: "2rem 0" }}>Loading…</div>;
  if (error)              return <div style={{ color: "#fca5a5" }}>{error}</div>;
  if (!launch)            return <div style={{ color: "#71717a" }}>Not found</div>;

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Back */}
      <Link href="/admin/launches" style={{
        display: "inline-block",
        color: "#71717a",
        fontSize: "0.82rem",
        textDecoration: "none",
        marginBottom: 16,
      }}>← Back to launches</Link>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 }}>
            {launch.businessName}
          </h1>
          <div style={{ fontSize: "0.88rem", color: "#a1a1aa" }}>
            {launch.user.email} · <span style={{ color: "#71717a" }}>{launch.niche}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={`/admin/users?q=${encodeURIComponent(launch.user.email)}`}
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: "#1e1e1e", border: "1px solid #1e1e1e",
              color: "#e4e4e7", fontSize: "0.82rem", fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View user
          </a>
          <button
            onClick={deleteLaunch}
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: "transparent", border: "1px solid #3a1a1a",
              color: "#fca5a5", fontSize: "0.82rem", fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Delete launch
          </button>
        </div>
      </div>

      {/* Controls: Phase + Status */}
      <div style={{
        background: "#111",
        border: "1px solid #1e1e1e",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 24,
      }}>
        <div style={{ fontSize: "0.72rem", color: "#71717a", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Launch controls
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.82rem", color: "#a1a1aa", marginBottom: 8 }}>Current phase</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PHASE_NAMES.map((name, i) => {
              const order = i + 1;
              const active = launch.currentPhase === order;
              return (
                <button
                  key={order}
                  onClick={() => { if (!active) patchLaunch({ currentPhase: order }); }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: active ? "#D4A843" : "#1e1e1e",
                    color: active ? "#000" : "#e4e4e7",
                    border: active ? "1px solid #D4A843" : "1px solid #1e1e1e",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {order}. {name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.82rem", color: "#a1a1aa", marginBottom: 8 }}>Status</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["active", "paused", "completed"] as LaunchStatus[]).map((s) => {
              const active = launch.status === s;
              return (
                <button
                  key={s}
                  onClick={() => { if (!active) patchLaunch({ status: s }); }}
                  style={{
                    padding: "8px 14px", borderRadius: 8,
                    background: active ? "#1e1e1e" : "transparent",
                    color: active ? "#fff" : "#a1a1aa",
                    border: `1px solid ${active ? "#D4A843" : "#1e1e1e"}`,
                    fontSize: "0.82rem", fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two columns: assets + timeline */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)", gap: 20 }}>
        {/* Assets column */}
        <div>
          <SectionTitle>Assets ({launch.assets.length})</SectionTitle>

          <AddAssetForm launchId={launch.id} onCreated={load} />

          {launch.assets.length === 0 ? (
            <div style={{
              padding: "2rem 1rem", textAlign: "center",
              background: "#111", borderRadius: 12, border: "1px dashed #1e1e1e",
              color: "#71717a", fontSize: "0.9rem",
            }}>
              No assets yet. The AI will drop them in — or add one manually above.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {launch.assets.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  onChangeStatus={(status) => patchAsset(a.id, { status })}
                  onDelete={() => deleteAsset(a.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Timeline column */}
        <div>
          <SectionTitle>Event timeline</SectionTitle>

          <AddEventForm launchId={launch.id} onCreated={load} />

          {launch.events.length === 0 ? (
            <div style={{ padding: "1rem", color: "#71717a", fontSize: "0.88rem" }}>
              No events yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {launch.events.map((e) => <EventRow key={e.id} event={e} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "0.78rem", color: "#71717a",
      fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function AddAssetForm({ launchId, onCreated }: { launchId: string; onCreated: () => void }) {
  const [kind, setKind]             = useState<AssetKind>("logo");
  const [title, setTitle]           = useState("");
  const [status, setStatus]         = useState<AssetStatus>("in_progress");
  const [payloadStr, setPayloadStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]               = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true); setErr("");
    let payload: unknown = null;
    if (payloadStr.trim()) {
      try { payload = JSON.parse(payloadStr); }
      catch { setErr("Payload must be valid JSON"); setSubmitting(false); return; }
    }
    try {
      const r = await fetch(`/api/admin/launches/${launchId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title: title.trim(), status, payload, aiGenerated: false }),
      });
      if (!r.ok) throw new Error(await r.text());
      setTitle(""); setPayloadStr(""); setStatus("in_progress");
      onCreated();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={{
      background: "#111",
      border: "1px solid #1e1e1e",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "160px minmax(0, 1fr) 140px", gap: 8, marginBottom: 8 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)} style={selectStyle}>
          {ASSET_KINDS.map(k => <option key={k} value={k}>{assetLabel(k)}</option>)}
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Asset title — e.g. Primary logo + 3 variants"
          style={inputStyle}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)} style={selectStyle}>
          {ASSET_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>
      <input
        type="text"
        value={payloadStr}
        onChange={(e) => setPayloadStr(e.target.value)}
        placeholder='Optional payload JSON — e.g. {"pngUrl": "https://..."}'
        style={{ ...inputStyle, fontSize: "0.8rem", marginBottom: 8 }}
      />
      {err && <div style={{ color: "#fca5a5", fontSize: "0.82rem", marginBottom: 8 }}>{err}</div>}
      <button
        type="submit"
        disabled={submitting || !title.trim()}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          background: submitting ? "#3a3a3a" : "#D4A843",
          color: "#000",
          border: "none",
          fontSize: "0.82rem",
          fontWeight: 700,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "Adding…" : "Add asset"}
      </button>
    </form>
  );
}

function AddEventForm({ launchId, onCreated }: { launchId: string; onCreated: () => void }) {
  const [kind, setKind]             = useState<EventKind>("note");
  const [title, setTitle]           = useState("");
  const [detail, setDetail]         = useState("");
  const [eta, setEta]               = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/launches/${launchId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, title: title.trim(),
          detail: detail.trim() || null,
          eta: eta.trim() || null,
        }),
      });
      if (!r.ok) { alert(await r.text()); return; }
      setTitle(""); setDetail(""); setEta("");
      onCreated();
    } finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={submit} style={{
      background: "#111",
      border: "1px solid #1e1e1e",
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    }}>
      <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} style={{ ...selectStyle, width: "100%", marginBottom: 8 }}>
        <option value="note">Note (shows as "Latest move")</option>
        <option value="upcoming">Upcoming (shows in "This week")</option>
      </select>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
        style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
      {kind === "upcoming" && (
        <input type="text" value={eta} onChange={(e) => setEta(e.target.value)}
          placeholder="ETA — e.g. Thursday, next week"
          style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
      )}
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Detail (optional)"
        rows={2}
        style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: 8, fontFamily: "inherit" }}
      />
      <button
        type="submit"
        disabled={submitting || !title.trim()}
        style={{
          padding: "7px 14px",
          borderRadius: 8,
          background: submitting ? "#3a3a3a" : "#1e1e1e",
          color: "#e4e4e7",
          border: "1px solid #D4A843",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        Add event
      </button>
    </form>
  );
}

function AssetRow({ asset, onChangeStatus, onDelete }: {
  asset: Asset;
  onChangeStatus: (status: AssetStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "12px 14px",
      background: "#111",
      border: "1px solid #1e1e1e",
      borderRadius: 10,
      alignItems: "center",
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 8,
        background: "rgba(212,168,67,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18,
        flexShrink: 0,
      }}>
        {assetEmoji(asset.kind)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 600 }}>{asset.title}</div>
        <div style={{ fontSize: "0.76rem", color: "#71717a", marginTop: 1 }}>
          {assetLabel(asset.kind)} · {relTime(asset.createdAt)}{asset.aiGenerated ? " · AI" : " · manual"}
        </div>
      </div>
      <select
        value={asset.status}
        onChange={(e) => onChangeStatus(e.target.value as AssetStatus)}
        style={{ ...selectStyle, width: 130, flexShrink: 0 }}
      >
        {ASSET_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
      </select>
      <button
        onClick={onDelete}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          background: "transparent",
          border: "1px solid #2a1a1a",
          color: "#fca5a5",
          fontSize: "0.78rem",
          cursor: "pointer",
          flexShrink: 0,
        }}
        aria-label="Delete asset"
      >
        ✕
      </button>
    </div>
  );
}

function EventRow({ event }: { event: Event }) {
  const color =
    event.kind === "asset_ready"  ? "#3ecf8e" :
    event.kind === "phase_change" ? "#D4A843" :
    event.kind === "upcoming"     ? "#f59e0b" :
                                    "#71717a";
  return (
    <div style={{
      padding: "11px 14px",
      background: "#111",
      border: "1px solid #1e1e1e",
      borderRadius: 10,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <div style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600, lineHeight: 1.3 }}>
          {event.title}
        </div>
        <div style={{ fontSize: "0.7rem", color: "#71717a", flexShrink: 0 }}>
          {relTime(event.createdAt)}
        </div>
      </div>
      {event.detail && (
        <div style={{ fontSize: "0.8rem", color: "#a1a1aa", marginTop: 4, lineHeight: 1.5 }}>{event.detail}</div>
      )}
      {event.eta && (
        <div style={{ fontSize: "0.7rem", color: "#D4A843", marginTop: 4, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          ETA · {event.eta}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assetLabel(k: AssetKind): string {
  return ({ logo: "Logo", store: "Storefront", product_page: "Product page", ad: "Ad creative", ugc: "UGC video", email: "Email flow" } as Record<AssetKind, string>)[k];
}
function assetEmoji(k: AssetKind): string {
  return ({ logo: "◆", store: "🛍", product_page: "📄", ad: "🎬", ugc: "📱", email: "✉" } as Record<AssetKind, string>)[k];
}
function statusLabel(s: AssetStatus): string {
  return ({ in_progress: "In progress", in_review: "In review", ready: "Ready" } as Record<AssetStatus, string>)[s];
}

function relTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  background: "#0a0a0a",
  border: "1px solid #1e1e1e",
  color: "#e4e4e7",
  fontSize: "0.86rem",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};
