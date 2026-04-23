"use client";

import { useEffect, useState } from "react";

interface OverviewData {
  users: { total: number; paid: number; trialing: number };
  subscriptions: { estimatedMRR: number };
}

const cardStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
  padding: "1.25rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#71717a",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#fff",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div style={{ color: "#fca5a5", padding: "2rem" }}>Error: {error}</div>;
  }

  if (!data) {
    return <div style={{ color: "#71717a", padding: "2rem" }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "0.25rem" }}>
        Overview
      </h1>
      <p style={{ fontSize: "0.85rem", color: "#71717a", marginBottom: "2rem" }}>
        Platform-wide metrics
      </p>

      {/* Users */}
      <h2
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#a1a1aa",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        Users
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard label="Total Users" value={data.users.total} />
        <StatCard label="Paid Users" value={data.users.paid} />
        <StatCard label="Trialing Users" value={data.users.trialing} />
      </div>

      {/* Revenue */}
      <h2
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#a1a1aa",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        Revenue
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          label="Est. MRR"
          value={`$${data.subscriptions.estimatedMRR.toFixed(2)}`}
        />
      </div>
    </div>
  );
}
