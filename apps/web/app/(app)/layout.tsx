"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth, isOnboarded, markOnboarded, getNickname } from "@/lib/auth-context";
import { profileApi, subscriptionApi, type SubscriptionStatus } from "@/lib/api-client";
import ToastProvider from "@/components/ToastProvider";
import { SubscriptionProvider, useSubscription } from "@/lib/subscription-context";
import PaywallModal from "@/components/PaywallModal";

const NAV_ICONS: Record<string, React.ReactNode> = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  goals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsTablet(isTabletDevice());
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Fast path: localStorage says onboarded
    if (isOnboarded(user.id)) return;

    // Slow path: check DB for existing profile
    setCheckingOnboarding(true);
    profileApi.get().then(({ profile }) => {
      if (profile) {
        // User already onboarded — restore localStorage flag
        markOnboarded(user.id);
      } else {
        // Truly new user
        router.replace("/onboarding");
      }
    }).catch(() => {
      // On error, redirect to onboarding as fallback
      router.replace("/onboarding");
    }).finally(() => {
      setCheckingOnboarding(false);
    });
  }, [user, loading, router]);

  // Fetch subscription status
  useEffect(() => {
    if (!user) return;
    subscriptionApi.status().then(res => setSubStatus(res.status)).catch(() => {});
  }, [user]);

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

  const nickname = getNickname() || user.email?.split("@")[0] || "You";
  const initials = nickname[0]?.toUpperCase() ?? "?";

  const subBadge = subStatus === "trialing"
    ? { label: "Pro Trial", bg: "#ecfdf5", color: "#059669" }
    : subStatus === "active"
    ? { label: "Pro", bg: "var(--primary-light)", color: "var(--primary)" }
    : subStatus !== undefined
    ? { label: "No plan", bg: "#f3f4f6", color: "#6b7280" }
    : null;

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <ToastProvider>
    <SubscriptionProvider>
    <PaywallGate />
    <div className={`app-shell${isTablet ? " force-mobile" : ""}`}>
      {/* ── Mobile top bar ──────────────────────────────────────────────────── */}
      <div className="mobile-topbar" ref={menuRef}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--primary)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, flexShrink: 0,
          }}>3</div>
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
              }}>{initials}</div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nickname}
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
        {/* Logo */}
        <div style={{
          padding: "1.5rem 1.25rem 1.25rem",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <img src="/favicon.png" alt="Threely" width={36} height={36} style={{ borderRadius: 10, flexShrink: 0 }} />
          <div>
            <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.02em", color: "var(--text)", display: "block" }}>
              Threely
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 500 }}>
              Do Less, Achieve More
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "1rem 0.75rem", flex: 1 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.75rem" }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "var(--primary-light)", color: "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: "0.9rem", flexShrink: 0,
            }}>{initials}</div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {nickname}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </div>
            </div>
          </div>
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
    </div>
    </SubscriptionProvider>
    </ToastProvider>
  );
}

function PaywallGate() {
  const { paywallOpen, closePaywall } = useSubscription();
  if (!paywallOpen) return null;
  return <PaywallModal onClose={closePaywall} />;
}
