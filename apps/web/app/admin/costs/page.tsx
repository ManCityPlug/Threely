"use client";

// ─── Model Pricing (per million tokens) ──────────────────────────────────────
// DeepSeek pricing: https://api-docs.deepseek.com/quick_start/pricing
// Gemini pricing:   https://ai.google.dev/gemini-api/docs/pricing
// Verified 2026-04-19 against official docs. Earlier values were ~6 months
// stale — DeepSeek had dropped output prices and Gemini 2.5 Flash raised them.
const PRICING = {
  deepseek: { input: 0.28, output: 0.42, label: "DeepSeek V3.2 (primary)" },
  gemini:   { input: 0.10, output: 0.40, label: "Gemini 2.5 Flash-Lite (fallback)" },
};

// ─── Per-function cost estimates ─────────────────────────────────────────────
// Current product AI surface (mobile). Token counts are real averages from
// AICallLog (deepseek-chat only); where we have no data yet we use a
// conservative estimate flagged as such.
//
// Goal creation is a 3-question funnel → parseGoal → generateRoadmap (async).
// Daily flow → generateTasks (up to 3x/24h: initial + "Give me more" +
// work-ahead). Weekly summary runs once per user per week.
//
// Removed from this estimator (not part of the current mobile product):
//   - goalChat       (legacy multi-turn onboarding chat)
//   - refineTask     (per-task refine)
//   - askAboutTask   (task Q&A)
const FUNCTIONS = [
  {
    name: "parseGoal",
    model: "deepseek" as const,
    inputTokens: 812,
    outputTokens: 185,
    source: "measured",
    frequency: "Once per goal (3-question funnel)",
    description: "Extracts structure, category, deadline from the 3 funnel answers.",
  },
  {
    name: "generateRoadmap",
    model: "deepseek" as const,
    inputTokens: 716,
    outputTokens: 1305,
    source: "measured",
    frequency: "Once per goal (async after create)",
    description: "Multi-phase roadmap with milestones. Runs async so goal creation isn't blocked.",
  },
  {
    name: "generateTasks",
    model: "deepseek" as const,
    inputTokens: 2765,
    outputTokens: 447,
    source: "measured",
    frequency: "Up to 3x per goal per 24h",
    description: "Generates 3 short daily tasks (under 2 min each, 1-2 sentences). Up to 3 calls per goal per 24h: initial daily + 1 \"Give me more\" + 1 work-ahead (Day N+1).",
  },
  {
    name: "generateWeeklySummary",
    model: "deepseek" as const,
    inputTokens: 1500,
    outputTokens: 200,
    source: "estimate",
    frequency: "1x per user per week",
    description: "Weekly progress summary with trends and a short recommendation.",
  },
];

function costPerCall(fn: typeof FUNCTIONS[number]): number {
  const p = PRICING[fn.model];
  return (fn.inputTokens * p.input + fn.outputTokens * p.output) / 1_000_000;
}

// ─── Limits ─────────────────────────────────────────────────────────────────
const MAX_GOALS = 3;
// Worst-case generateTasks calls per goal within any 24h window:
//   1. Initial daily generation (auto)
//   2. One "Give me more" extra today
//   3. One work-ahead (Day N+1) — user finished today early and tapped the
//      next-day node to pull tomorrow's tasks forward
// Each call hits /api/tasks/generate with the same token envelope.
const MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY = 3;

// ─── Per-user daily/weekly/monthly cost calculator ───────────────────────────
// Map functions by name so refactors don't break array-index math.
const FN = Object.fromEntries(FUNCTIONS.map((f) => [f.name, f]));

