"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { tasksApi, statsApi, accountApi, type DailyTask, type Stats, type HeatmapDay } from "@/lib/api-client";
import { SkeletonStatCard, SkeletonCard } from "@/components/Skeleton";
import WeeklyBarChart from "@/components/WeeklyBarChart";
import WeeklySummaryModal from "@/components/WeeklySummary";
import { useToast } from "@/components/ToastProvider";
import { useTheme } from "@/lib/theme-context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr: string): string {
  const d = localDate(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel({ history }: { history: DailyTask[] }) {
  // Only show completed tasks
  const grouped = history.reduce<Record<string, typeof history[0]["tasks"]>>((acc, dt) => {
    const key = dt.date.slice(0, 10);
    const completed = dt.tasks.filter(t => t.isCompleted);
    if (completed.length === 0) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(...completed);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (!sortedDates.length) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)", fontSize: "0.875rem" }}>
        No completed tasks yet. Finish your first task to build your record!
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {sortedDates.map(dateKey => {
        const completedItems = grouped[dateKey];

        return (
          <div key={dateKey} className="card" style={{ padding: "0.875rem 1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)" }}>
                {formatDate(dateKey)}
              </span>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--success)" }}>
                {completedItems.length} completed
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {completedItems.map(item => (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: "0.8rem", color: "var(--success)",
                }}>
                  <span style={{ fontSize: 12 }}>✓</span>
                  <span>{item.task}</span>
                  <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: "0.72rem" }}>
                    {item.estimated_minutes}m
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }

    const duration = 800; // ms
    startRef.current = null;

    function animate(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <>{display}{suffix}</>;
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { mode, setMode } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<DailyTask[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"history" | "settings">("history");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsRes, historyRes, heatmapRes] = await Promise.all([
        statsApi.get(),
        tasksApi.history(30),
        statsApi.heatmap(90),
      ]);
      setStats(statsRes);
      setHistory(historyRes.dailyTasks);
      setHeatmapData(heatmapRes.heatmap);
    } catch {
      showToast("Failed to load profile data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await accountApi.delete();
      await signOut();
      router.replace("/register");
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="page-inner">
        <div style={{ marginBottom: "1.75rem" }}>
          <div className="skeleton" style={{ width: 100, height: 28, marginBottom: 6, borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ width: 180, height: 14, borderRadius: "var(--radius-sm)" }} />
        </div>
        {/* Heatmap skeleton */}
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div className="skeleton" style={{ width: "100%", height: 120, borderRadius: "var(--radius-sm)" }} />
        </div>
        {/* Stats skeleton */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.75rem",
        }}>
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
        {/* History skeleton */}
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="page-inner">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Profile</h1>
          <p style={{ color: "var(--subtext)", fontSize: "0.875rem", marginTop: 2 }}>
            {user?.email}
          </p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => setShowWeeklySummary(true)}
          style={{ fontSize: "0.85rem" }}
        >
          {"\uD83D\uDCCA"} Weekly Summary
        </button>
      </div>

      {/* Weekly activity */}
      <div className="card slide-up" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
        <h3 style={{
          fontSize: "0.8rem", fontWeight: 600, color: "var(--subtext)",
          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10,
        }}>
          Activity
        </h3>
        <WeeklyBarChart data={heatmapData} />
      </div>

      {/* Stats row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.75rem",
      }}>
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--primary)" }}>
            <AnimatedNumber value={stats?.streak ?? 0} />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Day streak</div>
        </div>
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0.08s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--success)" }}>
            <AnimatedNumber value={stats?.totalCompleted ?? 0} />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Tasks done</div>
        </div>
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0.16s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text)" }}>
            <AnimatedNumber value={stats?.activeGoals ?? 0} />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Active goals</div>
        </div>
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0.24s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text)" }}>
            <AnimatedNumber value={stats?.totalHoursInvested ?? 0} suffix="h" />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Hours invested</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: "1rem",
        borderBottom: "1px solid var(--border)", paddingBottom: 0,
      }}>
        {(["history", "settings"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--primary)" : "var(--subtext)",
              borderBottom: activeTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {tab === "history" ? "Task History" : "Settings"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ marginBottom: "2rem" }}>
        {activeTab === "history" && <HistoryPanel history={history} />}
        {activeTab === "settings" && (
          <>
            {/* Appearance */}
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
                Appearance
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                {(["light", "dark"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setMode(opt)}
                    style={{
                      flex: 1,
                      padding: "0.6rem 0.75rem",
                      borderRadius: "var(--radius)",
                      border: mode === opt ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                      background: mode === opt ? "var(--primary-light)" : "var(--card)",
                      color: mode === opt ? "var(--primary)" : "var(--subtext)",
                      fontWeight: mode === opt ? 600 : 500,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      textTransform: "capitalize",
                    }}
                  >
                    {opt === "light" ? "\u2600\uFE0F Light" : "\uD83C\uDF19 Dark"}
                  </button>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="card" style={{
              padding: "1.25rem",
              border: "1px solid var(--danger-light)",
              background: "var(--card)",
              marginTop: "1rem",
            }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--danger)", marginBottom: 6 }}>
                Danger zone
              </h3>
              {!showDeleteConfirm ? (
                <div>
                  <p style={{ fontSize: "0.825rem", color: "var(--subtext)", marginBottom: 12 }}>
                    Permanently delete your account and all data. This cannot be undone.
                  </p>
                  <button
                    className="btn btn-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{ fontSize: "0.825rem" }}
                  >
                    Delete account
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: "0.825rem", color: "var(--danger)", fontWeight: 600, marginBottom: 12 }}>
                    Are you sure? This will delete all your goals, tasks, and history forever.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting..." : "Yes, delete everything"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Weekly Summary modal */}
      {showWeeklySummary && (
        <WeeklySummaryModal onClose={() => setShowWeeklySummary(false)} />
      )}
    </div>
  );
}
