"use client";

// ─── Model Pricing (per million tokens) ──────────────────────────────────────
const PRICING = {
  opus:   { input: 15.00, output: 75.00, label: "Opus 4.6" },
  sonnet: { input:  3.00, output: 15.00, label: "Sonnet 4.6" },
  haiku:  { input:  0.80, output:  4.00, label: "Haiku 4.5" },
};

// ─── Per-function cost estimates ─────────────────────────────────────────────
// Based on actual system prompts, context sizes, and max_tokens in claude.ts
const FUNCTIONS = [
  {
    name: "parseGoal",
    model: "opus" as const,
    inputTokens: 600,
    outputTokens: 300,
    frequency: "Once per goal",
    description: "Extracts structure, category, deadline from raw goal input",
  },
  {
    name: "generateRoadmap",
    model: "sonnet" as const,
    inputTokens: 1300,
    outputTokens: 1500,
    frequency: "Once per goal",
    description: "Creates multi-phase roadmap with milestones",
  },
  {
    name: "generateTasks",
    model: "sonnet" as const,
    inputTokens: 3500,
    outputTokens: 2000,
    frequency: "Daily per goal (max 2x/day)",
    description: "Generates 3 specific tasks; 1 extra generation allowed per goal per day",
  },
  {
    name: "goalChat",
    model: "haiku" as const,
    inputTokens: 800,
    outputTokens: 400,
    frequency: "~0.5x/day per goal",
    description: "Conversational goal refinement and Q&A",
  },
  {
    name: "updateCoachingContext",
    model: "haiku" as const,
    inputTokens: 1000,
    outputTokens: 250,
    frequency: "After each review",
    description: "Updates coaching context with patterns and trends",
  },
  {
    name: "generateInsight",
    model: "haiku" as const,
    inputTokens: 800,
    outputTokens: 150,
    frequency: "After each review",
    description: "2-3 sentence coaching note post-review",
  },
  {
    name: "refineTask",
    model: "haiku" as const,
    inputTokens: 500,
    outputTokens: 250,
    frequency: "~10% of tasks",
    description: "Breaks down or adjusts a single task on request",
  },
  {
    name: "askAboutTask",
    model: "haiku" as const,
    inputTokens: 600,
    outputTokens: 300,
    frequency: "~0.3x/day per goal",
    description: "Task Q&A — answers questions about a specific task",
  },
  {
    name: "generateWeeklySummary",
    model: "haiku" as const,
    inputTokens: 1500,
    outputTokens: 200,
    frequency: "Weekly per user",
    description: "Weekly progress summary with trends and recommendations",
  },
];

function costPerCall(fn: typeof FUNCTIONS[number]): number {
  const p = PRICING[fn.model];
  return (fn.inputTokens * p.input + fn.outputTokens * p.output) / 1_000_000;
}

// ─── Limits ─────────────────────────────────────────────────────────────────
const MAX_GOALS = 3;
const MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY = 2; // 1 initial + 1 extra

// ─── Per-user daily/monthly cost calculator ──────────────────────────────────
function calculateCosts(goals: number) {
  // One-time setup per goal
  const parseGoal = costPerCall(FUNCTIONS[0]);
  const generateRoadmap = costPerCall(FUNCTIONS[1]);
  const setupPerGoal = parseGoal + generateRoadmap;
  const totalSetup = setupPerGoal * goals;

  // Daily recurring per goal
  const generateTasks = costPerCall(FUNCTIONS[2]);
  // Worst case: user generates twice per goal per day (initial + 1 extra)
  const generateTasksDaily = generateTasks * MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY;
  const goalChat = costPerCall(FUNCTIONS[3]) * 0.5; // avg 0.5 chats/day
  const updateCoaching = costPerCall(FUNCTIONS[4]);
  const generateInsight = costPerCall(FUNCTIONS[5]);
  const refineTask = costPerCall(FUNCTIONS[6]) * 0.3; // ~10% of 3 tasks
  const askAboutTask = costPerCall(FUNCTIONS[7]) * 0.3; // ~0.3x/day per goal
  const dailyPerGoal = generateTasksDaily + goalChat + updateCoaching + generateInsight + refineTask + askAboutTask;
  const totalDaily = dailyPerGoal * goals;

  // Weekly (per user, not per goal)
  const weeklySummary = costPerCall(FUNCTIONS[8]);
  const weeklyPerDay = weeklySummary / 7;

  const dailyTotal = totalDaily + weeklyPerDay;
  const monthlyOngoing = dailyTotal * 30;
  const monthlyFirstMonth = monthlyOngoing + totalSetup;

  return {
    setupPerGoal,
    totalSetup,
    dailyPerGoal,
    dailyTotal,
    monthlyOngoing,
    monthlyFirstMonth,
  };
}

