"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";

const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support" },
];

export default function MarketingNav() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) setLoggedIn(true);
    });

    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <>
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 1.25rem",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Left: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 28 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/favicon.png" alt="Threely" width={34} height={34} style={{ borderRadius: 9 }} />
            <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.02em", color: "#e8e8e8" }}>Threely</span>
          </Link>

          {/* Desktop nav links */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href} style={{
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: pathname === link.href ? "#635bff" : "#425466",
                  borderRadius: 6,
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right: Auth buttons (desktop) or Hamburger (mobile) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isMobile && loggedIn && (
            <Link href="/dashboard" style={{
              padding: "0.4rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#fff",
              background: "#635bff",
              borderRadius: 8,
              textDecoration: "none",
            }}>
              Go to dashboard
            </Link>
          )}
          {!isMobile && !loggedIn && (
            <>
              <Link href="/login" style={{
                padding: "0.4rem 0.875rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                borderRadius: 8,
                textDecoration: "none",
              }}>
                Sign in
              </Link>
              <Link href="/welcome" style={{
                padding: "0.4rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#fff",
                background: "#635bff",
                borderRadius: 8,
                textDecoration: "none",
              }}>
                Get started
              </Link>
            </>
          )}
          {isMobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 6, display: "flex", flexDirection: "column", gap: 4,
              }}
              aria-label="Menu"
            >
              <span style={{ width: 20, height: 2, background: "#0a2540", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "#0a2540", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "#0a2540", borderRadius: 1, display: "block" }} />
            </button>
          )}
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div style={{
          position: "sticky", top: 60, zIndex: 99,
          background: "#0a0a0a",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          padding: "0.75rem 1.5rem",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{
              padding: "0.6rem 0",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: pathname === link.href ? "#635bff" : "#0a2540",
              borderBottom: "1px solid #f0f0f0",
              textDecoration: "none",
              display: "block",
            }}>
              {link.label}
            </Link>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {loggedIn ? (
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} style={{
                flex: 1, textAlign: "center",
                padding: "0.6rem 0",
                fontSize: "0.875rem", fontWeight: 600,
                color: "#fff",
                background: "#635bff",
                borderRadius: 8,
                textDecoration: "none",
              }}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} style={{
                  flex: 1, textAlign: "center",
                  padding: "0.6rem 0",
                  fontSize: "0.875rem", fontWeight: 600,
                  color: "rgba(255,255,255,0.5)",
                  border: "1.5px solid #e3e8ef",
                  borderRadius: 8,
                  textDecoration: "none",
                }}>
                  Sign in
                </Link>
                <Link href="/welcome" onClick={() => setMenuOpen(false)} style={{
                  flex: 1, textAlign: "center",
                  padding: "0.6rem 0",
                  fontSize: "0.875rem", fontWeight: 600,
                  color: "#fff",
                  background: "#635bff",
                  borderRadius: 8,
                  textDecoration: "none",
                }}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