function calculateCosts(goals: number) {
  // One-time per-goal setup: 3-question funnel → parseGoal → generateRoadmap
  const setupPerGoal = costPerCall(FN.parseGoal) + costPerCall(FN.generateRoadmap);
  const totalSetup = setupPerGoal * goals;

  // Daily recurring per goal (worst case — matches in-app limits).
  // Only generateTasks runs daily. Refine / Ask were removed from the
  // product so they no longer contribute.
  const generateTasksDaily = costPerCall(FN.generateTasks) * MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY;
  const dailyPerGoal = generateTasksDaily;
  const totalDaily = dailyPerGoal * goals;

  // Weekly (per user, not per goal) — amortised to per-day for rollups
  const weeklySummaryCost = costPerCall(FN.generateWeeklySummary);
  const weeklyPerDay = weeklySummaryCost / 7;

  const dailyTotal    = totalDaily + weeklyPerDay;
  const weeklyOngoing = dailyTotal * 7;
  const monthlyOngoing = dailyTotal * 30;
  const monthlyFirstMonth = monthlyOngoing + totalSetup;

  return {
    setupPerGoal,
    totalSetup,
    generateTasksDaily,
    dailyPerGoal,
    dailyTotal,
    weeklyOngoing,
    monthlyOngoing,
    monthlyFirstMonth,
  };
}

// ─── Revenue per plan ────────────────────────────────────────────────────────
const APPLE_COMMISSION = 0.15; // Apple Small Business Program (under $1M/yr)
const PLANS = [
  { name: "App Monthly", price: 15.99, period: "month", monthly: 15.99, appleCommission: true },
  { name: "Web Monthly", price: 12.99, period: "month", monthly: 12.99, appleCommission: false },
  { name: "Web Yearly", price: 99.99, period: "year", monthly: 99.99 / 12, appleCommission: false },
];

// ─── Styles ──────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
  padding: "1.25rem",
  marginBottom: "1.5rem",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.82rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid #1e1e1e",
  color: "#a1a1aa",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #1e1e21",
  color: "#e4e4e7",
};

const modelBadge = (model: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 6,
  fontSize: "0.7rem",
  fontWeight: 600,
  background:
    model === "gemini" ? "rgba(99, 91, 255, 0.15)" :
    "rgba(74, 222, 128, 0.15)",
  color:
    model === "gemini" ? "#818cf8" :
    "#4ade80",
});

const limitBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 6,
  fontSize: "0.7rem",
  fontWeight: 600,
  background: "rgba(251, 191, 36, 0.15)",
  color: "#fbbf24",
};

function fmt(n: number, decimals = 4): string {
  return "$" + n.toFixed(decimals);
}

function fmtCents(n: number): string {
  if (n < 0.01) return "<$0.01";
  return "$" + n.toFixed(2);
}

