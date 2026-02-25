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
          {/* App store buttons with NEW badge */}
          <div style={{ height: 1, background: "#e3e8ef", margin: "6px 0" }} />
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <Link href="/" onClick={() => setMenuOpen(false)} style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "14px 28px 14px 18px",
              background: "#0a2540",
              color: "#fff",
              borderRadius: 12,
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "none",
              position: "relative",
              border: "1.5px solid rgba(99,91,255,0.15)",
            }}>
              <span className="new-badge" style={{ position: "absolute", top: -7, right: -6 }}>New</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Download on the</span>
                <span>App Store</span>
              </span>
            </Link>
            <Link href="/" onClick={() => setMenuOpen(false)} style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "14px 28px 14px 18px",
              background: "#0a2540",
              color: "#fff",
              borderRadius: 12,
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "none",
              position: "relative",
              border: "1.5px solid rgba(99,91,255,0.15)",
            }}>
              <span className="new-badge" style={{ position: "absolute", top: -7, right: -6 }}>New</span>
              <svg width="20" height="22" viewBox="0 0 17 20" fill="currentColor"><path d="M.517 1.206A1.4 1.4 0 0 0 0 2.275v15.45a1.4 1.4 0 0 0 .517 1.069l.056.05 8.662-8.663v-.204L.573 1.156l-.056.05z"/><path d="M12.122 13.068l-2.887-2.887v-.204l2.887-2.887.065.037 3.42 1.943c.977.555.977 1.463 0 2.018l-3.42 1.943-.065.037z"/><path d="M12.187 13.031L9.235 10.08.517 18.794c.322.34.856.382 1.456.043l10.214-5.806"/><path d="M12.187 7.127L1.973 1.322C1.373.982.84 1.024.517 1.365L9.235 10.08l2.952-2.952z"/></svg>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Get it on</span>
                <span>Google Play</span>
              </span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
