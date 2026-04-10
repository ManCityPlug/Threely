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

function isTabletDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Macintosh with touch support
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return true;
  // Android tablets don't have "Mobile" in UA
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;
  return false;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus["status"]>(undefined as unknown as SubscriptionStatus["status"]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsTablet(isTabletDevice());
  }, []);

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

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

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

  const nicknameRaw = getNickname() || (user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "You";
  const nickname = formatDisplayName(nicknameRaw);
  const initials = nickname[0]?.toUpperCase() ?? "?";

  const subBadge = subStatus === "trialing"
    ? { label: "Pro", bg: "rgba(5,150,105,0.15)", color: "#34d399" }
    : subStatus === "active"
    ? { label: "Pro", bg: "var(--primary-light)", color: "var(--primary)" }
    : subStatus !== undefined
    ? { label: "No plan", bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
    : null;

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <ToastProvider>
    <SubscriptionProvider>
    <AppTutorial visible={showTutorial} onComplete={handleTutorialComplete} />
    <div className={`app-shell${isTablet ? " force-mobile" : ""}`}>
      {/* ── Mobile top bar ──────────────────────────────────────────────────── */}
      <div className="mobile-topbar" ref={menuRef}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/favicon.png" alt="Threely" width={32} height={32} style={{ borderRadius: 8, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.02em", color: "var(--text)" }}>
            Threely
          </span>
        </div>
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 6, display: "flex", flexDirection: "column", gap: 4,
          }}
          aria-label="Menu"
        >
          {menuOpen ? (
            <span style={{ fontSize: 20, color: "var(--text)", lineHeight: 1 }}>&#x2715;</span>
          ) : (
            <>
              <span style={{ width: 20, height: 2, background: "var(--text)", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "var(--text)", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "var(--text)", borderRadius: 1, display: "block" }} />
            </>
          )}
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "var(--card)", borderBottom: "1px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            padding: "0.5rem 1rem",
            zIndex: 101,
          }}>
            {NAV.map(item => {
              const active = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "0.7rem 0.5rem",
                    borderBottom: "1px solid var(--border)",
                    color: active ? "var(--primary)" : "var(--text)",
                    fontWeight: active ? 600 : 500,
                    fontSize: "0.9rem",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: 16, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{NAV_ICONS[item.iconKey]}</span>
                  {item.label}
                </Link>
              );
            })}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "0.75rem 0.5rem 0.5rem",
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "var(--primary-light)", color: "var(--primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: "0.8rem", flexShrink: 0,
              }}>{user?.email?.[0]?.toUpperCase() ?? "?"}</div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.email ?? ""}
                </span>
                {subBadge && (
                  <span style={{
                    display: "inline-block",
                    padding: "1px 8px",
                    borderRadius: 999,
                    background: subBadge.bg,
                    color: subBadge.color,
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    marginTop: 2,
                  }}>
                    {subBadge.label}
                  </span>
                )}
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  fontSize: "0.8rem", fontWeight: 600, color: "var(--danger)",
                  background: "none", border: "none", cursor: "pointer",
                  padding: "0.3rem 0.5rem",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sidebar (desktop) ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Nav */}
        <nav style={{ padding: "1.5rem 0.75rem 1rem", flex: 1 }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-link${active ? " active" : ""}`}
              >
                <span className="nav-icon">
                  {NAV_ICONS[item.iconKey]}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + signout */}
        <div style={{
          padding: "1rem 1.25rem",
          borderTop: "1px solid var(--border)",
        }}>
          {subBadge && (
            <div style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: 999,
              background: subBadge.bg,
              color: subBadge.color,
              fontSize: "0.7rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}>
              {subBadge.label}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.75rem" }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "var(--primary-light)", color: "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: "0.9rem", flexShrink: 0,
            }}>{user?.email?.[0]?.toUpperCase() ?? "?"}</div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: "0.75rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </div>
            </div>
            {/* Notification bell */}
            <button
              onClick={() => setNotifOpen(o => !o)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 4, display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", borderRadius: 8, flexShrink: 0,
              }}
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--subtext)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <button
            onClick={handleSignOut}
            className="btn btn-outline"
            style={{ width: "100%", fontSize: "0.8rem", padding: "0.5rem", height: 34 }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="main-content">
        {children}
      </main>

      {/* ── Bottom nav (mobile) ──────────────────────────────────────────────── */}
      <nav className="bottom-nav">
        {NAV.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item${active ? " active" : ""}`}
            >
              <span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>{NAV_ICONS[item.iconKey]}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

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
