import Link from "next/link";

const BULLETS = [
  "Become the person you want to be.",
  "Achieve your goals.",
  "10x your productivity.",
];

export default function StartPage() {
  return (
    <main style={{
      maxWidth: 480, margin: "0 auto", padding: "48px 24px 60px",
      textAlign: "center", flex: 1,
      display: "flex", flexDirection: "column", justifyContent: "center",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 20 }}>
        <img src="/favicon.png" alt="" width={48} height={48} style={{ borderRadius: 14 }} />
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: "2.25rem", fontWeight: 800, color: "#fff",
        letterSpacing: "-0.5px", lineHeight: 1.1, margin: "0 0 16px",
      }}>
        Do Less.<br />Achieve More.
      </h1>

      {/* Sub */}
      <p style={{
        color: "rgba(255,255,255,0.75)", fontSize: "1.05rem",
        lineHeight: 1.5, margin: "0 auto 36px", maxWidth: 360,
        fontWeight: 400,
      }}>
        Achieve your goals and actually become the best version of yourself.
      </p>

      {/* Bullets */}
      <div style={{
        display: "inline-flex", flexDirection: "column", gap: 12,
        margin: "0 auto 40px", textAlign: "left",
      }}>
        {BULLETS.map((b) => (
          <div key={b} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
              background: "rgba(62,207,142,0.2)", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "#3ecf8e", fontSize: 13, fontWeight: 700,
            }}>✓</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.95rem", fontWeight: 500, lineHeight: 1.45 }}>{b}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link href="/start/signup" style={{
        display: "block", width: "100%", maxWidth: 340, margin: "0 auto 16px",
        padding: "16px 0", background: "linear-gradient(135deg, #E8C547 0%, #D4A843 35%, #B8862D 70%, #A07428 100%)", color: "#000",
        fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.2px",
        textDecoration: "none", textAlign: "center", borderRadius: 16,
        boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
      }}>
        Start for Free
      </Link>

      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", margin: 0, fontWeight: 500 }}>
        $0.00 due today · 7-day free trial · Cancel anytime
      </p>
    </main>
  );
}
