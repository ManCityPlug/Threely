"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const SIDEBAR_ITEMS = [
  { label: "Overview", href: "/admin", icon: "\u{1F4CA}" },
  { label: "Users", href: "/admin/users", icon: "\u{1F465}" },
  { label: "Costs", href: "/admin/costs", icon: "\u{1F4B0}" },
  { label: "LLM Training", href: "/admin/llm-training", icon: "\u{1F9E0}" },
  { label: "Notifications", href: "/admin/notifications", icon: "\u{1F514}" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setAuthenticated(false);
      return;
    }
    fetch("/api/admin/session")
      .then((r) => {
        if (!r.ok) {
          router.replace("/admin/login");
          setAuthenticated(false);
        } else {
          setAuthenticated(true);
        }
      })
      .catch(() => {
        router.replace("/admin/login");
        setAuthenticated(false);
      });
  }, [pathname, router]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  };

  // Login page — no sidebar
  if (pathname === "/admin/login") {
    return (
      <div
        data-theme="dark"
        style={{
          minHeight: "100vh",
          background: "#141414",
          color: "#e4e4e7",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {children}
      </div>
    );
  }

  if (authenticated === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#141414",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#71717a",
        }}
      >
        Loading...
      </div>
    );
  }

  const navLinks = SIDEBAR_ITEMS.map((item) => {
    const isActive =
      item.href === "/admin"
        ? pathname === "/admin"
        : pathname.startsWith(item.href);
    return { ...item, isActive };
  });

  return (
    <div
      data-theme="dark"
      style={{
        minHeight: "100vh",
        background: "#141414",
        color: "#e4e4e7",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
      }}
    >
      {/* Hide Crisp chat on admin pages */}
      <style dangerouslySetInnerHTML={{ __html: `
        #crisp-chatbox { display: none !important; }
      `}} />
      <style dangerouslySetInnerHTML={{ __html: `
        .admin-sidebar { display: flex; }
        .admin-mobile-topbar { display: none; }
        .admin-mobile-spacer { display: none; }
        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
          .admin-mobile-topbar { display: flex !important; }
          .admin-mobile-spacer { display: block !important; height: 52px; }
          .admin-main { padding: 1rem !important; }
        }
      `}} />

      {/* Mobile top bar */}
      <div
        className="admin-mobile-topbar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "#111111",
          borderBottom: "1px solid #1e1e1e",
          padding: "0.75rem 1rem",
          display: "none",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "1rem", color: "#fff" }}>
          Threely Admin
        </span>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
          aria-label="Menu"
        >
          {menuOpen ? (
            <span style={{ fontSize: 20, color: "#e4e4e7", lineHeight: 1 }}>{"\u2715"}</span>
          ) : (
            <>
              <span style={{ width: 20, height: 2, background: "#e4e4e7", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "#e4e4e7", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "#e4e4e7", borderRadius: 1, display: "block" }} />
            </>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99,
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 260,
              background: "#111111",
              borderRight: "1px solid #1e1e1e",
              padding: "1.5rem 0",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: "1px solid #1e1e1e", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#fff" }}>
                Threely Admin
              </span>
            </div>
            <nav style={{ flex: 1 }}>
              {navLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0.75rem 1.25rem",
                    fontSize: "0.95rem",
                    fontWeight: item.isActive ? 600 : 400,
                    color: item.isActive ? "#fff" : "#a1a1aa",
                    background: item.isActive ? "#1e1e1e" : "transparent",
                    textDecoration: "none",
                    borderLeft: item.isActive ? "3px solid #D4A843" : "3px solid transparent",
                  }}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              style={{
                margin: "0 1.25rem",
                padding: "0.6rem 0",
                background: "none",
                border: "1px solid #1e1e1e",
                borderRadius: 8,
                color: "#a1a1aa",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="admin-sidebar"
        style={{
          width: 220,
          background: "#111111",
          borderRight: "1px solid #1e1e1e",
          padding: "1.5rem 0",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div
          style={{
            padding: "0 1.25rem 1.5rem",
            borderBottom: "1px solid #1e1e1e",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#fff" }}>
            Threely Admin
          </span>
        </div>

        <nav style={{ flex: 1 }}>
          {navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.6rem 1.25rem",
                fontSize: "0.9rem",
                fontWeight: item.isActive ? 600 : 400,
                color: item.isActive ? "#fff" : "#a1a1aa",
                background: item.isActive ? "#1e1e1e" : "transparent",
                textDecoration: "none",
                borderLeft: item.isActive
                  ? "3px solid #D4A843"
                  : "3px solid transparent",
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          style={{
            margin: "0 1.25rem",
            padding: "0.5rem 0",
            background: "none",
            border: "1px solid #1e1e1e",
            borderRadius: 8,
            color: "#a1a1aa",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </aside>

      {/* Main content */}
      <main className="admin-main" style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        <div className="admin-mobile-spacer" />
        {children}
      </main>
    </div>
  );
}
