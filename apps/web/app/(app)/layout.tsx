"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth, isOnboarded, markOnboarded, getNickname, saveNickname } from "@/lib/auth-context";
import { profileApi, goalsApi, subscriptionApi, notificationsApi, type SubscriptionStatus, type AppNotification } from "@/lib/api-client";
import { formatDisplayName } from "@/lib/format-name";
import ToastProvider from "@/components/ToastProvider";
import { SubscriptionProvider } from "@/lib/subscription-context";
import AppTutorial from "@/components/AppTutorial";

const NAV_ICONS: Record<string, React.ReactNode> = {
  today: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#F59E0B" stroke="#F59E0B" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  ),
  goals: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#FEE2E2" stroke="#EF4444" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="6" fill="#FECACA" stroke="#EF4444" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="2.5" fill="#EF4444" />
      <line x1="18" y1="3" x2="13.5" y2="10" stroke="#F97316" strokeWidth={2} strokeLinecap="round" />
      <polygon points="19,1 20.5,4.5 17,3.5" fill="#F97316" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="#635BFF" strokeWidth={2} fill="#EDE9FE" />
      <path d="M5 20.5c0-3.5 3.134-6.5 7-6.5s7 3 7 6.5" stroke="#635BFF" strokeWidth={2} strokeLinecap="round" fill="#EDE9FE" />
    </svg>
  ),
};

const NAV = [
  { href: "/dashboard", label: "Today", iconKey: "today" },
  { href: "/goals", label: "Goals", iconKey: "goals" },
  { href: "/profile", label: "Profile", iconKey: "profile" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus["status"]>(undefined as unknown as SubscriptionStatus["status"]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Force dark theme in the app — entire app is designed for dark mode
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";
    return () => {
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.style.colorScheme = "";
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // If you have an account, you never go to /onboarding.
    // Goal creation happens via /start (pre-signup) for new users.
    // Existing users with no goals see the dashboard empty state.
    markOnboarded(user.id);
  }, [user, loading, router]);

  // Fetch subscription status
  useEffect(() => {
    if (!user) return;
    subscriptionApi.status().then(res => setSubStatus(res.status)).catch(() => {});
  }, [user]);

  // Sync display name from Supabase metadata to localStorage
  useEffect(() => {
    if (!user) return;
    if (!getNickname() && user.user_metadata?.display_name) {
      saveNickname(user.user_metadata.display_name as string);
    }
  }, [user]);

  // Show tutorial after onboarding or when requested from profile
  useEffect(() => {
    // Manual restart from profile — check immediately, skip all guards
    let requestedFromProfile = false;
    try { requestedFromProfile = localStorage.getItem("threely_start_tutorial") === "true"; } catch {}
    if (requestedFromProfile) {
      try { localStorage.removeItem("threely_start_tutorial"); } catch {}
      const timer = setTimeout(() => setShowTutorial(true), 800);
      return () => clearTimeout(timer);
    }

    // Onboarding flow — needs user to be loaded and onboarded
    if (!user || loading || checkingOnboarding) return;
    if (!isOnboarded(user.id)) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("welcome")) return;
    const tutorialKey = `threely_tutorial_done_${user.id}`;
    try { if (localStorage.getItem(tutorialKey)) return; } catch {}
    const timer = setTimeout(() => setShowTutorial(true), 600);
    return () => clearTimeout(timer);
  }, [user, loading, checkingOnboarding]);

  function handleTutorialComplete() {
    if (user) {
      try { localStorage.setItem(`threely_tutorial_done_${user.id}`, "true"); } catch { /* ignore */ }
    }
    setShowTutorial(false);
    // Navigate to Today tab after tutorial
    router.replace("/dashboard");
  }

  // Fetch notifications
  useEffect(() => {
    if (!user) return;
    const load = () => {
      notificationsApi.list().then(res => setNotifications(res.notifications)).catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Close notif dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  async function handleDismissNotification(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
    notificationsApi.dismiss(id).catch(() => {});
  }

  if (loading || !user || checkingOnboarding) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <ToastProvider>
    <SubscriptionProvider>
    <AppTutorial visible={showTutorial} onComplete={handleTutorialComplete} />
    <div className="app-shell">
      {/* ── Top navigation bar ──────────────────────────────────────────────── */}
      <nav className="top-nav">
        <div className="top-nav-inner">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`top-nav-item${active ? " active" : ""}`}
              >
                <span className="top-nav-icon">
                  {NAV_ICONS[item.iconKey]}
                </span>
                <span className="top-nav-label">{item.label}</span>
              </Link>
            );
          })}

          {/* Notification bell — far right */}
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="top-nav-bell"
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && (
              <span style={{
                position: "absolute", top: -2, right: -2,
                minWidth: 16, height: 16, borderRadius: "50%",
                background: "#ef4444", color: "#fff",
                fontSize: "0.6rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px",
              }}>
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="main-content">
        {children}
      </main>

      {/* ── Notification Center Modal ──────────────────────────────────────────── */}
      {notifOpen && (
        <div
          ref={notifRef}
          className="modal-overlay"
          onClick={() => setNotifOpen(false)}
          style={{ zIndex: 300 }}
        >
          <div
            className="modal-box"
            style={{ maxWidth: 420, width: "100%", padding: 0, overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                  Notifications
                </span>
                {notifications.length > 0 && (
                  <span style={{
                    background: "#ef4444", color: "#fff",
                    fontSize: "0.65rem", fontWeight: 700,
                    padding: "1px 7px", borderRadius: 10,
                  }}>
                    {notifications.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setNotifOpen(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "1.2rem", color: "var(--muted)", lineHeight: 1,
                  width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%",
                }}
                aria-label="Close"
              >
                {"\u2715"}
              </button>
            </div>

            {/* Content */}
            <div style={{ maxHeight: 400, overflowY: "auto", padding: "0.75rem" }}>
              {notifications.length === 0 ? (
                <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                  <div style={{ color: "var(--muted)", fontSize: "0.9rem", fontWeight: 600 }}>
                    No new notifications
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: 4, opacity: 0.6 }}>
                    You&apos;re all caught up
                  </div>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} style={{
                    padding: "1rem 1.15rem",
                    marginBottom: "0.5rem",
                    background: "var(--bg-elevated, #f9fafb)",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: "var(--primary-light)", color: "var(--primary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, marginTop: 1,
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)", marginBottom: 2, lineHeight: 1.3 }}>
                          {n.heading}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--subtext)", lineHeight: 1.5 }}>
                          {n.subheading}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", paddingLeft: 42 }}>
                      {n.linkUrl && (
                        <a
                          href={n.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary"
                          style={{
                            fontSize: "0.75rem", padding: "6px 16px",
                            textDecoration: "none", display: "inline-block",
                            borderRadius: 8, fontWeight: 600,
                          }}
                        >
                          Open Link
                        </a>
                      )}
                      <button
                        onClick={() => handleDismissNotification(n.id)}
                        className="btn btn-outline"
                        style={{ fontSize: "0.75rem", padding: "6px 16px", borderRadius: 8 }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </SubscriptionProvider>
    </ToastProvider>
  );
}
