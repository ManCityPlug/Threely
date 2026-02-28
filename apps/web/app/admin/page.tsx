"use client";

import { useEffect, useState } from "react";

interface OverviewData {
  users: { total: number; active7d: number; new30d: number };
  goals: { total: number; active: number };
  tasks: {
    totalItems: number;
    completed: number;
    skipped: number;
    completionRate: number;
    dailyTaskRecords: number;
  };
  subscriptions: {
    trialing: number;
    active: number;
    estimatedMRR: number;
  };
  ai: {
    breakdown: Record<string, { calls: number; cost: number }>;
    totalCost: number;
  };
}

const cardStyle: React.CSSProperties = {
  background: "#18181b",
  border: "1px solid #27272a",
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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
      {sub && (
        <div style={{ fontSize: "0.8rem", color: "#a1a1aa", marginTop: 2 }}>
          {sub}
        </div>
      )}
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
    return (
      <div style={{ color: "#fca5a5", padding: "2rem" }}>Error: {error}</div>
    );
  }

  if (!data) {
    return <div style={{ color: "#71717a", padding: "2rem" }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#fff",
          marginBottom: "0.25rem",
        }}
      >
        Overview
      </h1>
      <p
        style={{
          fontSize: "0.85rem",
          color: "#71717a",
          marginBottom: "2rem",
        }}
      >
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
        <StatCard label="Active (7d)" value={data.users.active7d} />
        <StatCard label="New (30d)" value={data.users.new30d} />
      </div>

      {/* Content */}
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
        Content
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
          label="Total Goals"
          value={data.goals.total}
          sub={`${data.goals.active} active`}
        />
        <StatCard
          label="Task Items"
          value={data.tasks.totalItems.toLocaleString()}
          sub={`${data.tasks.dailyTaskRecords} daily records`}
        />
        <StatCard
          label="Completed"
          value={data.tasks.completed.toLocaleString()}
          sub={`${data.tasks.completionRate}% rate`}
        />
        <StatCard
          label="Skipped"
          value={data.tasks.skipped.toLocaleString()}
        />
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
        <StatCard label="Trialing" value={data.subscriptions.trialing} />
        <StatCard label="Active Subs" value={data.subscriptions.active} />
        <StatCard
          label="Est. MRR"
          value={`$${data.subscriptions.estimatedMRR.toFixed(2)}`}
        />
      </div>

      {/* AI Costs */}
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
        AI Costs (Estimated)
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <StatCard
          label="Total AI Cost"
          value={`$${data.ai.totalCost.toFixed(2)}`}
        />
      </div>
      <div style={cardStyle}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #27272a" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "0.5rem 0",
                  color: "#71717a",
                  fontWeight: 600,
                }}
              >
                Function
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "0.5rem 0",
                  color: "#71717a",
                  fontWeight: 600,
                }}
              >
                Calls
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "0.5rem 0",
                  color: "#71717a",
                  fontWeight: 600,
                }}
              >
                Est. Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.ai.breakdown).map(([fn, info]) => (
              <tr key={fn} style={{ borderBottom: "1px solid #1e1e21" }}>
                <td style={{ padding: "0.4rem 0", color: "#e4e4e7" }}>{fn}</td>
                <td
                  style={{
                    padding: "0.4rem 0",
                    textAlign: "right",
                    color: "#a1a1aa",
                  }}
                >
                  {info.calls.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "0.4rem 0",
                    textAlign: "right",
                    color: "#a1a1aa",
                  }}
                >
                  ${info.cost.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
