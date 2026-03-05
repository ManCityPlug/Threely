"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface LLMTrainingData {
  totalLogs: number;
  estimatedTrainingReady: number;
  uniqueUsers: number;
  avgResponseTime: number;
  logsByFunction: { functionName: string; count: number }[];
  logsByModel: { modelUsed: string; count: number }[];
  feedbackStats: {
    completed: number;
    skipped: number;
    rescheduled: number;
    edited: number;
    none: number;
  };
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  dailyGrowth: { date: string; count: number }[];
  costBreakdown: {
    perModel: { model: string; inputTokens: number; outputTokens: number; cost: number }[];
    totalCost: number;
  };
  recentLogs: {
    id: string;
    createdAt: string;
    functionName: string;
    modelUsed: string;
    inputTokens: number | null;
    outputTokens: number | null;
    responseTimeMs: number | null;
    taskFeedback: string | null;
  }[];
}

// ─── Styles ─────────────────────────────────────────────────────────────────
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

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#a1a1aa",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.75rem",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.82rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid #27272a",
  color: "#a1a1aa",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #1e1e21",
  color: "#e4e4e7",
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ ...valueStyle, color: valueColor || "#fff" }}>{value}</div>
      {sub && (
        <div style={{ fontSize: "0.8rem", color: "#a1a1aa", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function feedbackBadge(feedback: string | null): React.ReactNode {
  const styles: Record<string, React.CSSProperties> = {
    completed: {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: "0.7rem",
      fontWeight: 600,
      background: "rgba(62, 207, 142, 0.15)",
      color: "#3ecf8e",
    },
    skipped: {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: "0.7rem",
      fontWeight: 600,
      background: "rgba(239, 68, 68, 0.15)",
      color: "#ef4444",
    },
    rescheduled: {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: "0.7rem",
      fontWeight: 600,
      background: "rgba(251, 191, 36, 0.15)",
      color: "#fbbf24",
    },
    edited: {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: "0.7rem",
      fontWeight: 600,
      background: "rgba(99, 91, 255, 0.15)",
      color: "#818cf8",
    },
    none: {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: "0.7rem",
      fontWeight: 600,
      background: "rgba(113, 113, 122, 0.15)",
      color: "#71717a",
    },
  };

  const key = feedback || "none";
  const label = feedback || "no feedback";
  return <span style={styles[key] || styles.none}>{label}</span>;
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function LLMTrainingPage() {
  const [data, setData] = useState<LLMTrainingData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/llm-training")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div style={{ color: "#fca5a5", padding: "2rem" }}>Error: {error}</div>
    );
  }

  if (!data) {
    return <div style={{ color: "#71717a", padding: "2rem" }}>Loading...</div>;
  }

  const combinedTokens = data.totalTokens.input + data.totalTokens.output;

  // Progress bar logic
  const readyCount = data.estimatedTrainingReady;
  let progressLabel: string;
  let progressColor: string;
  let progressPercent: number;
  if (readyCount < 500) {
    progressLabel = "Collecting...";
    progressColor = "#ef4444";
    progressPercent = (readyCount / 500) * 25;
  } else if (readyCount < 1000) {
    progressLabel = "Basic Fine-Tune Ready";
    progressColor = "#fbbf24";
    progressPercent = 25 + ((readyCount - 500) / 500) * 25;
  } else if (readyCount < 5000) {
    progressLabel = "Good Fine-Tune Ready";
    progressColor = "#635bff";
    progressPercent = 50 + ((readyCount - 1000) / 4000) * 25;
  } else {
    progressLabel = "Great Fine-Tune Ready";
    progressColor = "#3ecf8e";
    progressPercent = 75 + Math.min(((readyCount - 5000) / 5000) * 25, 25);
  }

  const maxDaily = Math.max(
    ...data.dailyGrowth.map((d) => d.count),
    1
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.25rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#fff",
            marginBottom: "0.25rem",
          }}
        >
          LLM Training
        </h1>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: "#635bff",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.5rem 1rem",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <p
        style={{
          fontSize: "0.85rem",
          color: "#71717a",
          marginBottom: "2rem",
        }}
      >
        Data collection for future Llama 70B fine-tuning
      </p>

      {/* ─── 1. Top Stats Grid ─────────────────────────────────────────── */}
      <h2 style={sectionHeaderStyle}>Collection Overview</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          label="Total Logs Collected"
          value={data.totalLogs.toLocaleString()}
        />
        <StatCard
          label="Training-Ready Examples"
          value={data.estimatedTrainingReady.toLocaleString()}
          valueColor="#3ecf8e"
          sub="taskFeedback = completed"
        />
        <StatCard
          label="Unique Users Tracked"
          value={data.uniqueUsers.toLocaleString()}
        />
        <StatCard
          label="Avg Response Time"
          value={`${data.avgResponseTime.toLocaleString()}ms`}
        />
      </div>

      {/* ─── 2. Progress Bar ───────────────────────────────────────────── */}
      <h2 style={sectionHeaderStyle}>Fine-Tuning Readiness</h2>
      <div style={{ ...cardStyle, marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 600, color: progressColor, fontSize: "0.9rem" }}>
            {progressLabel}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#a1a1aa" }}>
            {readyCount.toLocaleString()} training examples
          </div>
        </div>

        {/* Track */}
        <div
          style={{
            width: "100%",
            height: 12,
            background: "#27272a",
            borderRadius: 6,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: `${Math.min(progressPercent, 100)}%`,
              height: "100%",
              background: progressColor,
              borderRadius: 6,
              transition: "width 0.5s ease",
            }}
          />
        </div>

        {/* Milestone markers */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.7rem",
            color: "#71717a",
          }}
        >
          <span>0</span>
          <span style={{ color: readyCount >= 500 ? "#fbbf24" : "#71717a" }}>
            500 (Basic)
          </span>
          <span style={{ color: readyCount >= 1000 ? "#635bff" : "#71717a" }}>
            1K (Good)
          </span>
          <span style={{ color: readyCount >= 5000 ? "#3ecf8e" : "#71717a" }}>
            5K (Great)
          </span>
          <span style={{ color: readyCount >= 10000 ? "#3ecf8e" : "#71717a" }}>
            10K+
          </span>
        </div>
      </div>

      {/* ─── 3. Logs by Function ───────────────────────────────────────── */}
      <h2 style={sectionHeaderStyle}>Logs by Function</h2>
      <div style={{ ...cardStyle, marginBottom: "2rem" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Function Name</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
              <th style={{ ...thStyle, textAlign: "right" }}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {data.logsByFunction.map((row) => (
              <tr key={row.functionName}>
                <td
                  style={{
                    ...tdStyle,
                    fontFamily: "monospace",
                    fontSize: "0.78rem",
                  }}
                >
                  {row.functionName}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {row.count.toLocaleString()}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    color: "#a1a1aa",
                  }}
                >
                  {data.totalLogs > 0
                    ? ((row.count / data.totalLogs) * 100).toFixed(1)
                    : "0.0"}
                  %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── 4. Logs by Model ──────────────────────────────────────────── */}
      <h2 style={sectionHeaderStyle}>Logs by Model</h2>
      <div style={{ ...cardStyle, marginBottom: "2rem" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Model</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
              <th style={{ ...thStyle, textAlign: "right" }}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {data.logsByModel.map((row) => (
              <tr key={row.modelUsed}>
                <td style={tdStyle}>{row.modelUsed}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {row.count.toLocaleString()}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    color: "#a1a1aa",
                  }}
                >
                  {data.totalLogs > 0
                    ? ((row.count / data.totalLogs) * 100).toFixed(1)
                    : "0.0"}
                  %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── 5. Feedback Distribution ──────────────────────────────────── */}
      <h2 style={sectionHeaderStyle}>Feedback Distribution</h2>
      <div style={{ ...cardStyle, marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          {[
            {
              label: "completed",
              count: data.feedbackStats.completed,
              bg: "rgba(62, 207, 142, 0.15)",
              color: "#3ecf8e",
            },
            {
              label: "skipped",
              count: data.feedbackStats.skipped,
              bg: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
            },
            {
              label: "rescheduled",
              count: data.feedbackStats.rescheduled,
              bg: "rgba(251, 191, 36, 0.15)",
              color: "#fbbf24",
            },
            {
              label: "edited",
              count: data.feedbackStats.edited,
              bg: "rgba(99, 91, 255, 0.15)",
              color: "#818cf8",
            },
            {
              label: "no feedback",
              count: data.feedbackStats.none,
              bg: "rgba(113, 113, 122, 0.15)",
              color: "#71717a",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "#151a2a",
                border: "1px solid #27272a",
                borderRadius: 10,
                padding: "1rem 1.25rem",
                minWidth: 140,
                flex: "1 1 140px",
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    background: item.bg,
                    color: item.color,
                  }}
                >
                  {item.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {item.count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 6. Token Usage & Cost ──────────────────────────────────── */}
      <h2 style={sectionHeaderStyle}>Token Usage & Cost</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <StatCard
          label="Total Input Tokens"
          value={data.totalTokens.input.toLocaleString()}
        />
        <StatCard
          label="Total Output Tokens"
          value={data.totalTokens.output.toLocaleString()}
        />
        <StatCard
          label="Total Combined"
          value={combinedTokens.toLocaleString()}
        />
        <StatCard
          label="Actual Claude API Cost"
          value={`$${data.costBreakdown.totalCost.toFixed(2)}`}
          sub="Per-model pricing applied"
          valueColor="#fbbf24"
        />
      </div>
      <div style={{ ...cardStyle, marginBottom: "2rem" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Model</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Input Tokens</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Output Tokens</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.costBreakdown.perModel.map((m) => (
              <tr key={m.model}>
                <td style={{ ...tdStyle, fontSize: "0.78rem" }}>{m.model}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {m.inputTokens.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {m.outputTokens.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#fbbf24" }}>
                  ${m.cost.toFixed(4)}
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ ...tdStyle, fontWeight: 700, borderTop: "1px solid #27272a" }}>Total</td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "1px solid #27272a" }} />
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "1px solid #27272a" }} />
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#fbbf24", borderTop: "1px solid #27272a" }}>
                ${data.costBreakdown.totalCost.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─── 7. Daily Collection Rate ──────────────────────────────────── */}
      <h2 style={sectionHeaderStyle}>Daily Collection Rate (Last 30 Days)</h2>
      <div style={{ ...cardStyle, marginBottom: "2rem" }}>
        <table style={{ ...tableStyle, fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 100 }}>Date</th>
              <th style={{ ...thStyle, textAlign: "right", width: 60 }}>Count</th>
              <th style={thStyle}>Volume</th>
            </tr>
          </thead>
          <tbody>
            {data.dailyGrowth.map((day) => {
              const barWidth = maxDaily > 0 ? (day.count / maxDaily) * 100 : 0;
              return (
                <tr key={day.date}>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      color: "#a1a1aa",
                    }}
                  >
                    {day.date}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {day.count}
                  </td>
                  <td style={{ ...tdStyle, paddingRight: 20 }}>
                    <div
                      style={{
                        height: 14,
                        width: `${barWidth}%`,
                        minWidth: day.count > 0 ? 4 : 0,
                        background:
                          barWidth > 75
                            ? "#3ecf8e"
                            : barWidth > 40
                            ? "#635bff"
                            : barWidth > 15
                            ? "#fbbf24"
                            : "#ef4444",
                        borderRadius: 3,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── 8. Recent Logs ────────────────────────────────────────────── */}
      <h2 style={sectionHeaderStyle}>Recent Logs (Last 20)</h2>
      <div style={{ ...cardStyle, marginBottom: "2rem", overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Function</th>
              <th style={thStyle}>Model</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Tokens (in/out)</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Response Time</th>
              <th style={thStyle}>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {data.recentLogs.map((log) => (
              <tr key={log.id}>
                <td
                  style={{
                    ...tdStyle,
                    fontSize: "0.75rem",
                    color: "#a1a1aa",
                    whiteSpace: "nowrap",
                  }}
                >
                  {timeAgo(log.createdAt)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontFamily: "monospace",
                    fontSize: "0.78rem",
                  }}
                >
                  {log.functionName}
                </td>
                <td style={{ ...tdStyle, fontSize: "0.78rem" }}>
                  {log.modelUsed}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: "0.78rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {(log.inputTokens ?? 0).toLocaleString()} /{" "}
                  {(log.outputTokens ?? 0).toLocaleString()}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: "0.78rem",
                  }}
                >
                  {log.responseTimeMs ?? 0}ms
                </td>
                <td style={tdStyle}>{feedbackBadge(log.taskFeedback)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
