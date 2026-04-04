import Link from "next/link";

export default function StartPage() {
  return (
    <main style={{
      maxWidth: 480, margin: "0 auto", padding: "48px 24px 60px",
      textAlign: "center", flex: 1,
      display: "flex", flexDirection: "column", justifyContent: "center",
    }}>
      {/* Pill badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: "0.35rem 1rem", borderRadius: 100,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        margin: "0 auto 28px", fontSize: "0.75rem", fontWeight: 600,
        color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}>
        The Fastest Path To Success
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: "2.5rem", fontWeight: 800, color: "#fff",
        letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 16px",
      }}>
        Do Less.<br />Achieve More.
      </h1>

      {/* Sub */}
      <p style={{
        color: "rgba(255,255,255,0.55)", fontSize: "1.05rem",
        lineHeight: 1.5, margin: "0 auto 36px", maxWidth: 360,
      }}>
        Your AI coach for fitness and business. Know exactly what to do — every single day.
      </p>

      {/* Bullets */}
      <div style={{
        display: "inline-flex", flexDirection: "column", gap: 14,
        margin: "0 auto 36px", textAlign: "left",
      }}>
        {[
          "Personalized daily tasks built around your goal",
          "Adapts based on your progress and feedback",
          "7-day free trial — $0 due today",
        ].map((b) => (
          <div key={b} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
              background: "rgba(99,91,255,0.15)", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "#635bff", fontSize: 12, fontWeight: 700,
            }}>✓</span>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.95rem", fontWeight: 500 }}>{b}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link href="/start/signup" style={{
        display: "block", width: "100%", maxWidth: 360, margin: "0 auto 16px",
        padding: "16px 0", background: "#635bff", color: "#fff",
        fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.01em",
        textDecoration: "none", textAlign: "center", borderRadius: 14,
        boxShadow: "0 0 30px rgba(99,91,255,0.25)",
      }}>
        Start Free →
      </Link>

      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem", margin: 0, fontWeight: 500 }}>
        Cancel anytime · No commitment
      </p>
    </main>
  );
}
