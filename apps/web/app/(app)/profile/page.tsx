"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { tasksApi, statsApi, accountApi, summaryApi, type DailyTask, type Stats, type HeatmapDay, type WeeklySummary as WeeklySummaryType, type WeeklySummaryStatus } from "@/lib/api-client";
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
  const [weeklyStatus, setWeeklyStatus] = useState<WeeklySummaryStatus | null>(null);
  const [weeklyFrozenData, setWeeklyFrozenData] = useState<WeeklySummaryType | null>(null);
  const [weeklyOpening, setWeeklyOpening] = useState(false);
  const [countdown, setCountdown] = useState("");

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

  // Re-fetch on tab visibility change (e.g. after completing tasks on dashboard)
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  // Weekly analysis status
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    summaryApi.weeklyStatus(tz).then((res) => {
      setWeeklyStatus(res);
      if (res.status === "available" && res.summary) {
        setWeeklyFrozenData(res.summary);
      }
    }).catch(() => {});
  }, []);

  // Countdown timer
  useEffect(() => {
    const unlocksAt = weeklyStatus?.unlocksAt;
    if (!unlocksAt || (weeklyStatus?.status !== "locked" && weeklyStatus?.status !== "expired")) {
      setCountdown("");
      return;
    }
    function update() {
      const diff = new Date(unlocksAt!).getTime() - Date.now();
      if (diff <= 0) { setCountdown("Available now"); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      if (days > 0) setCountdown(`Unlocks in ${days}d ${hours}h`);
      else if (hours > 0) setCountdown(`Unlocks in ${hours}h ${mins}m`);
      else setCountdown(`Unlocks in ${mins}m`);
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [weeklyStatus]);

  async function handleOpenWeekly() {
    if (weeklyStatus?.status === "available" && weeklyFrozenData) {
      setShowWeeklySummary(true);
      return;
    }
    if (weeklyStatus?.status !== "ready") return;
    setWeeklyOpening(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await summaryApi.weeklyOpen(tz);
      setWeeklyFrozenData(data);
      setWeeklyStatus({ status: "available", summary: data });
      setShowWeeklySummary(true);
    } catch {
      // silently fail
    } finally {
      setWeeklyOpening(false);
    }
  }

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
        </div>
        {weeklyStatus?.status === "ready" ? (
          <button
            className="btn"
            onClick={handleOpenWeekly}
            disabled={weeklyOpening}
            style={{
              fontSize: "0.85rem",
              background: "var(--primary)",
              color: "white",
              border: "none",
            }}
          >
            {weeklyOpening ? "Loading..." : "\u2728 Weekly Analysis Ready!"}
          </button>
        ) : weeklyStatus?.status === "available" ? (
          <button
            className="btn btn-outline"
            onClick={handleOpenWeekly}
            style={{ fontSize: "0.85rem" }}
          >
            {"\uD83D\uDCCA"} Weekly Analysis
          </button>
        ) : (
          <button
            className="btn btn-outline"
            disabled
            style={{
              fontSize: "0.85rem",
              opacity: 0.5,
              cursor: "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {"\uD83D\uDD12"} Weekly Analysis {countdown ? `· ${countdown.replace("Unlocks in ", "")}` : ""}
          </button>
        )}
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
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.75rem",
      }}>
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--warning)" }}>
            {(stats?.streak ?? 0) > 2 ? "🔥 " : ""}<AnimatedNumber value={stats?.streak ?? 0} />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Day streak</div>
        </div>
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0.08s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--success)" }}>
            ✓ <AnimatedNumber value={stats?.totalCompleted ?? 0} />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Total tasks done</div>
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
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0.32s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--primary)" }}>
            <AnimatedNumber value={stats?.bestStreak ?? 0} suffix="d" />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Best streak</div>
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
        <WeeklySummaryModal onClose={() => setShowWeeklySummary(false)} frozenData={weeklyFrozenData} />
      )}
    </div>
  );
}