export default function CostsPage() {
  const goalRange = [1, 2, 3];

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
        AI Cost Estimator
      </h1>
      <p style={{ color: "#71717a", fontSize: "0.85rem", marginBottom: "2rem" }}>
        DeepSeek V3 (primary) with Gemini 2.5 Flash fallback. Circuit breaker: 15s timeout, skip DeepSeek for 5 min after 3 consecutive failures.
      </p>

      {/* ─── Enforced Limits ───────────────────────────────────────────── */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>
          Enforced Limits
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", background: "#1e1e21", borderRadius: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#fbbf24", marginTop: 6, flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Max {MAX_GOALS} active goals per user: </span>
              <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>Enforced in backend (POST /api/goals) and frontend (mobile + web). Users must pause or complete a goal to create a new one.</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", background: "#1e1e21", borderRadius: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#fbbf24", marginTop: 6, flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Max {MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY} task generations per goal per 24h: </span>
              <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>1 initial daily generation + 1 extra &quot;Give me more&quot; generation + 1 work-ahead generation (tapping Day N+1 after finishing today). Work-ahead is gated to once per day per goal via an <code style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>aheadKey</code> in device storage. After these limits, users see a popup guiding them to refine tasks or wait for the next day.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Model Pricing Reference ──────────────────────────────────── */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>
          Model Pricing (per 1M tokens)
        </h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Model</th>
              <th style={thStyle}>Input</th>
              <th style={thStyle}>Output</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PRICING).map(([key, p]) => (
              <tr key={key}>
                <td style={tdStyle}>
                  <span style={modelBadge(key)}>{p.label}</span>
                </td>
                <td style={tdStyle}>${p.input.toFixed(2)}</td>
                <td style={tdStyle}>${p.output.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Per-Function Cost Breakdown ──────────────────────────────── */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>
          Per-Function Cost Breakdown
        </h2>
        <p style={{ color: "#71717a", fontSize: "0.78rem", marginBottom: 12 }}>
          Tokens marked <span style={{ color: "#4ade80" }}>measured</span> are averages from AICallLog. <span style={{ color: "#f59e0b" }}>estimate</span> = no production data yet, reasonable upper bound.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Function</th>
                <th style={thStyle}>Tokens (in/out)</th>
                <th style={thStyle}>DeepSeek $/call</th>
                <th style={thStyle}>Gemini $/call</th>
                <th style={thStyle}>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {FUNCTIONS.map(fn => {
                const geminiCost = (fn.inputTokens * PRICING.gemini.input + fn.outputTokens * PRICING.gemini.output) / 1_000_000;
                return (
                <tr key={fn.name}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>
                      {fn.name}
                      {" "}
                      <span style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: fn.source === "measured" ? "rgba(74,222,128,0.15)" : "rgba(245,158,11,0.15)",
                        color: fn.source === "measured" ? "#4ade80" : "#f59e0b",
                        marginLeft: 4,
                      }}>
                        {fn.source}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#71717a", marginTop: 2 }}>{fn.description}</div>
                  </td>
                  <td style={tdStyle}>{fn.inputTokens.toLocaleString()} / {fn.outputTokens.toLocaleString()}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, fontFamily: "monospace", color: "#4ade80" }}>
                    {fmt(costPerCall(fn))}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, fontFamily: "monospace", color: "#f59e0b" }}>
                    {fmt(geminiCost)}
                  </td>
                  <td style={tdStyle}>{fn.frequency}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Cost Per User by Goals (1-3) ────────────────────────────── */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>
          Cost Per User by Number of Goals <span style={limitBadge}>Max {MAX_GOALS}</span>
        </h2>
        <p style={{ color: "#71717a", fontSize: "0.78rem", marginBottom: 16 }}>
          Worst case: {MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY} generateTasks calls/goal/24h (initial + &quot;Give me more&quot; + work-ahead) + weekly summary amortised. One-time setup per goal is parseGoal + generateRoadmap. Weekly and monthly figures are the per-day number × 7 / × 30.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Goals</th>
                <th style={thStyle}>Setup (one-time)</th>
                <th style={thStyle}>Per day</th>
                <th style={thStyle}>Per week</th>
                <th style={thStyle}>Per month (ongoing)</th>
                <th style={thStyle}>Month 1 (w/ setup)</th>
              </tr>
            </thead>
            <tbody>
              {goalRange.map(g => {
                const c = calculateCosts(g);
                return (
                  <tr key={g} style={g === MAX_GOALS ? { background: "#1e1e21" } : {}}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{g} goal{g > 1 ? "s" : ""}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{fmt(c.totalSetup, 4)}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{fmt(c.dailyTotal, 4)}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{fmt(c.weeklyOngoing, 4)}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 600 }}>{fmt(c.monthlyOngoing, 3)}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{fmt(c.monthlyFirstMonth, 3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Profit Margins by Plan ───────────────────────────────────── */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>
          Profit Margins by Plan (Monthly, Ongoing)
        </h2>
        <p style={{ color: "#71717a", fontSize: "0.78rem", marginBottom: 16 }}>
          Revenue per month after Apple&apos;s {(APPLE_COMMISSION * 100).toFixed(0)}% commission (Small Business Program) minus AI costs. Does not include ad spend or infrastructure.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Goals</th>
                <th style={thStyle}>AI Cost/mo</th>
                {PLANS.map(p => {
                  const net = p.appleCommission ? p.monthly * (1 - APPLE_COMMISSION) : p.monthly;
                  return (
                    <th key={p.name} style={thStyle}>
                      {p.name} ({fmtCents(net)}/mo{p.appleCommission ? " after Apple" : ""})
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {goalRange.map(g => {
                const c = calculateCosts(g);
                return (
                  <tr key={g} style={g === MAX_GOALS ? { background: "#1e1e21" } : {}}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{g}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{fmt(c.monthlyOngoing, 2)}</td>
                    {PLANS.map(plan => {
                      const netRevenue = plan.appleCommission ? plan.monthly * (1 - APPLE_COMMISSION) : plan.monthly;
                      const netProfit = netRevenue - c.monthlyOngoing;
                      const isNeg = netProfit < 0;
                      return (
                        <td key={plan.name} style={{
                          ...tdStyle,
                          fontFamily: "monospace",
                          fontWeight: 600,
                          color: isNeg ? "#ef4444" : "#4ade80",
                        }}>
                          {isNeg ? "-" : "+"}${Math.abs(netProfit).toFixed(2)}
                          <div style={{ fontSize: "0.65rem", color: "#71717a", fontWeight: 400, marginTop: 2 }}>
                            {((netProfit / plan.monthly) * 100).toFixed(0)}% margin
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Key Takeaways ────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>
          Key Takeaways
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            {
              label: "Goal cap enforced",
              value: `Max ${MAX_GOALS} active goals per user. Prevents runaway costs from power users.`,
              color: "#4ade80",
            },
            {
              label: "Generation cap enforced",
              value: `Max ${MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY} task generations per goal per 24h (initial + "Give me more" + work-ahead). Work-ahead is limited to one pull-forward per day per goal via the aheadKey device flag. Users guided to refine tasks instead of regenerating once the cap is hit.`,
              color: "#4ade80",
            },
            {
              label: "DeepSeek primary, Gemini Flash-Lite fallback",
              value: `All AI calls hit DeepSeek V3.2 (${fmt(PRICING.deepseek.input, 2).replace("$", "$")} / ${fmt(PRICING.deepseek.output, 2).replace("$", "$")} per 1M tokens). If DeepSeek is down or slow (15s timeout), we fall back to Gemini 2.5 Flash-Lite (${fmt(PRICING.gemini.input, 2).replace("$", "$")} / ${fmt(PRICING.gemini.output, 2).replace("$", "$")} per 1M). Circuit breaker skips DeepSeek for 5 min after 3 consecutive failures.`,
              color: "#4ade80",
            },
            {
              label: "Worst-case profit (3 goals)",
              value: `AI cost ~${fmt(calculateCosts(3).monthlyOngoing, 3)}/mo per user at the cap. After Apple's 15% cut, App Monthly plan profit: ~$${(PLANS[0].monthly * (1 - APPLE_COMMISSION) - calculateCosts(3).monthlyOngoing).toFixed(2)}/mo. Web Monthly: ~$${(PLANS[1].monthly - calculateCosts(3).monthlyOngoing).toFixed(2)}/mo. Web Yearly (${fmtCents(PLANS[2].monthly)}/mo equivalent): ~$${(PLANS[2].monthly - calculateCosts(3).monthlyOngoing).toFixed(2)}/mo.`,
              color: "#fbbf24",
            },
            {
              label: "Biggest cost driver",
              value: `generateTasks (DeepSeek) — up to ${MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY}× per goal per 24h (initial + "Give me more" + work-ahead). ${fmt(costPerCall(FN.generateTasks))} per call with real measured tokens. At 3 goals × 3 calls × 30 days = ${fmt(calculateCosts(3).generateTasksDaily * 30, 2)} per user per month at the cap.`,
              color: "#f59e0b",
            },
            {
              label: "Apple commission",
              value: `${(APPLE_COMMISSION * 100).toFixed(0)}% via Small Business Program (under $1M/yr). ~$${(PLANS[1].monthly * APPLE_COMMISSION).toFixed(2)}/mo on monthly plan, ~$${(PLANS[0].price * APPLE_COMMISSION).toFixed(2)}/yr on yearly plan.`,
              color: "#ef4444",
            },
          ].map(t => (
            <div key={t.label} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "10px 12px", background: "#1e1e21", borderRadius: 8,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color, marginTop: 6, flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{t.label}: </span>
                <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>{t.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
