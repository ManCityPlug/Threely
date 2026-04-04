import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer style={{
      background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.5)",
      padding: "3.5rem 1.5rem 2rem",
      fontSize: "0.825rem",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Top: Logo + columns */}
        <div className="footer-grid" style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
          gap: "2rem",
          marginBottom: "2.5rem",
        }}>
          {/* Brand column */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color: "#fff", fontWeight: 600 }}>Threely</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", lineHeight: 1.6, maxWidth: 260 }}>
              AI-powered goal coaching that generates 3 personalized daily tasks to help you reach any goal.
            </p>
          </div>

          {/* Product column */}
          <div>
            <h4 style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
              Product
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/how-it-works" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>How it works</Link>
              <Link href="/pricing" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Pricing</Link>
              <Link href="/faq" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>FAQ</Link>
            </div>
          </div>

          {/* Company column */}
          <div>
            <h4 style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
              Company
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/about" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>About</Link>
              <Link href="/terms" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Terms of Service</Link>
              <Link href="/privacy" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Privacy Policy</Link>
              <Link href="/refund" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Refund Policy</Link>
            </div>
          </div>

          {/* Get started column */}
          <div>
            <h4 style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
              Get Started
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/start" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Create account</Link>
              <Link href="/login" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.825rem", textDecoration: "none" }}>Sign in</Link>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.1)", marginBottom: "1.5rem" }} />

        {/* Bottom: Copyright */}
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" }}>
          &copy; {new Date().getFullYear()} Threely. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
