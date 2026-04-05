"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface TaskItem {
  id: string;
  task: string;
  description?: string;
  estimated_minutes?: number;
  goal_id?: string;
  why?: string;
  isCompleted: boolean;
  isSkipped?: boolean;
}

interface GoalItem {
  id: string;
  title: string;
  description: string | null;
  rawInput: string;
  structuredSummary: string | null;
  category: string | null;
  roadmap: string | null;
  dailyTimeMinutes: number | null;
  intensityLevel: number | null;
  deadline: string | null;
  isActive: boolean;
  isPaused: boolean;
  createdAt: string;
  todayTasks: TaskItem[] | null;
  todayTasksDate: string | null;
}

interface UserDetail {
  user: {
    id: string;
    email: string;
    createdAt: string;
    lastSignIn: string | null;
    nickname: string | null;
    profile: {
      dailyTimeMinutes: number;
      intensityLevel: number;
    } | null;
  };
  goals: {
    total: number;
    active: number;
    completed: number;
    last30d: number;
    list: GoalItem[];
  };
  tasks: {
    totalGenerated: number;
    completed: number;
    skipped: number;
    completionRate: number;
    totalMinutesInvested: number;
    totalHoursInvested: number;
    dailyTaskRecords: number;
  };
  streaks: { current: number; best: number };
  subscription: {
    status: string | null;
    stripeStatus: string | null;
    stripeCustomerId: string | null;
    trialClaimedAt: string | null;
    trialEndsAt: string | null;
    firstChargeDate: string | null;
    subscriptionStartDate: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    plan: string | null;
    trialStart: string | null;
    trialEnd: string | null;
    rcSubscriptionActive: boolean;
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

const sectionTitle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#a1a1aa",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.75rem",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 600,
          color: "#71717a",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>
        {value}
      </div>
    </div>
  );
}

function daysSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

const INTENSITY = ["", "Steady", "Committed", "All-in"];

