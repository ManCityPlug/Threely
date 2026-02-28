"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface UserDetail {
  user: {
    id: string;
    email: string;
    createdAt: string;
    lastSignIn: string | null;
    nickname: string | null;
    profile: {
      dailyTimeMinutes: number;
      intensityLevel: number;
    } | null;
  };
  goals: {
    total: number;
    active: number;
    completed: number;
    last30d: number;
    list: {
      id: string;
      title: string;
      category: string | null;
      isActive: boolean;
      isPaused: boolean;
      createdAt: string;
    }[];
  };
  tasks: {
    totalGenerated: number;
    completed: number;
    skipped: number;
    completionRate: number;
    totalMinutesInvested: number;
    totalHoursInvested: number;
    dailyTaskRecords: number;
  };
  streaks: { current: number; best: number };
  subscription: {
    status: string | null;
    stripeCustomerId: string | null;
    trialClaimedAt: string | null;
    trialEndsAt: string | null;
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

const sectionTitle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#a1a1aa",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.75rem",
};

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 600,
          color: "#71717a",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>
        {value}
      </div>
    </div>
  );
}

function daysSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/users/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load user");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [params.id]);

  if (error) {
    return (
      <div style={{ color: "#fca5a5", padding: "2rem" }}>Error: {error}</div>
    );
  }
  if (!data) {
    return <div style={{ color: "#71717a", padding: "2rem" }}>Loading...</div>;
  }

  const { user, goals, tasks, streaks, subscription, ai } = data;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Back button */}
      <button
        onClick={() => router.push("/admin/users")}
        style={{
          background: "none",
          border: "none",
          color: "#635bff",
          fontSize: "0.85rem",
          cursor: "pointer",
          marginBottom: "1rem",
          padding: 0,
        }}
      >
        &larr; Back to users
      </button>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: 4 }}>
          {user.email}
        </h1>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.85rem", color: "#71717a" }}>
          {user.nickname && <span>{user.nickname}</span>}
          <span>Joined {daysSince(user.createdAt)}</span>
          {user.lastSignIn && (
            <span>Last login {daysSince(user.lastSignIn)}</span>
          )}
        </div>
      </div>

      {/* Streaks */}
      <h2 style={sectionTitle}>Streaks</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div style={cardStyle}>
          <Stat label="Current Streak" value={`${streaks.current} days`} />
        </div>
        <div style={cardStyle}>
          <Stat label="Best Streak" value={`${streaks.best} days`} />
        </div>
      </div>

      {/* Goals */}
      <h2 style={sectionTitle}>Goals</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={cardStyle}>
          <Stat label="Total" value={goals.total} />
        </div>
        <div style={cardStyle}>
          <Stat label="Active" value={goals.active} />
        </div>
        <div style={cardStyle}>
          <Stat label="Completed" value={goals.completed} />
        </div>
        <div style={cardStyle}>
          <Stat label="Last 30d" value={goals.last30d} />
        </div>
      </div>
      {goals.list.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: "2rem" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                {["Title", "Category", "Status", "Created"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "0.5rem 0.75rem",
                      color: "#71717a",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {goals.list.map((g) => (
                <tr key={g.id} style={{ borderBottom: "1px solid #1e1e21" }}>
                  <td
                    style={{
                      padding: "0.5rem 0.75rem",
                      color: "#e4e4e7",
                      maxWidth: 300,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {g.title}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#a1a1aa" }}>
                    {g.category || "—"}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: g.isActive
                          ? g.isPaused
                            ? "#422006"
                            : "#052e16"
                          : "#27272a",
                        color: g.isActive
                          ? g.isPaused
                            ? "#fbbf24"
                            : "#4ade80"
                          : "#71717a",
                      }}
                    >
                      {g.isActive
                        ? g.isPaused
                          ? "Paused"
                          : "Active"
                        : "Done"}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#71717a" }}>
                    {new Date(g.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tasks */}
      <h2 style={sectionTitle}>Tasks</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div style={cardStyle}>
          <Stat label="Generated" value={tasks.totalGenerated} />
        </div>
        <div style={cardStyle}>
          <Stat label="Completed" value={tasks.completed} />
        </div>
        <div style={cardStyle}>
          <Stat label="Skipped" value={tasks.skipped} />
        </div>
        <div style={cardStyle}>
          <Stat label="Completion %" value={`${tasks.completionRate}%`} />
        </div>
        <div style={cardStyle}>
          <Stat
            label="Hours Invested"
            value={tasks.totalHoursInvested}
          />
        </div>
        <div style={cardStyle}>
          <Stat label="Daily Records" value={tasks.dailyTaskRecords} />
        </div>
      </div>

      {/* Subscription */}
      <h2 style={sectionTitle}>Subscription</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div style={cardStyle}>
          <Stat label="Status" value={subscription.status || "none"} />
        </div>
        {subscription.stripeCustomerId && (
          <div style={cardStyle}>
            <Stat
              label="Stripe ID"
              value={subscription.stripeCustomerId}
            />
          </div>
        )}
        {subscription.trialEndsAt && (
          <div style={cardStyle}>
            <Stat
              label="Trial Ends"
              value={new Date(subscription.trialEndsAt).toLocaleDateString()}
            />
          </div>
        )}
      </div>

      {/* AI Costs */}
      <h2 style={sectionTitle}>AI Costs (Estimated)</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={cardStyle}>
          <Stat label="Total Cost" value={`$${ai.totalCost.toFixed(2)}`} />
        </div>
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
            {Object.entries(ai.breakdown).map(([fn, info]) => (
              <tr key={fn} style={{ borderBottom: "1px solid #1e1e21" }}>
                <td style={{ padding: "0.4rem 0", color: "#e4e4e7" }}>
                  {fn}
                </td>
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
