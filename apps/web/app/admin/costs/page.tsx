"use client";

// Threely has zero recurring per-user AI cost right now: tasks, goal roadmaps,
// and onboarding flow all come from the pre-written @threely/tasks library,
// and apps/web/lib/claude.ts is a pass-through stub (no DeepSeek / Gemini /
// OpenAI calls at runtime). Revenue ≈ profit minus Apple commission + Stripe
// fees. This page is kept as a placeholder so we have somewhere to report
// per-user spend when we add paid generation (e.g. AI-generated ad images
// or UGC for dropshipping-style features).

const cardStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
  padding: "1.5rem",
  marginBottom: "1rem",
};

const bulletRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "10px 12px",
  background: "#1e1e21",
  borderRadius: 8,
};

const bulletDot = (color: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: 4,
  background: color,
  marginTop: 6,
  flexShrink: 0,
});

export default function CostsPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>
        Costs
      </h1>
      <p style={{ color: "#71717a", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
        Per-user spend tracking. Nothing to report until paid generation ships.
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>
          Current state
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={bulletRow}>
            <div style={bulletDot("#4ade80")} />
            <div>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>No recurring AI cost per user. </span>
              <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                Daily tasks, goal paths, and roadmap milestones are served from the
                <code style={{ fontFamily: "monospace", fontSize: "0.78rem" }}> @threely/tasks </code>
                library. <code style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>apps/web/lib/claude.ts</code> is stubbed — zero
                DeepSeek / Gemini / OpenAI traffic in prod.
              </span>
            </div>
          </div>
          <div style={bulletRow}>
            <div style={bulletDot("#4ade80")} />
            <div>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Effective per-user cost ≈ $0. </span>
              <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                Revenue → profit minus Apple commission (15% on iOS IAP via Small
                Business Program) and Stripe processing fees on web subs. No token
                spend to net out.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>
          When this page will come back to life
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={bulletRow}>
            <div style={bulletDot("#fbbf24")} />
            <div>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>AI-generated ad images / UGC for DFY goals. </span>
              <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                When a DFY (done-for-you) flow generates ad creative via an image
                or video model (e.g. GPT-image-1, Sora, Runway), we&apos;ll track cost
                per call here and break it down per user + per goal.
              </span>
            </div>
          </div>
          <div style={bulletRow}>
            <div style={bulletDot("#71717a")} />
            <div>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Anything else that becomes metered. </span>
              <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                If we ever add runtime LLM calls back in (e.g. per-user coaching,
                free-text input), surface the per-call rate here alongside the
                margin impact.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