function GoalCard({ goal }: { goal: GoalItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        ...cardStyle,
        marginBottom: "0.75rem",
        cursor: "pointer",
        transition: "border-color 0.15s",
        borderColor: expanded ? "#3f3f46" : "#1e1e1e",
      }}
    >
      {/* Header — always visible */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fff" }}>
              {goal.title}
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: "0.7rem",
                fontWeight: 600,
                background: goal.isActive
                  ? goal.isPaused ? "#422006" : "#052e16"
                  : "#1e1e1e",
                color: goal.isActive
                  ? goal.isPaused ? "#fbbf24" : "#4ade80"
                  : "#71717a",
              }}
            >
              {goal.isActive ? (goal.isPaused ? "Paused" : "Active") : "Done"}
            </span>
            {goal.category && (
              <span style={{ fontSize: "0.75rem", color: "#71717a" }}>
                {goal.category}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#52525b", marginTop: 4 }}>
            Created {new Date(goal.createdAt).toLocaleDateString()}
            {goal.dailyTimeMinutes && ` · ${goal.dailyTimeMinutes}min/day`}
            {goal.intensityLevel && ` · ${INTENSITY[goal.intensityLevel]}`}
            {goal.deadline && ` · Deadline: ${new Date(goal.deadline).toLocaleDateString()}`}
          </div>
        </div>
        <span style={{ color: "#71717a", fontSize: "1.1rem", flexShrink: 0, marginLeft: 12 }}>
          {expanded ? "▾" : "▸"}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: "1rem", borderTop: "1px solid #1e1e1e", paddingTop: "1rem" }}>
          {/* Today's Tasks */}
          {goal.todayTasks && goal.todayTasks.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#D4A843", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Today&apos;s Tasks
                {goal.todayTasksDate && (
                  <span style={{ color: "#52525b", fontWeight: 500, marginLeft: 8, textTransform: "none" }}>
                    {new Date(goal.todayTasksDate + "T00:00:00").toLocaleDateString()}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {goal.todayTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "0.5rem 0.65rem",
                      background: "#0a0a0a",
                      borderRadius: 8,
                      border: "1px solid #1e1e21",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: t.isCompleted ? "none" : t.isSkipped ? "none" : "2px solid #3f3f46",
                        background: t.isCompleted ? "#D4A843" : t.isSkipped ? "#422006" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {t.isCompleted && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>&#10003;</span>}
                      {t.isSkipped && <span style={{ color: "#fbbf24", fontSize: 10 }}>—</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: t.isCompleted ? "#71717a" : t.isSkipped ? "#71717a" : "#e4e4e7",
                          textDecoration: t.isCompleted ? "line-through" : "none",
                          lineHeight: 1.4,
                        }}
                      >
                        {t.task}
                      </div>
                      {t.description && (
                        <div style={{ fontSize: "0.78rem", color: "#52525b", marginTop: 3, lineHeight: 1.4 }}>
                          {t.description}
                        </div>
                      )}
                    </div>
                    {t.estimated_minutes && (
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#52525b", flexShrink: 0 }}>
                        {t.estimated_minutes}m
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {goal.todayTasks === null && (
            <div style={{ fontSize: "0.8rem", color: "#52525b", marginBottom: "1.25rem", fontStyle: "italic" }}>
              No tasks generated for today
            </div>
          )}

          {/* Raw Input */}
          {goal.rawInput && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                User&apos;s Raw Input
              </div>
              <div style={{ fontSize: "0.85rem", color: "#d4d4d8", lineHeight: 1.6, background: "#0a0a0a", borderRadius: 8, padding: "0.65rem 0.75rem", border: "1px solid #1e1e21" }}>
                {goal.rawInput}
              </div>
            </div>
          )}

          {/* Structured Summary */}
          {goal.structuredSummary && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Structured Summary
              </div>
              <div style={{ fontSize: "0.85rem", color: "#d4d4d8", lineHeight: 1.6, background: "#0a0a0a", borderRadius: 8, padding: "0.65rem 0.75rem", border: "1px solid #1e1e21" }}>
                {goal.structuredSummary}
              </div>
            </div>
          )}

          {/* Roadmap */}
          {goal.roadmap && (
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Full Roadmap
              </div>
              <div
                style={{
                  fontSize: "0.83rem",
                  color: "#d4d4d8",
                  lineHeight: 1.7,
                  background: "#0a0a0a",
                  borderRadius: 8,
                  padding: "0.75rem",
                  border: "1px solid #1e1e21",
                  whiteSpace: "pre-wrap",
                  maxHeight: 400,
                  overflowY: "auto",
                }}
              >
                {goal.roadmap}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getRefundEligibility(subscription: UserDetail["subscription"]): {
  label: string;
  color: string;
  bg: string;
} {
  const status = subscription.status;
  if (!status || status === "none" || status === "trialing") {
    return { label: "None", color: "#71717a", bg: "#1e1e1e" };
  }

  const chargeDate = subscription.firstChargeDate;
  if (!chargeDate) {
    return { label: "None", color: "#71717a", bg: "#1e1e1e" };
  }

  const daysSinceCharge = Math.floor(
    (Date.now() - new Date(chargeDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceCharge <= 7) {
    return { label: `Eligible (${7 - daysSinceCharge}d left)`, color: "#4ade80", bg: "#052e16" };
  }
  return { label: "Not Eligible", color: "#f87171", bg: "#450a0a" };
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [denyLoading, setDenyLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    fetch(`/api/admin/users/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load user");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [params.id]);

  if (error) {
    return (
      <div style={{ color: "#fca5a5", padding: "2rem" }}>Error: {error}</div>
    );
  }
  if (!data) {
    return <div style={{ color: "#71717a", padding: "2rem" }}>Loading...</div>;
  }

  const { user, goals, tasks, streaks, subscription, ai } = data;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Back button */}
      <button
        onClick={() => router.push("/admin/users")}
        style={{
          background: "none",
          border: "none",
          color: "#D4A843",
          fontSize: "0.85rem",
          cursor: "pointer",
          marginBottom: "1rem",
          padding: 0,
        }}
      >
        &larr; Back to users
      </button>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: 4 }}>
          {user.email}
        </h1>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.85rem", color: "#71717a" }}>
          {user.nickname && <span>{user.nickname}</span>}
          <span>Joined {daysSince(user.createdAt)}</span>
          {user.lastSignIn && (
            <span>Last login {daysSince(user.lastSignIn)}</span>
          )}
        </div>
      </div>

      {/* Streaks */}
      <h2 style={sectionTitle}>Streaks</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div style={cardStyle}>
          <Stat label="Current Streak" value={`${streaks.current} days`} />
        </div>
        <div style={cardStyle}>
          <Stat label="Best Streak" value={`${streaks.best} days`} />
        </div>
      </div>

      {/* Goals — expandable cards */}
      <h2 style={sectionTitle}>Goals ({goals.total})</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={cardStyle}>
          <Stat label="Active" value={goals.active} />
        </div>
        <div style={cardStyle}>
          <Stat label="Completed" value={goals.completed} />
        </div>
        <div style={cardStyle}>
          <Stat label="Last 30d" value={goals.last30d} />
        </div>
      </div>
      {goals.list.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          {goals.list.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}

      {/* Tasks */}
      <h2 style={sectionTitle}>Tasks</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div style={cardStyle}>
          <Stat label="Generated" value={tasks.totalGenerated} />
        </div>
        <div style={cardStyle}>
          <Stat label="Completed" value={tasks.completed} />
        </div>
        <div style={cardStyle}>
          <Stat label="Skipped" value={tasks.skipped} />
        </div>
        <div style={cardStyle}>
          <Stat label="Completion %" value={`${tasks.completionRate}%`} />
        </div>
        <div style={cardStyle}>
          <Stat label="Hours Invested" value={tasks.totalHoursInvested} />
        </div>
        <div style={cardStyle}>
          <Stat label="Daily Records" value={tasks.dailyTaskRecords} />
        </div>
      </div>

      {/* Subscription */}
      <h2 style={sectionTitle}>Subscription</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
            Status
          </div>
          {(() => {
            const live = subscription.stripeStatus || subscription.status;
            const isCanceling = subscription.cancelAtPeriodEnd;
            let color = "#71717a";
            let bg = "#1e1e1e";
            let label = live || "none";

            if (live === "trialing") { color = "#60a5fa"; bg = "#172554"; label = "Trialing"; }
            else if (live === "active" && !isCanceling) { color = "#4ade80"; bg = "#052e16"; label = "Active"; }
            else if (live === "active" && isCanceling) { color = "#fbbf24"; bg = "#422006"; label = "Canceling"; }
            else if (live === "canceled") { color = "#f87171"; bg = "#450a0a"; label = "Canceled"; }
            else if (live === "past_due") { color = "#fb923c"; bg = "#431407"; label = "Past Due"; }

            return (
              <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, color, background: bg, marginTop: 4 }}>
                {label}
              </span>
            );
          })()}
        </div>
        {subscription.plan && (
          <div style={cardStyle}>
            <Stat label="Plan" value={subscription.plan} />
          </div>
        )}
        {subscription.stripeCustomerId && (
          <div style={cardStyle}>
            <Stat label="Stripe ID" value={subscription.stripeCustomerId} />
          </div>
        )}
        {(subscription.trialEnd || subscription.trialEndsAt) && (
          <div style={cardStyle}>
            <Stat
              label="Trial Ends"
              value={new Date(subscription.trialEnd || subscription.trialEndsAt!).toLocaleDateString()}
            />
          </div>
        )}
        {subscription.currentPeriodEnd && (
          <div style={cardStyle}>
            <Stat
              label={subscription.cancelAtPeriodEnd ? "Cancels On" : "Next Billing"}
              value={new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            />
          </div>
        )}
        {subscription.firstChargeDate && (
          <div style={cardStyle}>
            <Stat
              label="First Charge"
              value={new Date(subscription.firstChargeDate).toLocaleDateString()}
            />
          </div>
        )}
        {subscription.rcSubscriptionActive && (
          <div style={cardStyle}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
              RevenueCat
            </div>
            <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, color: "#4ade80", background: "#052e16", marginTop: 4 }}>
              Active (IAP)
            </span>
          </div>
        )}
        <div style={cardStyle}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
            Refund Eligibility
          </div>
          {(() => {
            const elig = getRefundEligibility(subscription);
            return (
              <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, color: elig.color, background: elig.bg, marginTop: 4 }}>
                {elig.label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Action buttons */}
      {actionMessage && (
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: 10,
          background: actionMessage.includes("Error") ? "#450a0a" : "#052e16",
          color: actionMessage.includes("Error") ? "#f87171" : "#4ade80",
          fontSize: "0.85rem",
          marginBottom: "1rem",
        }}>
          {actionMessage}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        {(subscription.status === "active" || subscription.status === "trialing") && subscription.stripeCustomerId && (
          <button
            onClick={async () => {
              if (!confirm("Cancel this user's subscription at period end?")) return;
              setCancelLoading(true);
              setActionMessage("");
              try {
                const res = await fetch(`/api/admin/users/${user.id}/cancel`, { method: "POST" });
                const json = await res.json();
                if (res.ok) {
                  setActionMessage(json.message);
                  setData((prev) => prev ? {
                    ...prev,
                    subscription: { ...prev.subscription, status: "canceled" },
                  } : prev);
                } else {
                  setActionMessage(`Error: ${json.error}`);
                }
              } catch (e) {
                setActionMessage(`Error: ${e instanceof Error ? e.message : "Failed"}`);
              } finally {
                setCancelLoading(false);
              }
            }}
            disabled={cancelLoading}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: 10,
              background: "#fbbf24",
              color: "#000",
              fontWeight: 700,
              fontSize: "0.85rem",
              border: "none",
              cursor: cancelLoading ? "not-allowed" : "pointer",
              opacity: cancelLoading ? 0.6 : 1,
            }}
          >
            {cancelLoading ? "Cancelling..." : "Cancel Plan"}
          </button>
        )}
        {subscription.stripeCustomerId && (
          <button
            onClick={async () => {
              if (!confirm("Issue a full refund and cancel subscription immediately? A confirmation email will be sent.")) return;
              setRefundLoading(true);
              setActionMessage("");
              try {
                const res = await fetch(`/api/admin/users/${user.id}/refund`, { method: "POST" });
                const json = await res.json();
                if (res.ok) {
                  setActionMessage(json.message);
                  setData((prev) => prev ? {
                    ...prev,
                    subscription: { ...prev.subscription, status: "canceled" },
                  } : prev);
                } else {
                  setActionMessage(`Error: ${json.error}`);
                }
              } catch (e) {
                setActionMessage(`Error: ${e instanceof Error ? e.message : "Failed"}`);
              } finally {
                setRefundLoading(false);
              }
            }}
            disabled={refundLoading}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: 10,
              background: "#f87171",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.85rem",
              border: "none",
              cursor: refundLoading ? "not-allowed" : "pointer",
              opacity: refundLoading ? 0.6 : 1,
            }}
          >
            {refundLoading ? "Refunding..." : "Issue Refund & Notify"}
          </button>
        )}
        {subscription.stripeCustomerId && (
          <button
            onClick={async () => {
              if (!confirm(`Send refund denial email to ${user.email}?`)) return;
              setDenyLoading(true);
              setActionMessage("");
              try {
                const res = await fetch(`/api/admin/users/${user.id}/deny-refund`, { method: "POST" });
                const json = await res.json();
                if (res.ok) {
                  setActionMessage(json.message);
                } else {
                  setActionMessage(`Error: ${json.error}`);
                }
              } catch (e) {
                setActionMessage(`Error: ${e instanceof Error ? e.message : "Failed"}`);
              } finally {
                setDenyLoading(false);
              }
            }}
            disabled={denyLoading}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: 10,
              background: "#1e1e1e",
              color: "#a1a1aa",
              fontWeight: 700,
              fontSize: "0.85rem",
              border: "1px solid #3f3f46",
              cursor: denyLoading ? "not-allowed" : "pointer",
              opacity: denyLoading ? 0.6 : 1,
            }}
          >
            {denyLoading ? "Sending..." : "Deny Refund & Notify"}
          </button>
        )}
      </div>

      {/* AI Costs */}
      <h2 style={sectionTitle}>AI Costs (Estimated)</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={cardStyle}>
          <Stat label="Total Cost" value={`$${ai.totalCost.toFixed(2)}`} />
        </div>
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
              <th style={{ textAlign: "left", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>
                Function
              </th>
              <th style={{ textAlign: "right", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>
                Calls
              </th>
              <th style={{ textAlign: "right", padding: "0.5rem 0", color: "#71717a", fontWeight: 600 }}>
                Est. Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ai.breakdown).map(([fn, info]) => (
              <tr key={fn} style={{ borderBottom: "1px solid #1e1e21" }}>
                <td style={{ padding: "0.4rem 0", color: "#e4e4e7" }}>{fn}</td>
                <td style={{ padding: "0.4rem 0", textAlign: "right", color: "#a1a1aa" }}>
                  {info.calls.toLocaleString()}
                </td>
                <td style={{ padding: "0.4rem 0", textAlign: "right", color: "#a1a1aa" }}>
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
