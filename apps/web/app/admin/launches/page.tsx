"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface LaunchRow {
  id: string;
  userId: string;
  userEmail: string;
  businessName: string;
  niche: string;
  currentPhase: number;
  status: "active" | "paused" | "completed";
  assetCount: number;
  eventCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ListResp {
  launches: LaunchRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PHASE_NAMES = ["Foundation", "Branding", "Store", "First Ads", "Scale", "Growth"];

export default function AdminLaunchesPage() {
  const [data, setData]       = useState<ListResp | null>(null);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search.trim()) q.set("search", search.trim());
      const r = await fetch(`/api/admin/launches?${q}`);
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const h = setTimeout(load, 200);
    return () => clearTimeout(h);
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            Launches
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#71717a" }}>
            All user launches — drop assets, advance phases, watch deliveries.
          </p>
        </div>

        <input
          type="text"
          placeholder="Search by business, niche, or email"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{
            flex: "1 1 260px",
            maxWidth: 360,
            padding: "10px 14px",
            borderRadius: 10,
            background: "#111",
            border: "1px solid #1e1e1e",
            color: "#e4e4e7",
            fontSize: "0.88rem",
            outline: "none",
          }}
        />
      </div>

      {error && (
        <div style={{ color: "#fca5a5", padding: "1rem", background: "#1a0a0a", borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && !data ? (
        <div style={{ color: "#71717a", padding: "2rem 0" }}>Loading…</div>
      ) : !data || data.launches.length === 0 ? (
        <div style={{
          padding: "3rem 2rem", textAlign: "center",
          background: "#111", borderRadius: 12, border: "1px dashed #1e1e1e",
          color: "#71717a",
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🚀</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e4e4e7", marginBottom: 4 }}>
            No launches yet
          </div>
          <div style={{ fontSize: "0.85rem" }}>
            When a user fills out the /launch form, it&apos;ll show up here.
          </div>
        </div>
      ) : (
        <>
          <div style={{
            background: "#111",
            border: "1px solid #1e1e1e",
            borderRadius: 12,
            overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0a0a0a", borderBottom: "1px solid #1e1e1e" }}>
                  <Th>Business</Th>
                  <Th>User</Th>
                  <Th>Niche</Th>
                  <Th>Phase</Th>
                  <Th>Status</Th>
                  <Th align="right">Assets</Th>
                  <Th align="right">Updated</Th>
                </tr>
              </thead>
              <tbody>
                {data.launches.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #1e1e1e" }}>
                    <Td>
                      <Link
                        href={`/admin/launches/${l.id}`}
                        style={{ color: "#fff", fontWeight: 600, textDecoration: "none" }}
                      >
                        {l.businessName}
                      </Link>
                    </Td>
                    <Td>
                      <span style={{ color: "#a1a1aa", fontSize: "0.83rem" }}>{l.userEmail}</span>
                    </Td>
                    <Td>
                      <span style={{ color: "#a1a1aa", fontSize: "0.83rem" }}>{l.niche}</span>
                    </Td>
                    <Td>
                      <span style={{ color: "#D4A843", fontSize: "0.82rem", fontWeight: 600 }}>
                        {l.currentPhase} · {PHASE_NAMES[l.currentPhase - 1] || "?"}
                      </span>
                    </Td>
                    <Td><StatusPill status={l.status} /></Td>
                    <Td align="right">
                      <span style={{ color: "#e4e4e7", fontWeight: 600 }}>{l.assetCount}</span>
                    </Td>
                    <Td align="right">
                      <span style={{ color: "#71717a", fontSize: "0.82rem" }}>
                        {relTime(l.updatedAt)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, fontSize: "0.85rem", color: "#a1a1aa" }}>
              <div>
                Page <b style={{ color: "#fff" }}>{page}</b> of {totalPages} · {data.total} total
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={pagerBtn(page <= 1)}
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={pagerBtn(page >= totalPages)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      padding: "10px 16px",
      textAlign: align ?? "left",
      fontSize: "0.72rem",
      color: "#71717a",
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ padding: "12px 16px", textAlign: align ?? "left", fontSize: "0.9rem", color: "#e4e4e7" }}>
      {children}
    </td>
  );
}

function StatusPill({ status }: { status: "active" | "paused" | "completed" }) {
  const color =
    status === "active"    ? "#3ecf8e" :
    status === "completed" ? "#D4A843" :
                             "#71717a";
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: "0.72rem",
      fontWeight: 700,
      color,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${color}`,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    }}>
      {status}
    </span>
  );
}

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "7px 14px",
    borderRadius: 8,
    background: disabled ? "#1a1a1a" : "#1e1e1e",
    border: "1px solid #1e1e1e",
    color: disabled ? "#4a4a4a" : "#e4e4e7",
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
  };
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
