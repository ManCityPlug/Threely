"use client";

import { useEffect, useState } from "react";
import { summaryApi, type WeeklySummary as WeeklySummaryType } from "@/lib/api-client";

export default function WeeklySummaryModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<WeeklySummaryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    summaryApi
      .weekly(true)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load weekly summary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 500 }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Weekly Summary
          </h2>
          <button
            onClick={onClose}
            style={{ fontSize: 20, color: "var(--muted)", padding: 4 }}
          >
            {"\u2715"}
          </button>
        </div>

        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem 0",
            }}
          >
            <span
              className="spinner spinner-dark"
              style={{ width: 28, height: 28 }}
            />
            <p
              style={{
                color: "var(--subtext)",
                fontSize: "0.85rem",
                marginTop: 12,
              }}
            >
              Loading your week...
            </p>
          </div>
        )}

        {error && (
          <p
            style={{
              color: "var(--danger)",
              fontSize: "0.9rem",
              textAlign: "center",
              padding: "1rem 0",
            }}
          >
            {error}
          </p>
        )}

        {data && data.tasksCompleted === 0 && data.tasksGenerated === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>{"\uD83D\uDCCA"}</div>
            <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
              No activity this week
            </p>
            <p style={{ fontSize: "0.85rem", color: "var(--subtext)", lineHeight: 1.5 }}>
              Start working on your goals and your weekly summary will appear here.
            </p>
          </div>
        )}

        {data && (data.tasksCompleted > 0 || data.tasksGenerated > 0) && (
          <>
            {/* Stats grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                marginBottom: "1.5rem",
              }}
            >
              <div
                className="card"
                style={{ padding: "0.875rem", textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--success)",
                  }}
                >
                  {data.tasksCompleted}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    marginTop: 2,
                  }}
                >
                  Tasks completed
                </div>
              </div>
              <div
                className="card"
                style={{ padding: "0.875rem", textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  {(data.hoursInvested ?? 0).toFixed(1)}h
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    marginTop: 2,
                  }}
                >
                  Hours invested
                </div>
              </div>
              <div
                className="card"
                style={{ padding: "0.875rem", textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--text)",
                  }}
                >
                  {data.goalsWorkedOn}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    marginTop: 2,
                  }}
                >
                  Goals active
                </div>
              </div>
              <div
                className="card"
                style={{ padding: "0.875rem", textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--text)",
                  }}
                >
                  {(data.tasksGenerated ?? 0) > 0
                    ? Math.round(
                        (data.tasksCompleted / data.tasksGenerated) * 100
                      )
                    : 0}
                  %
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    marginTop: 2,
                  }}
                >
                  Completion rate
                </div>
              </div>
            </div>

            {/* Daily breakdown */}
            {data.dailyBreakdown && data.dailyBreakdown.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--subtext)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                  }}
                >
                  Daily Breakdown
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    alignItems: "flex-end",
                    height: 60,
                  }}
                >
                  {data.dailyBreakdown.map((day) => {
                    const pct =
                      day.total > 0
                        ? Math.round((day.completed / day.total) * 100)
                        : 0;
                    const barHeight = Math.max(4, (pct / 100) * 52);
                    const dateObj = new Date(day.date + "T12:00:00");
                    const label = dateObj.toLocaleDateString("en-US", {
                      weekday: "short",
                    });
                    return (
                      <div
                        key={day.date}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            maxWidth: 32,
                            height: barHeight,
                            background:
                              pct === 100
                                ? "var(--success)"
                                : pct > 0
                                ? "var(--primary)"
                                : "var(--border)",
                            borderRadius: 3,
                            transition: "height 0.3s ease",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--muted)",
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI insight */}
            {data.insight && (
              <div
                style={{
                  background: "var(--primary-light)",
                  borderRadius: "var(--radius)",
                  padding: "1rem",
                  border: "1px solid rgba(99,91,255,0.15)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 14, color: "var(--primary)" }}>
                    {"\u2726"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--primary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Weekly Insight
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text)",
                    lineHeight: 1.6,
                  }}
                >
                  {data.insight}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
