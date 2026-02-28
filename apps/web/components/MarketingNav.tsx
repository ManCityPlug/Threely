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
];

export default function MarketingNav() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) setLoggedIn(true);
    });
  }, []);

  return (
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

        {/* Nav links */}
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
      </div>

      {/* Right: Auth buttons or dashboard link */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {loggedIn ? (
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
        ) : (
          <>
            <Link href="/login" style={{
              padding: "0.4rem 0.875rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#425466",
              borderRadius: 8,
              textDecoration: "none",
            }}>
              Sign in
            </Link>
            <Link href="/register" style={{
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
      </div>
    </nav>
  );
}