// ─── Revenue per plan ────────────────────────────────────────────────────────
const PLANS = [
  { name: "Yearly", price: 99.99, period: "year", monthly: 99.99 / 12 },
  { name: "Monthly", price: 12.99, period: "month", monthly: 12.99 },
];

// ─── Styles ──────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "#18181b",
  border: "1px solid #27272a",
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
  borderBottom: "1px solid #27272a",
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
    model === "opus" ? "rgba(239, 68, 68, 0.15)" :
    model === "sonnet" ? "rgba(99, 91, 255, 0.15)" :
    "rgba(74, 222, 128, 0.15)",
  color:
    model === "opus" ? "#ef4444" :
    model === "sonnet" ? "#818cf8" :
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
        Estimated costs based on Claude API pricing and actual token usage in Threely functions.
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
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Max {MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY} task generations per goal per day: </span>
              <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>1 initial daily generation + 1 extra &quot;Give me more&quot; generation. After that, users see a popup guiding them to refine tasks or adjust their plan instead.</span>
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
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>
          Per-Function Cost Breakdown
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Function</th>
                <th style={thStyle}>Model</th>
                <th style={thStyle}>Input Tokens</th>
                <th style={thStyle}>Output Tokens</th>
                <th style={thStyle}>Cost/Call</th>
                <th style={thStyle}>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {FUNCTIONS.map(fn => (
                <tr key={fn.name}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{fn.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "#71717a", marginTop: 2 }}>{fn.description}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={modelBadge(fn.model)}>{PRICING[fn.model].label}</span>
                  </td>
                  <td style={tdStyle}>~{fn.inputTokens.toLocaleString()}</td>
                  <td style={tdStyle}>~{fn.outputTokens.toLocaleString()}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, fontFamily: "monospace" }}>
                    {fmt(costPerCall(fn))}
                  </td>
                  <td style={tdStyle}>{fn.frequency}</td>
                </tr>
              ))}
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
          Worst case: 2 task generations/goal/day, daily review, ~0.5 chats/day, ~10% task refinement, ~0.3 task Q&amp;A, weekly summary.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Goals</th>
                <th style={thStyle}>Setup (One-Time)</th>
                <th style={thStyle}>Daily Cost</th>
                <th style={thStyle}>Monthly (Ongoing)</th>
                <th style={thStyle}>Month 1 (w/ Setup)</th>
              </tr>
            </thead>
            <tbody>
              {goalRange.map(g => {
                const c = calculateCosts(g);
                return (
                  <tr key={g} style={g === MAX_GOALS ? { background: "#1e1e21" } : {}}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{g} goal{g > 1 ? "s" : ""}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{fmt(c.totalSetup, 2)}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{fmt(c.dailyTotal, 3)}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 600 }}>{fmt(c.monthlyOngoing, 2)}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{fmt(c.monthlyFirstMonth, 2)}</td>
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
          Revenue per month minus estimated AI costs (worst case). Does not include ad spend, infrastructure, or Stripe fees (~2.9% + $0.30).
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Goals</th>
                <th style={thStyle}>AI Cost/mo</th>
                {PLANS.map(p => (
                  <th key={p.name} style={thStyle}>
                    {p.name} ({fmtCents(p.monthly)}/mo)
                  </th>
                ))}
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
                      const profit = plan.monthly - c.monthlyOngoing;
                      const stripeFee = plan.monthly * 0.029 + 0.30;
                      const netProfit = profit - stripeFee;
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
              value: `Max ${MAX_TASK_GENERATIONS_PER_GOAL_PER_DAY} task generations per goal per day (initial + 1 extra). Users guided to refine tasks instead of regenerating.`,
              color: "#4ade80",
            },
            {
              label: "Worst-case cost (3 goals)",
              value: `~${fmt(calculateCosts(3).monthlyOngoing, 2)}/mo per user — both plans profitable even at max usage.`,
              color: "#fbbf24",
            },
            {
              label: "Biggest cost driver",
              value: "generateTasks (Sonnet) — runs up to 2x/day per goal. ~$0.041/call.",
              color: "#f59e0b",
            },
            {
              label: "Setup cost",
              value: "parseGoal (Opus) + generateRoadmap (Sonnet) — one-time per goal. Max 3 goals per user.",
              color: "#818cf8",
            },
            {
              label: "Stripe fees",
              value: "2.9% + $0.30 per transaction. ~$0.68/mo on monthly, ~$2.33/yr.",
              color: "#71717a",
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
