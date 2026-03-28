import Link from "next/link";

const BULLETS = [
  "Finally become the person you keep saying you'll be.",
  "Achieve your goals.",
  "10x your productivity.",
];

export default function StartPage() {
  return (
    <>
      <style>{`
        .start-landing {
          max-width: 440px;
          padding: 48px 24px 60px;
        }
        .start-landing .sparkle { font-size: 44px; margin-bottom: 16px; }
        .start-landing h1 { font-size: 2.25rem; margin: 0 0 16px; }
        .start-landing .subtitle { font-size: 1.05rem; margin: 0 0 36px; }
        .start-landing .bullet-icon { width: 24px; height: 24px; font-size: 13px; }
        .start-landing .bullet-text { font-size: 0.95rem; }
        .start-landing .cta { max-width: 340px; padding: 16px 0; font-size: 1.05rem; border-radius: 16px; }
        .start-landing .trust { font-size: 0.8rem; }
        .start-landing .stars { font-size: 16px; }
        .start-landing .social { font-size: 0.8rem; }
        .start-landing .bullets { gap: 12px; margin-bottom: 16px; }
        .start-landing .bullet-row { gap: 12px; margin-bottom: 16px; }

        @media (min-width: 768px) {
          .start-landing {
            max-width: 640px;
            padding: 20px 32px 32px;
          }
          .start-landing .sparkle { font-size: 48px; margin-bottom: 12px; }
          .start-landing h1 { font-size: 3.5rem; margin: 0 0 14px; }
          .start-landing .subtitle { font-size: 1.25rem; margin: 0 0 28px; max-width: 500px; }
          .start-landing .bullet-icon { width: 28px; height: 28px; font-size: 15px; }
          .start-landing .bullet-text { font-size: 1.1rem; }
          .start-landing .cta { max-width: 400px; padding: 18px 0; font-size: 1.15rem; border-radius: 18px; }
          .start-landing .trust { font-size: 0.88rem; margin-bottom: 28px !important; }
          .start-landing .stars { font-size: 18px; gap: 6px; }
          .start-landing .social { font-size: 0.88rem; }
          .start-landing .bullets { margin-bottom: 28px !important; }
          .start-landing .bullet-row { gap: 12px; margin-bottom: 14px; }
        }
      `}</style>
      <main
        className="start-landing"
        style={{
          margin: "0 auto",
          textAlign: "center",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Sparkle icon */}
        <div className="sparkle" style={{ color: "#A78BFA" }}>✦</div>

        {/* Headline */}
        <h1
          style={{
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.5px",
            lineHeight: 1.1,
          }}
        >
          Do Less.
          <br />
          Achieve More.
        </h1>

        {/* Subheadline */}
        <p
          className="subtitle"
          style={{
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.5,
            fontWeight: 400,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Achieve your goals and actually become the best
          version of yourself.
        </p>

        {/* Bullet points */}
        <div
          className="bullets"
          style={{
            display: "inline-flex",
            flexDirection: "column",
            margin: "0 auto 40px",
          }}
        >
          {BULLETS.map((b) => (
            <div
              key={b}
              className="bullet-row"
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                className="bullet-icon"
                style={{
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: "rgba(62,207,142,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3ecf8e",
                  fontWeight: 700,
                }}
              >
                ✓
              </span>
              <span
                className="bullet-text"
                style={{
                  color: "rgba(255,255,255,0.9)",
                  lineHeight: 1.45,
                  fontWeight: 500,
                  textAlign: "left",
                }}
              >
                {b}
              </span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Link
          href="/start/signup"
          className="cta"
          style={{
            display: "block",
            width: "100%",
            margin: "0 auto 16px",
            background: "#fff",
            color: "#635BFF",
            fontWeight: 700,
            letterSpacing: "-0.2px",
            textDecoration: "none",
            textAlign: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          }}
        >
          Start for Free
        </Link>

        {/* Trust line */}
        <p
          className="trust"
          style={{
            color: "rgba(255,255,255,0.5)",
            margin: "0 0 48px",
            fontWeight: 500,
          }}
        >
          $0.00 due today &middot; 7-day free trial &middot; Cancel anytime
        </p>

        {/* Social proof */}
        <div
          className="stars"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ color: "#F59E0B" }}>
              ★
            </span>
          ))}
        </div>
        <p
          className="social"
          style={{
            color: "rgba(255,255,255,0.5)",
            margin: 0,
            fontWeight: 500,
          }}
        >
          Join 2,000+ people transforming their lives
        </p>
      </main>
    </>
  );
}
