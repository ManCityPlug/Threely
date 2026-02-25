"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

const MOBILE_LINKS = [
  ...NAV_LINKS,
  { href: "/about", label: "About" },
];

export default function MarketingNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #e3e8ef",
        padding: "0 2rem",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Left: Logo + page links */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "linear-gradient(145deg, #7c74ff 0%, #635bff 50%, #5144e8 100%)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700,
              boxShadow: "0 4px 12px rgba(99,91,255,0.25), inset 0 1px 1px rgba(255,255,255,0.2)",
              textShadow: "0 1px 2px rgba(0,0,0,0.12)",
            }}>3</div>
            <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.02em", color: "#0a2540" }}>Threely</span>
          </Link>

          {/* Desktop nav links */}
          <div className="marketing-nav-links" style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
        </div>

        {/* Right: Auth + hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/login" className="marketing-nav-links" style={{
            padding: "0.4rem 0.875rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#425466",
            borderRadius: 8,
            textDecoration: "none",
          }}>
            Sign in
          </Link>
          <Link href="/register" className="marketing-nav-links" style={{
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
          {/* Mobile hamburger */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            style={{
              display: "none",
              width: 38, height: 38,
              alignItems: "center", justifyContent: "center",
              borderRadius: 8, background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a2540" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              ) : (
                <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div style={{
          position: "fixed", top: 60, left: 0, right: 0, zIndex: 99,
          background: "#fff",
          borderBottom: "1px solid #e3e8ef",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          padding: "0.75rem 1.5rem 1rem",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {MOBILE_LINKS.map(link => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{
              padding: "0.6rem 0.75rem",
              fontSize: "0.95rem",
              fontWeight: pathname === link.href ? 700 : 500,
              color: pathname === link.href ? "#635bff" : "#0a2540",
              borderRadius: 8,
              textDecoration: "none",
            }}>
              {link.label}
            </Link>
          ))}
          <div style={{ height: 1, background: "#e3e8ef", margin: "4px 0" }} />
          <Link href="/login" onClick={() => setMenuOpen(false)} style={{
            padding: "0.6rem 0.75rem",
            fontSize: "0.95rem",
            fontWeight: 500,
            color: "#425466",
            borderRadius: 8,
            textDecoration: "none",
          }}>
            Sign in
          </Link>
          <Link href="/register" onClick={() => setMenuOpen(false)} style={{
            padding: "0.65rem 0.75rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "#fff",
            background: "#635bff",
            borderRadius: 8,
            textAlign: "center",
            textDecoration: "none",
          }}>
            Get started
          </Link>
        </div>
      )}
    </>
  );
}
