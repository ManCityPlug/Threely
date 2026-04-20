"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
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
        // Pure black — matches theme-color meta so Safari's status bar
        // area above the nav is the same color, forming one unified
        // black band across the top. Body stays #141414 so the rest of
        // the page reads as its normal dark grey.
        position: "sticky", top: 0, zIndex: 100,
        background: "#000000",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 1.5rem",
        height: 64,
        display: "flex", alignItems: "center", justifyContent: "center",
        maxWidth: 1200, margin: "0 auto", width: "100%",
      }}>
        {/* Left: Logo */}
        <div style={{ position: "absolute", left: "1.5rem", display: "flex", alignItems: "center" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.02em", color: "#e8e8e8" }}>Threely</span>
          </Link>
        </div>

          {/* Desktop nav links — centered */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href} style={{
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: pathname === link.href ? "#D4A843" : "rgba(255,255,255,0.6)",
                  borderRadius: 6,
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}

        {/* Right: Auth buttons (desktop) or Hamburger (mobile) */}
        <div style={{ position: "absolute", right: "1.5rem", display: "flex", alignItems: "center", gap: 6 }}>
          {!isMobile && loggedIn && (
            <Link href="/dashboard" style={{
              padding: "0.4rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#000",
              background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)",
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
                Log In
              </Link>
              <Link href="/start" style={{
                padding: "0.5rem 1.25rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#000",
                background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)",
                borderRadius: 8,
                textDecoration: "none",
              }}>
                Start Free →
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
              <span style={{ width: 20, height: 2, background: "#fff", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "#fff", borderRadius: 1, display: "block" }} />
              <span style={{ width: 20, height: 2, background: "#fff", borderRadius: 1, display: "block" }} />
            </button>
          )}
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div style={{
          position: "sticky", top: 60, zIndex: 99,
          background: "#141414",
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
              color: pathname === link.href ? "#D4A843" : "rgba(255,255,255,0.8)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
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
                color: "#000",
                background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)",
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
                <Link href="/start" onClick={() => setMenuOpen(false)} style={{
                  flex: 1, textAlign: "center",
                  padding: "0.6rem 0",
                  fontSize: "0.875rem", fontWeight: 600,
                  color: "#000",
                  background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)",
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
