"use client";

import { useEffect, useState } from "react";

interface OverviewData {
  users: { total: number; active7d: number; new30d: number };
  goals: { total: number; active: number };
  tasks: {
    totalItems: number;
    completed: number;
    skipped: number;
    completionRate: number;
    dailyTaskRecords: number;
  };
  subscriptions: {
    trialing: number;
    active: number;
    estimatedMRR: number;
  };
  ai: {
    breakdown: Record<string, { calls: number; cost: number }>;
    totalCost: number;
  };
}

const cardStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
  padding: "1.25rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#71717a",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#fff",
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
      {sub && (
        <div style={{ fontSize: "0.8rem", color: "#a1a1aa", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Per-User Cost Estimator ──────────────────────────────────────────────────
// Pricing verified 2026-04-19:
//   DeepSeek V3.2 (primary):          $0.28/M input, $0.42/M output
//   Gemini 2.5 Flash-Lite (fallback): $0.10/M input, $0.40/M output
//
// Tokens flagged "measured" come from AICallLog averages (deepseek-chat only).
// "estimate" = no production data yet.
const DEEPSEEK_RATES = { inputRate: 0.28, outputRate: 0.42 };
const GEMINI_RATES   = { inputRate: 0.10, outputRate: 0.40 };
const AI_FUNCTIONS = [
  { name: "parseGoal",             frequency: "Once per goal (3-question funnel)", inputTok:  812, outputTok:  185, source: "measured" },
  { name: "generateRoadmap",       frequency: "Once per goal (async)",             inputTok:  716, outputTok: 1305, source: "measured" },
  { name: "generateTasks",         frequency: "Up to 3×/24h per goal",             inputTok: 2765, outputTok:  447, source: "measured" },
  { name: "generateWeeklySummary", frequency: "1×/week per user",                  inputTok: 1500, outputTok:  200, source: "estimate" },
] as const;

function costPerCall(f: typeof AI_FUNCTIONS[number]) {
  return (f.inputTok * DEEPSEEK_RATES.inputRate + f.outputTok * DEEPSEEK_RATES.outputRate) / 1_000_000;
}
function costPerCallGemini(f: typeof AI_FUNCTIONS[number]) {
  return (f.inputTok * GEMINI_RATES.inputRate + f.outputTok * GEMINI_RATES.outputRate) / 1_000_000;
}

// Pricing
const APP_MONTHLY = 15.99;   // iOS App Store (RevenueCat)
const WEB_MONTHLY = 12.99;   // Stripe (web)
const WEB_YEARLY = 99.99;    // Stripe (web)
const WEB_YEARLY_MONTHLY = WEB_YEARLY / 12;
const APPLE_COMMISSION = 0.15; // Apple Small Business Program (under $1M/yr)

// Hard product limits — match in-app enforcement.
const MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY = 3; // initial + "Give me more" + work-ahead

function CostEstimatorSection({ payingUsers }: { activeUsers: number; payingUsers: number }) {
  const costs = AI_FUNCTIONS.map((f) => ({ ...f, cost: costPerCall(f) }));
  const byName = Object.fromEntries(costs.map((c) => [c.name, c]));

  // ── Scenario builder ──
  // Only generateTasks runs daily in the current product. Refine / Ask were
  // removed. Setup (parse + roadmap) is one-time per goal.
  function monthlyAiCost(goals: number) {
    const oneTime = goals * (byName.parseGoal.cost + byName.generateRoadmap.cost);
    const daily = goals * 1 * byName.generateTasks.cost; // avg 1 gen/day/goal
    const weeklyCost = byName.generateWeeklySummary.cost * 4.3; // ~4.3 wks/mo
    return oneTime + daily * 30 + weeklyCost;
  }
  function monthlyAiCostMax(goals: number) {
    const oneTime = goals * (byName.parseGoal.cost + byName.generateRoadmap.cost);
    const daily = goals * MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY * byName.generateTasks.cost;
    const weeklyCost = byName.generateWeeklySummary.cost * 4.3;
    return oneTime + daily * 30 + weeklyCost;
  }

  const scenarios = [1, 2, 3].map((goals) => {
    const avg = monthlyAiCost(goals);
    const max = monthlyAiCostMax(goals);
    const appAfterApple = APP_MONTHLY * (1 - APPLE_COMMISSION);
    const webMonthlyNet = WEB_MONTHLY; // Stripe fees ~2.9% but negligible here
    const webYearlyNet = WEB_YEARLY_MONTHLY;
    return {
      goals,
      avgCost: avg,
      maxCost: max,
      appProfitAvg: appAfterApple - avg,
      appProfitMax: appAfterApple - max,
      webMonthlyProfitAvg: webMonthlyNet - avg,
      webYearlyProfitAvg: webYearlyNet - avg,
    };
  });

  const totalAvg = monthlyAiCost(2) * payingUsers; // paying users, assume avg 2 goals
  const totalMax = monthlyAiCostMax(3) * payingUsers;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
      {/* Per-Call Cost Reference */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "0.75rem" }}>
          AI Cost Per Call
        </h3>
        <div style={{ fontSize: "0.72rem", color: "#71717a", marginBottom: "0.75rem" }}>
          {`Primary: DeepSeek V3.2 ($${DEEPSEEK_RATES.inputRate}/$${DEEPSEEK_RATES.outputRate} per 1M tokens) · Fallback: Gemini 2.5 Flash-Lite ($${GEMINI_RATES.inputRate}/$${GEMINI_RATES.outputRate} per 1M tokens). Tokens = real averages from AICallLog.`}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
              <th style={{ textAlign: "left", padding: "0.4rem 0", color: "#71717a", fontWeight: 600 }}>Function</th>
              <th style={{ textAlign: "center", padding: "0.4rem 0", color: "#71717a", fontWeight: 600 }}>Frequency</th>
              <th style={{ textAlign: "right", padding: "0.4rem 0", color: "#71717a", fontWeight: 600 }}>DeepSeek</th>
              <th style={{ textAlign: "right", padding: "0.4rem 0", color: "#71717a", fontWeight: 600 }}>Gemini (fallback)</th>
            </tr>
          </thead>
          <tbody>
            {costs.map((c) => (
              <tr key={c.name} style={{ borderBottom: "1px solid #1e1e21" }}>
                <td style={{ padding: "0.4rem 0", color: "#e4e4e7", fontFamily: "monospace", fontSize: "0.75rem" }}>{c.name}</td>
                <td style={{ padding: "0.4rem 0", textAlign: "center", color: "#71717a", fontSize: "0.7rem" }}>{c.frequency}</td>
                <td style={{ padding: "0.4rem 0", textAlign: "right", color: "#4ade80", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  ${c.cost.toFixed(4)}
                </td>
                <td style={{ padding: "0.4rem 0", textAlign: "right", color: "#f59e0b", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  ${costPerCallGemini(c).toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Profit Margins by Plan */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: 2 }}>
          Profit Margins by Plan (Monthly, Ongoing)
        </h3>
        <div style={{ fontSize: "0.7rem", color: "#71717a", marginBottom: "1rem" }}>
          App: $15.99/mo (after Apple 15% = ${(APP_MONTHLY * (1 - APPLE_COMMISSION)).toFixed(2)}) · Web: $12.99/mo or $99.99/yr (${WEB_YEARLY_MONTHLY.toFixed(2)}/mo)
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
              <th style={{ textAlign: "left", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>Goals</th>
              <th style={{ textAlign: "center", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>AI Cost/mo</th>
              <th style={{ textAlign: "center", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>App $15.99 (${(APP_MONTHLY * (1 - APPLE_COMMISSION)).toFixed(2)} net)</th>
              <th style={{ textAlign: "center", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>Web $12.99/mo</th>
              <th style={{ textAlign: "center", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>Web $99.99/yr (${WEB_YEARLY_MONTHLY.toFixed(2)}/mo)</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.goals} style={{ borderBottom: "1px solid #1e1e21" }}>
                <td style={{ padding: "0.6rem 0", color: "#D4A843", fontWeight: 700, fontSize: "1rem" }}>{s.goals}</td>
                <td style={{ padding: "0.6rem 0", textAlign: "center", color: "#a1a1aa", fontWeight: 600 }}>
                  ${s.avgCost.toFixed(2)}
                </td>
                <td style={{ padding: "0.6rem 0", textAlign: "center" }}>
                  <div style={{ color: s.appProfitAvg >= 0 ? "#3ecf8e" : "#ef4444", fontWeight: 700 }}>
                    +${s.appProfitAvg.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#71717a" }}>
                    {Math.round((s.appProfitAvg / APP_MONTHLY) * 100)}% margin
                  </div>
                </td>
                <td style={{ padding: "0.6rem 0", textAlign: "center" }}>
                  <div style={{ color: s.webMonthlyProfitAvg >= 0 ? "#3ecf8e" : "#ef4444", fontWeight: 700 }}>
                    +${s.webMonthlyProfitAvg.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#71717a" }}>
                    {Math.round((s.webMonthlyProfitAvg / WEB_MONTHLY) * 100)}% margin
                  </div>
                </td>
                <td style={{ padding: "0.6rem 0", textAlign: "center" }}>
                  <div style={{ color: s.webYearlyProfitAvg >= 0 ? "#3ecf8e" : "#ef4444", fontWeight: 700 }}>
                    +${s.webYearlyProfitAvg.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#71717a" }}>
                    {Math.round((s.webYearlyProfitAvg / WEB_YEARLY_MONTHLY) * 100)}% margin
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key Takeaways */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "0.75rem" }}>
          Key Takeaways
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.8rem" }}>
          {[
            { color: "#3ecf8e", label: "Goal cap enforced", text: "Max 3 active goals per user. Prevents runaway costs from power users." },
            { color: "#3ecf8e", label: "Generation cap enforced", text: `Max ${MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY} task generations per goal per 24h (initial + \"Give me more\" + work-ahead).` },
            { color: "#4ade80", label: "DeepSeek primary, Gemini Flash-Lite fallback", text: `All functions use DeepSeek V3.2 ($${DEEPSEEK_RATES.inputRate}/$${DEEPSEEK_RATES.outputRate} per 1M). Falls back to Gemini 2.5 Flash-Lite ($${GEMINI_RATES.inputRate}/$${GEMINI_RATES.outputRate} per 1M) on failure. 15s timeout, circuit breaker after 3 consecutive failures (5 min cooldown).` },
            { color: "#f59e0b", label: "Biggest cost driver", text: `generateTasks — runs up to ${MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY}×/24h per goal. ~$${byName.generateTasks.cost.toFixed(4)}/call (DeepSeek) · ~$${costPerCallGemini(byName.generateTasks).toFixed(4)}/call (Gemini fallback). Measured tokens.` },
            { color: "#D4A843", label: "Setup cost per goal", text: `parseGoal + generateRoadmap — ~$${(byName.parseGoal.cost + byName.generateRoadmap.cost).toFixed(4)} per goal (DeepSeek), one-time only.` },
            { color: "#ef4444", label: "Apple commission (app only)", text: `15% via Small Business Program (under $1M/yr). ~$${(APP_MONTHLY * APPLE_COMMISSION).toFixed(2)}/mo on App Monthly. Web subscriptions via Stripe have no Apple cut.` },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, marginTop: 5, flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 600, color: "#e4e4e7" }}>{item.label}:</span>{" "}
                <span style={{ color: "#a1a1aa" }}>{item.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fleet Estimate */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "0.75rem" }}>
          Fleet Cost Estimate ({payingUsers} paying subscribers)
        </h3>
        <div style={{ fontSize: "0.7rem", color: "#71717a", marginBottom: "0.75rem" }}>
          Only paying users (trial + active) are counted. Free users get 1 goal + 1 task set — negligible cost.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={{ background: "#1e1e1e", borderRadius: 8, padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: "#71717a", marginBottom: 4 }}>Avg usage (2 goals)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#3ecf8e" }}>${totalAvg.toFixed(2)}</div>
            <div style={{ fontSize: "0.7rem", color: "#71717a" }}>per month</div>
          </div>
          <div style={{ background: "#1e1e1e", borderRadius: 8, padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: "#71717a", marginBottom: 4 }}>Worst case (3 goals, max)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f59e0b" }}>${totalMax.toFixed(2)}</div>
            <div style={{ fontSize: "0.7rem", color: "#71717a" }}>per month</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div style={{ color: "#fca5a5", padding: "2rem" }}>Error: {error}</div>
    );
  }

  if (!data) {
    return <div style={{ color: "#71717a", padding: "2rem" }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#fff",
          marginBottom: "0.25rem",
        }}
      >
        Overview
      </h1>
      <p
        style={{
          fontSize: "0.85rem",
          color: "#71717a",
          marginBottom: "2rem",
        }}
      >
        Platform-wide metrics
      </p>

      {/* Users */}
      <h2
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#a1a1aa",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        Users
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard label="Total Users" value={data.users.total} />
        <StatCard label="Active (7d)" value={data.users.active7d} />
        <StatCard label="New (30d)" value={data.users.new30d} />
      </div>

      {/* Revenue */}
      <h2
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#a1a1aa",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        Revenue
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard label="Trialing" value={data.subscriptions.trialing} />
        <StatCard label="Active Subs" value={data.subscriptions.active} />
        <StatCard
          label="Est. MRR"
          value={`$${data.subscriptions.estimatedMRR.toFixed(2)}`}
        />
      </div>

      {/* Per-User Cost Estimator */}
      <h2
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#a1a1aa",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        Per-User Cost Estimator
      </h2>
      <CostEstimatorSection activeUsers={data.users.active7d} payingUsers={data.subscriptions.trialing + data.subscriptions.active} />

      {/* AI Costs */}
      <h2
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#a1a1aa",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        AI Costs (Actual)
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <StatCard
          label="Total AI Cost"
          value={`$${data.ai.totalCost.toFixed(2)}`}
        />
      </div>
      <div style={cardStyle}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "0.5rem 0",
                  color: "#71717a",
                  fontWeight: 600,
                }}
              >
                Function
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "0.5rem 0",
                  color: "#71717a",
                  fontWeight: 600,
                }}
              >
                Calls
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "0.5rem 0",
                  color: "#71717a",
                  fontWeight: 600,
                }}
              >
                Est. Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.ai.breakdown).map(([fn, info]) => (
              <tr key={fn} style={{ borderBottom: "1px solid #1e1e21" }}>
                <td style={{ padding: "0.4rem 0", color: "#e4e4e7" }}>{fn}</td>
                <td
                  style={{
                    padding: "0.4rem 0",
                    textAlign: "right",
                    color: "#a1a1aa",
                  }}
                >
                  {info.calls.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "0.4rem 0",
                    textAlign: "right",
                    color: "#a1a1aa",
                  }}
                >
                  ${info.cost.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
