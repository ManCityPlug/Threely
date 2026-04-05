import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer style={{
      background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.5)",
      padding: "2.5rem 1.5rem 2rem",
      fontSize: "0.825rem",
    }}>
      <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        {/* Links */}
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center",
          gap: "0.5rem 1.5rem", marginBottom: "1.5rem",
        }}>
          <Link href="/pricing" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Pricing</Link>
          <Link href="/support" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Support</Link>
          <Link href="/terms" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Terms</Link>
          <Link href="/privacy" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Privacy</Link>
          <Link href="/refund" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Refund</Link>
          <Link href="/signup" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Sign up</Link>
          <Link href="/login" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Sign in</Link>
        </div>

        {/* Copyright */}
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.78rem", margin: 0 }}>
          &copy; {new Date().getFullYear()} Threely. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
