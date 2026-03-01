"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";
import { tasksApi, statsApi, accountApi, summaryApi, subscriptionApi, goalsApi, type DailyTask, type Stats, type WeeklySummary as WeeklySummaryType, type WeeklySummaryStatus, type SubscriptionStatus, type Goal } from "@/lib/api-client";
import { SkeletonStatCard, SkeletonCard } from "@/components/Skeleton";

import WeeklySummaryModal from "@/components/WeeklySummary";
import { useToast } from "@/components/ToastProvider";
import { useTheme } from "@/lib/theme-context";
import { useSubscription } from "@/lib/subscription-context";

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
  const { hasPro, showPaywall } = useSubscription();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"history" | "settings">("settings");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const isOAuthUser = user?.app_metadata?.provider === "google" || user?.app_metadata?.provider === "apple";
  const providerName = user?.app_metadata?.provider === "google" ? "Google" : user?.app_metadata?.provider === "apple" ? "Apple" : "";
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [weeklyStatus, setWeeklyStatus] = useState<WeeklySummaryStatus | null>(null);
  const [weeklyFrozenData, setWeeklyFrozenData] = useState<WeeklySummaryType | null>(null);
  const [weeklyOpening, setWeeklyOpening] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [subStatus, setSubStatus] = useState<SubscriptionStatus["status"]>(undefined as unknown as SubscriptionStatus["status"]);
  const [subTrialEnd, setSubTrialEnd] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPreset, setNotifPreset] = useState<string | null>(null);
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customStartHour, setCustomStartHour] = useState(8);
  const [customStartMinute, setCustomStartMinute] = useState(0);
  const [customStartAmPm, setCustomStartAmPm] = useState<"AM" | "PM">("AM");
  const [customEndHour, setCustomEndHour] = useState(9);
  const [customEndMinute, setCustomEndMinute] = useState(0);
  const [customEndAmPm, setCustomEndAmPm] = useState<"AM" | "PM">("AM");
  const [focusGoalName, setFocusGoalName] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        statsApi.get(),
        tasksApi.history(30),
      ]);
      setStats(statsRes);
      setHistory(historyRes.dailyTasks);
    } catch {
      showToast("Failed to load profile data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Always fetch fresh data on mount (fires every time the page is navigated to)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // Fetch subscription status
  useEffect(() => {
    subscriptionApi.status().then(res => {
      setSubStatus(res.status);
      if (res.trialEndsAt) setSubTrialEnd(res.trialEndsAt);
    }).catch(() => {});
  }, []);

  // Load notification preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("threely_notif_pref");
      if (saved) {
        const pref = JSON.parse(saved);
        setNotifEnabled(true);
        setNotifPreset(pref.label || null);
        if (pref.label === "Custom") {
          const h24 = pref.hour as number;
          const isPm = h24 >= 12;
          setCustomStartAmPm(isPm ? "PM" : "AM");
          setCustomStartHour(h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24);
          setCustomStartMinute(pref.minute || 0);
          if (pref.endHour !== undefined) {
            const eh = pref.endHour as number;
            const epm = eh >= 12;
            setCustomEndAmPm(epm ? "PM" : "AM");
            setCustomEndHour(eh === 0 ? 12 : eh > 12 ? eh - 12 : eh);
            setCustomEndMinute(pref.endMinute || 0);
          }
        }
      }
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setNotifBlocked(true);
      }
    } catch {}
  }, []);

  // Load focus goal name
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const focusId = localStorage.getItem(`threely_focus_${today}`);
    if (focusId) {
      goalsApi.list().then(res => {
        const goal = res.goals.find((g: Goal) => g.id === focusId);
        if (goal) setFocusGoalName(goal.title);
      }).catch(() => {});
    }
  }, []);

  // Also re-fetch when load reference changes or tab regains visibility
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
    if (!hasPro) { showPaywall(); return; }
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
    } catch (err) {
      if (err instanceof Error && err.message?.includes("pro_required")) {
        showPaywall();
      }
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

  function sendConfirmNotif(time: string) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Threely reminders enabled!", {
        body: `You'll be reminded daily at ${time}. Stay consistent, stay focused!`,
        icon: "/favicon.png",
      });
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
            onClick={() => alert("Your weekly analysis is generated every Monday. Check back then to see your progress report and personalized insights!")}
            style={{
              fontSize: "0.85rem",
              opacity: 0.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {"\uD83D\uDD12"} Weekly Analysis {countdown ? `· ${countdown.replace("Unlocks in ", "")}` : ""}
          </button>
        )}
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
            🔥 <AnimatedNumber value={stats?.streak ?? 0} />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Current streak</div>
        </div>
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0.08s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--success)" }}>
            ✓ <AnimatedNumber value={stats?.totalCompleted ?? 0} />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Total tasks done</div>
        </div>
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0.16s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#3B82F6" }}>
            <AnimatedNumber value={stats?.activeGoals ?? 0} />
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Active goals</div>
        </div>
        <div className="card slide-up" style={{ padding: "1rem", textAlign: "center", animationDelay: "0.24s" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0891B2" }}>
            {(() => {
              const totalMin = stats?.totalMinutesInvested ?? (stats?.totalHoursInvested ? Math.round(stats.totalHoursInvested * 60) : 0);
              const h = Math.floor(totalMin / 60);
              const m = totalMin % 60;
              if (h === 0) return <>{m}m</>;
              if (m === 0) return <>{h}h</>;
              return <>{h}h {m}m</>;
            })()}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Time invested</div>
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
        {(["settings", "history"] as const).map(tab => (
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

            {/* Notifications */}
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
                  Notifications
                </h3>
                {notifBlocked ? (
                  <span style={{ fontSize: "0.72rem", color: "var(--danger)", fontWeight: 500 }}>Blocked</span>
                ) : (
                  <button
                    onClick={async () => {
                      if (notifEnabled) {
                        setNotifEnabled(false);
                        setNotifPreset(null);
                        setShowCustomTime(false);
                        localStorage.removeItem("threely_notif_pref");
                        return;
                      }
                      if (typeof Notification !== "undefined" && Notification.permission === "default") {
                        const perm = await Notification.requestPermission();
                        if (perm === "denied") { setNotifBlocked(true); return; }
                        if (perm !== "granted") return;
                      }
                      setNotifEnabled(true);
                    }}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                      background: notifEnabled ? "var(--primary)" : "var(--border)",
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 2, left: notifEnabled ? 22 : 2,
                      width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                )}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--subtext)", marginBottom: notifEnabled ? 14 : 0, marginTop: 4 }}>
                {notifBlocked
                  ? "Notifications blocked. Enable in your browser settings."
                  : notifEnabled
                  ? "When should we remind you to check your tasks?"
                  : "Enable to get daily task reminders in your browser."}
              </p>

              {notifEnabled && !notifBlocked && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { label: "Morning", emoji: "\uD83C\uDF05", range: "6:00 \u2013 9:00 AM", time: "7:00 AM", hour: 7, minute: 0 },
                    { label: "Afternoon", emoji: "\u2600\uFE0F", range: "12:00 \u2013 3:00 PM", time: "1:00 PM", hour: 13, minute: 0 },
                    { label: "Evening", emoji: "\uD83C\uDF06", range: "5:00 \u2013 8:00 PM", time: "7:00 PM", hour: 19, minute: 0 },
                    { label: "Night", emoji: "\uD83C\uDF19", range: "9:00 \u2013 11:00 PM", time: "9:00 PM", hour: 21, minute: 0 },
                  ].map(preset => {
                    const active = notifPreset === preset.label;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setNotifPreset(preset.label);
                          setShowCustomTime(false);
                          localStorage.setItem("threely_notif_pref", JSON.stringify({ label: preset.label, time: preset.time, hour: preset.hour, minute: preset.minute }));
                          sendConfirmNotif(preset.time);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "0.7rem 0.875rem", borderRadius: "var(--radius)",
                          border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary-light)" : "var(--card)",
                          cursor: "pointer", transition: "all 0.15s", textAlign: "left",
                        }}
                      >
                        <span style={{ fontSize: "1.25rem", width: 28, textAlign: "center", flexShrink: 0 }}>{preset.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: active ? "var(--primary)" : "var(--text)" }}>{preset.label}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{preset.range}</div>
                        </div>
                        <span style={{ fontSize: "0.8rem", fontWeight: 500, color: active ? "var(--primary)" : "var(--subtext)", flexShrink: 0 }}>{preset.time}</span>
                        {active && <span style={{ color: "var(--primary)", fontSize: 16, marginLeft: 4 }}>{"\u2714"}</span>}
                      </button>
                    );
                  })}

                  {/* Throughout the day */}
                  {(() => {
                    const active = notifPreset === "AllDay";
                    return (
                      <button
                        onClick={() => {
                          setNotifPreset("AllDay");
                          setShowCustomTime(false);
                          localStorage.setItem("threely_notif_pref", JSON.stringify({ label: "AllDay", time: "8:00 AM \u2013 9:00 PM", hour: 8, minute: 0, endHour: 21, endMinute: 0 }));
                          sendConfirmNotif("8:00 AM \u2013 9:00 PM");
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "0.7rem 0.875rem", borderRadius: "var(--radius)",
                          border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary-light)" : "var(--card)",
                          cursor: "pointer", transition: "all 0.15s", textAlign: "left",
                        }}
                      >
                        <span style={{ fontSize: "1.25rem", width: 28, textAlign: "center", flexShrink: 0 }}>{"\uD83D\uDD14"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: active ? "var(--primary)" : "var(--text)" }}>Remind me throughout the day</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{"8:00 AM \u2013 9:00 PM"}</div>
                        </div>
                        {active && <span style={{ color: "var(--primary)", fontSize: 16, marginLeft: 4 }}>{"\u2714"}</span>}
                      </button>
                    );
                  })()}

                  {/* Custom time range */}
                  <button
                    onClick={() => setShowCustomTime(v => !v)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "0.7rem 0.875rem", borderRadius: "var(--radius)",
                      border: `1.5px solid ${notifPreset === "Custom" ? "var(--primary)" : "var(--border)"}`,
                      background: notifPreset === "Custom" ? "var(--primary-light)" : "var(--card)",
                      cursor: "pointer", transition: "all 0.15s", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "1.25rem", width: 28, textAlign: "center", flexShrink: 0 }}>{"\u2699\uFE0F"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: notifPreset === "Custom" ? "var(--primary)" : "var(--text)" }}>Custom time range</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Set your own start and end time</div>
                    </div>
                    <span style={{ fontSize: 14, color: "var(--subtext)", transform: showCustomTime ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>{"\u25BC"}</span>
                  </button>

                  {showCustomTime && (
                    <div style={{
                      padding: "0.875rem", borderRadius: "var(--radius)",
                      border: "1.5px solid var(--border)", background: "var(--bg)",
                      display: "flex", flexDirection: "column", gap: 12,
                    }}>
                      {/* Start time */}
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 6 }}>Start time</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <select value={customStartHour} onChange={e => setCustomStartHour(Number(e.target.value))}
                            style={{ padding: "0.45rem 0.6rem", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (<option key={h} value={h}>{h}</option>))}
                          </select>
                          <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>:</span>
                          <select value={customStartMinute} onChange={e => setCustomStartMinute(Number(e.target.value))}
                            style={{ padding: "0.45rem 0.6rem", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}>
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (<option key={m} value={m}>{String(m).padStart(2, "0")}</option>))}
                          </select>
                          <div style={{ display: "flex", gap: 0, borderRadius: "var(--radius)", overflow: "hidden", border: "1.5px solid var(--border)" }}>
                            {(["AM", "PM"] as const).map(p => (
                              <button key={p} onClick={() => setCustomStartAmPm(p)}
                                style={{ padding: "0.45rem 0.65rem", border: "none", cursor: "pointer", background: customStartAmPm === p ? "var(--primary)" : "var(--card)", color: customStartAmPm === p ? "#fff" : "var(--subtext)", fontSize: "0.8rem", fontWeight: 600 }}>
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* End time */}
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 6 }}>End time</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <select value={customEndHour} onChange={e => setCustomEndHour(Number(e.target.value))}
                            style={{ padding: "0.45rem 0.6rem", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (<option key={h} value={h}>{h}</option>))}
                          </select>
                          <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>:</span>
                          <select value={customEndMinute} onChange={e => setCustomEndMinute(Number(e.target.value))}
                            style={{ padding: "0.45rem 0.6rem", borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--text)", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}>
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (<option key={m} value={m}>{String(m).padStart(2, "0")}</option>))}
                          </select>
                          <div style={{ display: "flex", gap: 0, borderRadius: "var(--radius)", overflow: "hidden", border: "1.5px solid var(--border)" }}>
                            {(["AM", "PM"] as const).map(p => (
                              <button key={p} onClick={() => setCustomEndAmPm(p)}
                                style={{ padding: "0.45rem 0.65rem", border: "none", cursor: "pointer", background: customEndAmPm === p ? "var(--primary)" : "var(--card)", color: customEndAmPm === p ? "#fff" : "var(--subtext)", fontSize: "0.8rem", fontWeight: 600 }}>
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const startH24 = customStartAmPm === "PM" ? (customStartHour === 12 ? 12 : customStartHour + 12) : (customStartHour === 12 ? 0 : customStartHour);
                          const endH24 = customEndAmPm === "PM" ? (customEndHour === 12 ? 12 : customEndHour + 12) : (customEndHour === 12 ? 0 : customEndHour);
                          const startStr = `${customStartHour}:${String(customStartMinute).padStart(2, "0")} ${customStartAmPm}`;
                          const endStr = `${customEndHour}:${String(customEndMinute).padStart(2, "0")} ${customEndAmPm}`;
                          const timeStr = `${startStr} \u2013 ${endStr}`;
                          setNotifPreset("Custom");
                          localStorage.setItem("threely_notif_pref", JSON.stringify({ label: "Custom", time: timeStr, hour: startH24, minute: customStartMinute, endHour: endH24, endMinute: customEndMinute }));
                          sendConfirmNotif(timeStr);
                        }}
                        style={{ fontSize: "0.825rem", width: "100%" }}
                      >
                        Set custom range
                      </button>
                    </div>
                  )}

                  <p style={{ fontSize: "0.72rem", color: "var(--muted)", margin: "4px 0 0", textAlign: "center" }}>
                    Notifications work when this tab is open in your browser.
                  </p>
                </div>
              )}
            </div>

            {/* Focus Goal */}
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                Today's Focus Goal
              </h3>
              {focusGoalName ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text)", fontWeight: 500 }}>
                    {focusGoalName}
                  </span>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      localStorage.removeItem(`threely_focus_${today}`);
                      setFocusGoalName(null);
                      router.push("/dashboard");
                    }}
                    style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                  >
                    Change focus
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: "0.825rem", color: "var(--subtext)", margin: 0 }}>
                  No focus goal set for today
                </p>
              )}
            </div>

            {/* Subscription */}
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
                    Subscription
                  </h3>
                  {subStatus === "trialing" && (
                    <span style={{
                      display: "inline-block", padding: "2px 10px", borderRadius: 999,
                      background: "#ecfdf5", color: "#059669", fontSize: "0.75rem", fontWeight: 600,
                    }}>Pro Trial</span>
                  )}
                  {subStatus === "active" && (
                    <span style={{
                      display: "inline-block", padding: "2px 10px", borderRadius: 999,
                      background: "var(--primary-light)", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600,
                    }}>Pro</span>
                  )}
                  {subStatus !== undefined && subStatus !== "trialing" && subStatus !== "active" && (
                    <span style={{
                      display: "inline-block", padding: "2px 10px", borderRadius: 999,
                      background: "#f3f4f6", color: "#6b7280", fontSize: "0.75rem", fontWeight: 600,
                    }}>No plan</span>
                  )}
                  {subStatus === "trialing" && subTrialEnd && (
                    <span style={{ fontSize: "0.78rem", color: "var(--subtext)" }}>
                      · Trial ends {new Date(subTrialEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    if (hasPro) {
                      window.open("/api/subscription?action=portal", "_blank");
                    } else {
                      showPaywall();
                    }
                  }}
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                >
                  {hasPro ? "Manage subscription" : "Upgrade to Pro"}
                </button>
              </div>
            </div>

            {/* Change password */}
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                {isOAuthUser ? "Set a password" : "Change password"}
              </h3>
              {!showChangePassword ? (
                <div>
                  <p style={{ fontSize: "0.825rem", color: "var(--subtext)", marginBottom: 12 }}>
                    {isOAuthUser
                      ? `You signed in with ${providerName}. Set a password to also sign in with email.`
                      : "Update the password you use to sign in."}
                  </p>
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowChangePassword(true)}
                    style={{ fontSize: "0.825rem" }}
                  >
                    {isOAuthUser ? "Set password" : "Change password"}
                  </button>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setPwError("");
                  if (!isOAuthUser && !currentPw.trim()) { setPwError("Enter your current password."); return; }
                  if (newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }
                  if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
                  setPwLoading(true);
                  try {
                    const supabase = getSupabase();
                    // Only verify current password for email users
                    if (!isOAuthUser) {
                      const { error: signInErr } = await supabase.auth.signInWithPassword({
                        email: user?.email ?? "",
                        password: currentPw,
                      });
                      if (signInErr) { setPwError("Current password is incorrect."); setPwLoading(false); return; }
                    }
                    // Update/set password
                    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
                    if (updateErr) { setPwError(updateErr.message); setPwLoading(false); return; }
                    setPwSuccess(true);
                    setCurrentPw(""); setNewPw(""); setConfirmPw("");
                    setTimeout(() => { setPwSuccess(false); setShowChangePassword(false); }, 2000);
                  } catch {
                    setPwError("Something went wrong. Please try again.");
                  } finally {
                    setPwLoading(false);
                  }
                }} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: 8 }}>
                  {!isOAuthUser && (
                    <div>
                      <label className="field-label">Current password</label>
                      <input
                        className="field-input"
                        type="password"
                        value={currentPw}
                        onChange={e => setCurrentPw(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  )}
                  <div>
                    <label className="field-label">New password</label>
                    <input
                      className="field-input"
                      type="password"
                      placeholder="Min. 8 characters"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div>
                    <label className="field-label">Confirm new password</label>
                    <input
                      className="field-input"
                      type="password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  {pwError && (
                    <div style={{
                      background: "var(--danger-light)", color: "var(--danger)",
                      padding: "0.5rem 0.75rem", borderRadius: "var(--radius)", fontSize: "0.825rem",
                    }}>{pwError}</div>
                  )}
                  {pwSuccess && (
                    <div style={{
                      background: "var(--success-light)", color: "var(--success)",
                      padding: "0.5rem 0.75rem", borderRadius: "var(--radius)", fontSize: "0.825rem",
                    }}>{isOAuthUser ? "Password set! You can now sign in with email too." : "Password updated successfully!"}</div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => { setShowChangePassword(false); setPwError(""); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}
                      style={{ fontSize: "0.825rem" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={pwLoading}
                      style={{ fontSize: "0.825rem" }}
                    >
                      {pwLoading ? "Updating..." : "Update password"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Sign out */}
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                Sign out
              </h3>
              <p style={{ fontSize: "0.825rem", color: "var(--subtext)", marginBottom: 12 }}>
                Sign out of your Threely account on this device.
              </p>
              <button
                className="btn btn-outline"
                onClick={async () => {
                  if (!window.confirm("Are you sure you want to sign out?")) return;
                  await signOut();
                  router.replace("/login");
                }}
                style={{ fontSize: "0.825rem" }}
              >
                Sign out
              </button>
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
