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
// DeepSeek V3 (primary): $0.28/M input, $0.42/M output
// Gemini 2.5 Flash (fallback): $0.30/M input, $2.50/M output
//
// Estimated tokens per call (input/output) based on prompt lengths:
const AI_FUNCTIONS = [
  { name: "parseGoal",            model: "DeepSeek", frequency: "Once per goal",          inputTok: 600,  outputTok: 300,  inputRate: 0.28, outputRate: 0.42 },
  { name: "generateRoadmap",      model: "DeepSeek", frequency: "Once per goal",          inputTok: 1300, outputTok: 1500, inputRate: 0.28, outputRate: 0.42 },
  { name: "goalChat (per turn)",  model: "DeepSeek", frequency: "5-10× during goal setup",inputTok: 800,  outputTok: 400,  inputRate: 0.28, outputRate: 0.42 },
  { name: "generateTasks",        model: "DeepSeek", frequency: "1-2×/day per goal",      inputTok: 3500, outputTok: 2000, inputRate: 0.28, outputRate: 0.42 },
  { name: "generateInsight",      model: "DeepSeek", frequency: "1×/day (after review)",  inputTok: 800,  outputTok: 150,  inputRate: 0.28, outputRate: 0.42 },
  { name: "updateCoachingContext", model: "DeepSeek", frequency: "1×/day (after review)",  inputTok: 1000, outputTok: 250,  inputRate: 0.28, outputRate: 0.42 },
  { name: "refineTask",           model: "DeepSeek", frequency: "On demand (0-3×/day)",   inputTok: 500,  outputTok: 250,  inputRate: 0.28, outputRate: 0.42 },
  { name: "askAboutTask",         model: "DeepSeek", frequency: "On demand (0-5×/day)",   inputTok: 600,  outputTok: 300,  inputRate: 0.28, outputRate: 0.42 },
  { name: "generateWeeklySummary",model: "DeepSeek", frequency: "1×/week",                inputTok: 1500, outputTok: 200,  inputRate: 0.28, outputRate: 0.42 },
];

// Gemini fallback rates (used if DeepSeek fails — 15s timeout, circuit breaker after 3 failures)
const GEMINI_RATES = { inputRate: 0.30, outputRate: 2.50 };
function costPerCallGemini(f: typeof AI_FUNCTIONS[number]) {
  return (f.inputTok * GEMINI_RATES.inputRate + f.outputTok * GEMINI_RATES.outputRate) / 1_000_000;
}

// Cost per call in USD
function costPerCall(f: typeof AI_FUNCTIONS[number]) {
  return (f.inputTok * f.inputRate + f.outputTok * f.outputRate) / 1_000_000;
}

// Pricing
const APP_MONTHLY = 15.99;   // iOS App Store (RevenueCat)
const WEB_MONTHLY = 12.99;   // Stripe (web)
const WEB_YEARLY = 99.99;    // Stripe (web)
const WEB_YEARLY_MONTHLY = WEB_YEARLY / 12;
const APPLE_COMMISSION = 0.15; // Apple Small Business Program (under $1M/yr)

