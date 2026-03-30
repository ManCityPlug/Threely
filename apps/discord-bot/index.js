/**
 * Threely Discord Bot
 * - /verify command: checks Threely subscription via Supabase, assigns Member role
 * - Stripe webhook: strips Member role when subscription lapses
 * - Express server for Stripe webhooks
 */
import { Client, GatewayIntentBits, Events } from "discord.js";
import express from "express";
import Stripe from "stripe";
import "dotenv/config";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = process.env.PORT || 3001;

const stripe = new Stripe(STRIPE_SECRET);

// ── Discord client ──────────────────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, () => {
  console.log(`Discord bot ready: ${client.user.tag}`);
});

// ── /verify command ─────────────────────────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "verify") return;

  const email = interaction.options.getString("email", true).trim().toLowerCase();
  await interaction.deferReply({ ephemeral: true });

  try {
    // Look up user in Supabase by email
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
    });

    // Search all users for matching email
    const allUsersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email,rc_subscription_active,subscription_status`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY,
        },
      }
    );

    if (!allUsersRes.ok) {
      console.error("Supabase lookup failed:", allUsersRes.status, await allUsersRes.text());
      await interaction.editReply("Something went wrong checking your account. Please try again later.");
      return;
    }

    const users = await allUsersRes.json();
    if (!users || users.length === 0) {
      await interaction.editReply(
        `No Threely account found for **${email}**. Make sure you're using the same email you signed up with.`
      );
      return;
    }

    const user = users[0];
    const hasActive = user.rc_subscription_active || user.subscription_status === "active" || user.subscription_status === "trialing";

    if (!hasActive) {
      await interaction.editReply(
        "Your Threely account doesn't have an active subscription. Subscribe at [threely.co](https://threely.co) to get Member access!"
      );
      return;
    }

    // Assign Member role
    const guild = client.guilds.cache.get(GUILD_ID);
    const member = await guild.members.fetch(interaction.user.id);
    const memberRole = guild.roles.cache.find((r) => r.name === "Member");

    if (!memberRole) {
      await interaction.editReply("Member role not found. Please contact an admin.");
      return;
    }

    await member.roles.add(memberRole);

    // Store Discord ID in Supabase user metadata for webhook lookups
    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      // Store discord ID in a way we can look up later
    });

    // Also store in Supabase auth metadata
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_metadata: { discord_id: interaction.user.id },
      }),
    });

    await interaction.editReply(
      "You're verified! You now have **Member** access. Enjoy the community!"
    );
    console.log(`Verified: ${email} → Discord ${interaction.user.tag}`);
  } catch (err) {
    console.error("Verify error:", err);
    await interaction.editReply("Something went wrong. Please try again later.");
  }
});

// ── Express server for Stripe webhooks ──────────────────────────────────────

const app = express();

app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    const customerId = subscription.customer;

    // Only act on cancellation/lapse
    if (event.type === "customer.subscription.updated" && subscription.status === "active") {
      return res.json({ received: true });
    }

    try {
      // Look up user by Stripe customer ID
      const userRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id`,
        {
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            apikey: SUPABASE_SERVICE_KEY,
          },
        }
      );

      const users = await userRes.json();
      if (!users || users.length === 0) {
        console.log(`No user found for Stripe customer ${customerId}`);
        return res.json({ received: true });
      }

      // Get Discord ID from Supabase auth metadata
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${users[0].id}`, {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY,
        },
      });

      const authData = await authRes.json();
      const discordId = authData?.user_metadata?.discord_id;

      if (!discordId) {
        console.log(`User ${users[0].id} has no Discord ID stored`);
        return res.json({ received: true });
      }

      // Strip Member role
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return res.json({ received: true });

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) return res.json({ received: true });

      const memberRole = guild.roles.cache.find((r) => r.name === "Member");
      if (memberRole && member.roles.cache.has(memberRole.id)) {
        await member.roles.remove(memberRole);
        console.log(`Removed Member role from Discord user ${discordId} (subscription lapsed)`);
      }
    } catch (err) {
      console.error("Stripe webhook error:", err);
    }
  }

  res.json({ received: true });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── Start everything ────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`Webhook server listening on port ${PORT}`));
client.login(TOKEN);
