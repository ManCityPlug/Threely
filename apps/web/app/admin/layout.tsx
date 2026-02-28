"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const SIDEBAR_ITEMS = [
  { label: "Overview", href: "/admin", icon: "📊" },
  { label: "Users", href: "/admin/users", icon: "👥" },
  { label: "Costs", href: "/admin/costs", icon: "💰" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

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
          background: "#0f1117",
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
          background: "#0f1117",
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

  return (
    <div
      data-theme="dark"
      style={{
        minHeight: "100vh",
        background: "#0f1117",
        color: "#e4e4e7",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: "#18181b",
          borderRight: "1px solid #27272a",
          padding: "1.5rem 0",
          display: "flex",
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
            borderBottom: "1px solid #27272a",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#fff" }}>
            Threely Admin
          </span>
        </div>

        <nav style={{ flex: 1 }}>
          {SIDEBAR_ITEMS.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.9rem",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#fff" : "#a1a1aa",
                  background: isActive ? "#27272a" : "transparent",
                  textDecoration: "none",
                  borderLeft: isActive
                    ? "3px solid #635bff"
                    : "3px solid transparent",
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          style={{
            margin: "0 1.25rem",
            padding: "0.5rem 0",
            background: "none",
            border: "1px solid #27272a",
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
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
