"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth, markOnboarded, getNickname, saveNickname } from "@/lib/auth-context";
import { subscriptionApi, notificationsApi, type SubscriptionStatus, type AppNotification } from "@/lib/api-client";
import ToastProvider from "@/components/ToastProvider";
import { SubscriptionProvider } from "@/lib/subscription-context";


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [, setSubStatus] = useState<SubscriptionStatus["status"]>(undefined as unknown as SubscriptionStatus["status"]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Light theme — Launch hub uses a clean white surface.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
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
    markOnboarded(user.id);
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    subscriptionApi.status().then(res => setSubStatus(res.status)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!getNickname() && user.user_metadata?.display_name) {
      saveNickname(user.user_metadata.display_name as string);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      notificationsApi.list().then(res => setNotifications(res.notifications)).catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [user]);

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

  if (loading || !user) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#ffffff",
      }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  const settingsActive = pathname === "/profile";

  return (
    <ToastProvider>
    <SubscriptionProvider>
    <div className="app-shell">
      {/* ── Top header bar ──────────────────────────────────────────────── */}
      <header className="top-bar">
        <div className="top-bar-inner">
          <Link href="/launch" className="top-bar-brand">
            <span className="top-bar-brand-mark">Threely</span>
          </Link>

          <div className="top-bar-actions">
            {/* Notifications */}
            <button
              onClick={() => setNotifOpen(o => !o)}
              className={`top-bar-icon-btn${notifOpen ? " active" : ""}`}
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifications.length > 0 && (
                <span className="top-bar-icon-badge">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>

            {/* Settings */}
            <Link
              href="/profile"
              className={`top-bar-icon-btn${settingsActive ? " active" : ""}`}
              aria-label="Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

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