function CostEstimatorSection({ activeUsers }: { activeUsers: number }) {
  const costs = AI_FUNCTIONS.map((f) => ({ ...f, cost: costPerCall(f) }));

  // ── Scenario builder ──
  // For each goal count (1, 2, 3) calculate monthly AI cost
  function monthlyAiCost(goals: number) {
    const parseGoal = costs.find((c) => c.name === "parseGoal")!;
    const roadmap = costs.find((c) => c.name === "generateRoadmap")!;
    const goalChat = costs.find((c) => c.name === "goalChat (per turn)")!;
    const genTasks = costs.find((c) => c.name === "generateTasks")!;
    const insight = costs.find((c) => c.name === "generateInsight")!;
    const coaching = costs.find((c) => c.name === "updateCoachingContext")!;
    const refine = costs.find((c) => c.name === "refineTask")!;
    const askAi = costs.find((c) => c.name === "askAboutTask")!;
    const weekly = costs.find((c) => c.name === "generateWeeklySummary")!;

    // One-time per goal (amortised over month)
    const oneTime = goals * (parseGoal.cost + roadmap.cost + goalChat.cost * 8);

    // Daily recurring (30 days)
    const dailyTasks = goals * 1.5 * genTasks.cost; // avg 1.5 generations/day/goal
    const dailyInsight = insight.cost; // 1 per day
    const dailyCoaching = coaching.cost; // 1 per day
    const dailyRefine = refine.cost * 1; // avg 1 refine/day
    const dailyAskAi = askAi.cost * 2; // avg 2 ask-ai/day
    const daily = dailyTasks + dailyInsight + dailyCoaching + dailyRefine + dailyAskAi;

    const weeklyCost = weekly.cost * 4.3; // ~4.3 weeks/month

    return oneTime + daily * 30 + weeklyCost;
  }

  // Worst case: max usage
  function monthlyAiCostMax(goals: number) {
    const parseGoal = costs.find((c) => c.name === "parseGoal")!;
    const roadmap = costs.find((c) => c.name === "generateRoadmap")!;
    const goalChat = costs.find((c) => c.name === "goalChat (per turn)")!;
    const genTasks = costs.find((c) => c.name === "generateTasks")!;
    const insight = costs.find((c) => c.name === "generateInsight")!;
    const coaching = costs.find((c) => c.name === "updateCoachingContext")!;
    const refine = costs.find((c) => c.name === "refineTask")!;
    const askAi = costs.find((c) => c.name === "askAboutTask")!;
    const weekly = costs.find((c) => c.name === "generateWeeklySummary")!;

    const oneTime = goals * (parseGoal.cost + roadmap.cost + goalChat.cost * 10);
    const dailyTasks = goals * 2 * genTasks.cost; // 2 gens/day/goal (max)
    const dailyInsight = insight.cost;
    const dailyCoaching = coaching.cost;
    const dailyRefine = refine.cost * 3; // 3 refines/day
    const dailyAskAi = askAi.cost * 5; // 5 ask-ai/day
    const daily = dailyTasks + dailyInsight + dailyCoaching + dailyRefine + dailyAskAi;
    const weeklyCost = weekly.cost * 4.3;

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

  const totalAvg = monthlyAiCost(2) * activeUsers; // assume avg 2 goals
  const totalMax = monthlyAiCostMax(3) * activeUsers;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
      {/* Per-Call Cost Reference */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "0.75rem" }}>
          AI Cost Per Call
        </h3>
        <div style={{ fontSize: "0.72rem", color: "#71717a", marginBottom: "0.75rem" }}>
          Primary: DeepSeek V3 ($0.28/$0.42 per 1M tokens) · Fallback: Gemini 2.5 Flash ($0.30/$2.50 per 1M tokens)
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
            { color: "#3ecf8e", label: "Generation cap enforced", text: "Max 2 task generations per goal per day (initial + 1 extra)." },
            { color: "#4ade80", label: "DeepSeek primary, Gemini fallback", text: "All functions use DeepSeek V3 ($0.28/$0.42/M). Falls back to Gemini 2.5 Flash ($0.30/$2.50/M) on failure. 15s timeout, circuit breaker after 3 consecutive failures (5 min cooldown)." },
            { color: "#f59e0b", label: "Biggest cost driver", text: `generateTasks (DeepSeek) — runs up to 2×/day per goal. ~$${costs.find(c => c.name === "generateTasks")!.cost.toFixed(4)}/call (DeepSeek) or ~$${costPerCallGemini(costs.find(c => c.name === "generateTasks")!).toFixed(4)}/call (Gemini fallback).` },
            { color: "#D4A843", label: "Setup cost", text: `parseGoal + generateRoadmap + goalChat — ~$${(costs.find(c => c.name === "parseGoal")!.cost + costs.find(c => c.name === "generateRoadmap")!.cost + costs.find(c => c.name === "goalChat (per turn)")!.cost * 8).toFixed(4)} per goal (DeepSeek), one-time only.` },
            { color: "#ef4444", label: "Apple commission (app only)", text: `15% via Small Business Program (under $1M/yr). ~$${(APP_MONTHLY * APPLE_COMMISSION).toFixed(2)}/mo. Web subscriptions via Stripe have no Apple cut.` },
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
          Fleet Cost Estimate ({activeUsers} active users)
        </h3>
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
      <CostEstimatorSection activeUsers={data.users.active7d} />

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
