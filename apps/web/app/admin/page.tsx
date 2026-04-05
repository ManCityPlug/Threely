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
// Haiku 4.5: $0.80/M input, $4/M output
// Sonnet 4.6: $3/M input, $15/M output
//
// Estimated tokens per call (input/output) based on prompt lengths:
const AI_FUNCTIONS = [
  { name: "parseGoal",            model: "Haiku",  frequency: "Once per goal",          inputTok: 600,  outputTok: 300,  inputRate: 0.80, outputRate: 4 },
  { name: "generateRoadmap",      model: "Sonnet", frequency: "Once per goal",          inputTok: 1300, outputTok: 1500, inputRate: 3,    outputRate: 15 },
  { name: "goalChat (per turn)",  model: "Haiku",  frequency: "5-10× during goal setup",inputTok: 800,  outputTok: 400,  inputRate: 0.80, outputRate: 4 },
  { name: "generateTasks",        model: "Haiku",  frequency: "1-2×/day per goal",      inputTok: 3500, outputTok: 2000, inputRate: 0.80, outputRate: 4 },
  { name: "generateInsight",      model: "Haiku",  frequency: "1×/day (after review)",  inputTok: 800,  outputTok: 150,  inputRate: 0.80, outputRate: 4 },
  { name: "updateCoachingContext", model: "Haiku",  frequency: "1×/day (after review)",  inputTok: 1000, outputTok: 250,  inputRate: 0.80, outputRate: 4 },
  { name: "refineTask",           model: "Haiku",  frequency: "On demand (0-3×/day)",   inputTok: 500,  outputTok: 250,  inputRate: 0.80, outputRate: 4 },
  { name: "askAboutTask",         model: "Haiku",  frequency: "On demand (0-5×/day)",   inputTok: 600,  outputTok: 300,  inputRate: 0.80, outputRate: 4 },
  { name: "generateWeeklySummary",model: "Haiku",  frequency: "1×/week",                inputTok: 1500, outputTok: 200,  inputRate: 0.80, outputRate: 4 },
];

// Cost per call in USD
function costPerCall(f: typeof AI_FUNCTIONS[number]) {
  return (f.inputTok * f.inputRate + f.outputTok * f.outputRate) / 1_000_000;
}

