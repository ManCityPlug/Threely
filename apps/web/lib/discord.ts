// ─── Discord Webhook Notifications ───────────────────────────────────────────

const WEBHOOKS = {
  newSignups: process.env.DISCORD_WEBHOOK_NEW_SIGNUPS,
  subscriptions: process.env.DISCORD_WEBHOOK_SUBSCRIPTIONS,
  cancellations: process.env.DISCORD_WEBHOOK_CANCELLATIONS,
  trialExpiring: process.env.DISCORD_WEBHOOK_TRIAL_EXPIRING,
  goalCreated: process.env.DISCORD_WEBHOOK_GOAL_CREATED,
  firstTaskComplete: process.env.DISCORD_WEBHOOK_FIRST_TASK_COMPLETE,
} as const;

type Channel = keyof typeof WEBHOOKS;

async function send(channel: Channel, embed: {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}) {
  const url = WEBHOOKS[channel];
  if (!url) return; // silently skip if webhook not configured

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          ...embed,
          timestamp: embed.timestamp ?? new Date().toISOString(),
          footer: { text: "Threely Alerts" },
        }],
      }),
    });
  } catch (e) {
    // Never let Discord failures break the app
    console.error(`[Discord] Failed to send to #${channel}:`, e);
  }
}

// ─── Event Helpers ───────────────────────────────────────────────────────────

export function notifyNewSignup(email: string) {
  return send("newSignups", {
    title: "🆕 New Signup",
    color: 0x635BFF, // Threely purple
    fields: [
      { name: "Email", value: email, inline: true },
      { name: "Trial", value: "7-day Pro trial started", inline: true },
    ],
  });
}

export function notifySubscription(email: string, plan: string, status: string) {
  return send("subscriptions", {
    title: "💰 New Subscription",
    color: 0x00C853, // green
    fields: [
      { name: "Email", value: email, inline: true },
      { name: "Plan", value: plan, inline: true },
      { name: "Status", value: status, inline: true },
    ],
  });
}

export function notifyCancellation(email: string, subscriptionId: string) {
  return send("cancellations", {
    title: "❌ Subscription Cancelled",
    color: 0xFF1744, // red
    fields: [
      { name: "Email", value: email, inline: true },
      { name: "Subscription ID", value: subscriptionId, inline: true },
    ],
  });
}

export function notifyTrialExpiring(email: string, expiresAt: string) {
  return send("trialExpiring", {
    title: "⏳ Trial Expiring Soon",
    color: 0xFFA726, // orange
    fields: [
      { name: "Email", value: email, inline: true },
      { name: "Expires", value: expiresAt, inline: true },
    ],
  });
}

export function notifyGoalCreated(email: string, goalTitle: string, category: string | null, counts: { total: number; active: number }) {
  return send("goalCreated", {
    title: "🎯 New Goal Created",
    color: 0x635BFF,
    fields: [
      { name: "Email", value: email, inline: true },
      { name: "Goal", value: goalTitle, inline: true },
      ...(category ? [{ name: "Category", value: category, inline: true }] : []),
      { name: "Total Goals", value: `${counts.total}`, inline: true },
      { name: "Active Goals", value: `${counts.active}`, inline: true },
    ],
  });
}

export function notifyGoalDeleted(email: string, goalTitle: string, counts: { total: number; active: number }) {
  return send("goalCreated", {
    title: "🗑️ Goal Deleted",
    color: 0xFF1744,
    fields: [
      { name: "Email", value: email, inline: true },
      { name: "Deleted Goal", value: goalTitle, inline: true },
      { name: "Remaining Goals", value: `${counts.total}`, inline: true },
      { name: "Active Goals", value: `${counts.active}`, inline: true },
    ],
  });
}

export function notifyFirstTaskComplete(email: string, goalTitle: string) {
  return send("firstTaskComplete", {
    title: "✅ First Task Completed!",
    color: 0x00C853,
    description: "A user just completed their very first task — they've hit their aha moment!",
    fields: [
      { name: "Email", value: email, inline: true },
      { name: "Goal", value: goalTitle, inline: true },
    ],
  });
}
