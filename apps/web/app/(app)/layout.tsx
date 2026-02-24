"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth, isOnboarded, markOnboarded, getNickname } from "@/lib/auth-context";
import { profileApi } from "@/lib/api-client";
import ToastProvider from "@/components/ToastProvider";

const NAV = [
  { href: "/dashboard", label: "Today", icon: "✓" },
  { href: "/goals", label: "Goals", icon: "⚑" },
  { href: "/profile", label: "Profile", icon: "◉" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

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

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <ToastProvider>
    <div className="app-shell">
      {/* ── Sidebar (desktop) ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{
          padding: "1.5rem 1.25rem 1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--primary)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, flexShrink: 0,
          }}>3</div>
          <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.02em", color: "var(--text)" }}>
            Threely
          </span>
        </div>

        {/* Nav */}
        <nav style={{ padding: "1rem 0.75rem", flex: 1 }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "0.6rem 0.75rem",
                  borderRadius: "var(--radius)",
                  marginBottom: 2,
                  color: active ? "var(--primary)" : "var(--subtext)",
                  background: active ? "var(--primary-light)" : "transparent",
                  fontWeight: active ? 600 : 500,
                  fontSize: "0.9rem",
                  transition: "all 0.15s",
                  textDecoration: "none",
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: active ? "var(--primary)" : "var(--border)",
                  color: active ? "#fff" : "var(--subtext)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, flexShrink: 0,
                }}>
                  {item.icon}
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
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
    </ToastProvider>
  );
}