// Pricing
const MONTHLY_PRICE = 12.99;
const YEARLY_PRICE = 99.99;
const YEARLY_MONTHLY = YEARLY_PRICE / 12;
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
    const yearlyAfterApple = YEARLY_MONTHLY * (1 - APPLE_COMMISSION);
    const monthlyAfterApple = MONTHLY_PRICE * (1 - APPLE_COMMISSION);
    return {
      goals,
      avgCost: avg,
      maxCost: max,
      yearlyProfitAvg: yearlyAfterApple - avg,
      yearlyProfitMax: yearlyAfterApple - max,
      monthlyProfitAvg: monthlyAfterApple - avg,
      monthlyProfitMax: monthlyAfterApple - max,
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
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
              <th style={{ textAlign: "left", padding: "0.4rem 0", color: "#71717a", fontWeight: 600 }}>Function</th>
              <th style={{ textAlign: "center", padding: "0.4rem 0", color: "#71717a", fontWeight: 600 }}>Model</th>
              <th style={{ textAlign: "center", padding: "0.4rem 0", color: "#71717a", fontWeight: 600 }}>Frequency</th>
              <th style={{ textAlign: "right", padding: "0.4rem 0", color: "#71717a", fontWeight: 600 }}>$/Call</th>
            </tr>
          </thead>
          <tbody>
            {costs.map((c) => (
              <tr key={c.name} style={{ borderBottom: "1px solid #1e1e21" }}>
                <td style={{ padding: "0.4rem 0", color: "#e4e4e7", fontFamily: "monospace", fontSize: "0.75rem" }}>{c.name}</td>
                <td style={{ padding: "0.4rem 0", textAlign: "center" }}>
                  <span style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: c.model === "Sonnet" ? "#D4A84322" : "#1e1e1e",
                    color: c.model === "Sonnet" ? "#818cf8" : "#a1a1aa",
                  }}>
                    {c.model}
                  </span>
                </td>
                <td style={{ padding: "0.4rem 0", textAlign: "center", color: "#71717a", fontSize: "0.7rem" }}>{c.frequency}</td>
                <td style={{ padding: "0.4rem 0", textAlign: "right", color: "#e4e4e7", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  ${c.cost.toFixed(4)}
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
          Revenue per month after Apple&apos;s 15% commission minus estimated AI costs (avg &amp; worst case).
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
              <th style={{ textAlign: "left", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>Goals</th>
              <th style={{ textAlign: "center", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>AI Cost/mo (avg)</th>
              <th style={{ textAlign: "center", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>AI Cost/mo (max)</th>
              <th style={{ textAlign: "center", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>Yearly (${(YEARLY_MONTHLY * (1 - APPLE_COMMISSION)).toFixed(2)}/mo)</th>
              <th style={{ textAlign: "center", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>Monthly (${(MONTHLY_PRICE * (1 - APPLE_COMMISSION)).toFixed(2)}/mo)</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.goals} style={{ borderBottom: "1px solid #1e1e21" }}>
                <td style={{ padding: "0.6rem 0", color: "#D4A843", fontWeight: 700, fontSize: "1rem" }}>{s.goals}</td>
                <td style={{ padding: "0.6rem 0", textAlign: "center", color: "#a1a1aa", fontWeight: 600 }}>
                  ${s.avgCost.toFixed(2)}
                </td>
                <td style={{ padding: "0.6rem 0", textAlign: "center", color: "#a1a1aa", fontWeight: 600 }}>
                  ${s.maxCost.toFixed(2)}
                </td>
                <td style={{ padding: "0.6rem 0", textAlign: "center" }}>
                  <div style={{ color: s.yearlyProfitAvg >= 0 ? "#3ecf8e" : "#ef4444", fontWeight: 700 }}>
                    {s.yearlyProfitAvg >= 0 ? "+" : ""}${s.yearlyProfitAvg.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#71717a" }}>
                    avg · {Math.round((s.yearlyProfitAvg / YEARLY_MONTHLY) * 100)}% margin
                  </div>
                  <div style={{ color: s.yearlyProfitMax >= 0 ? "#3ecf8e" : "#ef4444", fontWeight: 600, fontSize: "0.75rem", marginTop: 2 }}>
                    {s.yearlyProfitMax >= 0 ? "+" : ""}${s.yearlyProfitMax.toFixed(2)}
                    <span style={{ color: "#71717a", fontWeight: 400 }}> worst</span>
                  </div>
                </td>
                <td style={{ padding: "0.6rem 0", textAlign: "center" }}>
                  <div style={{ color: s.monthlyProfitAvg >= 0 ? "#3ecf8e" : "#ef4444", fontWeight: 700 }}>
                    {s.monthlyProfitAvg >= 0 ? "+" : ""}${s.monthlyProfitAvg.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#71717a" }}>
                    avg · {Math.round((s.monthlyProfitAvg / MONTHLY_PRICE) * 100)}% margin
                  </div>
                  <div style={{ color: s.monthlyProfitMax >= 0 ? "#3ecf8e" : "#ef4444", fontWeight: 600, fontSize: "0.75rem", marginTop: 2 }}>
                    {s.monthlyProfitMax >= 0 ? "+" : ""}${s.monthlyProfitMax.toFixed(2)}
                    <span style={{ color: "#71717a", fontWeight: 400 }}> worst</span>
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
            { color: "#3ecf8e", label: "Almost all Haiku", text: "8/9 AI functions run on Haiku 4.5. Only generateRoadmap uses Sonnet." },
            { color: "#f59e0b", label: "Biggest cost driver", text: `generateTasks (Haiku) — runs up to 2×/day per goal. ~$${costs.find(c => c.name === "generateTasks")!.cost.toFixed(4)}/call.` },
            { color: "#818cf8", label: "Setup cost", text: `parseGoal (Haiku) + generateRoadmap (Sonnet) + goalChat — ~$${(costs.find(c => c.name === "parseGoal")!.cost + costs.find(c => c.name === "generateRoadmap")!.cost + costs.find(c => c.name === "goalChat (per turn)")!.cost * 8).toFixed(2)} per goal, one-time only.` },
            { color: "#ef4444", label: "Apple commission", text: `15% via Small Business Program (under $1M/yr). ~$${(MONTHLY_PRICE * APPLE_COMMISSION).toFixed(2)}/mo on monthly, ~$${(YEARLY_PRICE * APPLE_COMMISSION / 12).toFixed(2)}/mo on yearly.` },
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

      {/* Content */}
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
        Content
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          label="Total Goals"
          value={data.goals.total}
          sub={`${data.goals.active} active`}
        />
        <StatCard
          label="Task Items"
          value={data.tasks.totalItems.toLocaleString()}
          sub={`${data.tasks.dailyTaskRecords} daily records`}
        />
        <StatCard
          label="Completed"
          value={data.tasks.completed.toLocaleString()}
          sub={`${data.tasks.completionRate}% rate`}
        />
        <StatCard
          label="Skipped"
          value={data.tasks.skipped.toLocaleString()}
        />
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
