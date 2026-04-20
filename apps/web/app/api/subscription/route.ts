import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { stripe, PRICE_MONTHLY, PRICE_YEARLY, TRIAL_DAYS } from "@/lib/stripe";

const VALID_PRICES = new Set([PRICE_MONTHLY, PRICE_YEARLY]);

// ─── GET /api/subscription — return current subscription status ───────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

    const pauseEndsAt = dbUser?.pauseEndsAt ?? null;
    const isPaused = pauseEndsAt && pauseEndsAt > new Date();

    if (!dbUser?.subscriptionId) {
      // Check RevenueCat subscription (mobile IAP users)
      if (dbUser?.rcSubscriptionActive) {
        return NextResponse.json({
          status: "active",
          trialEndsAt: null,
          currentPeriodEnd: null,
          trialEligible: !dbUser?.trialClaimedAt,
          pauseEndsAt: null,
        });
      }

      // If no Stripe sub and no RC flag, try RevenueCat REST API as fallback
      const rcStatus = await checkRevenueCatSubscription(user.id);
      if (rcStatus === "active" || rcStatus === "trialing") {
        // Persist to DB so getUserAccess picks it up for API calls
        await prisma.user.update({
          where: { id: user.id },
          data: { rcSubscriptionActive: true, subscriptionStatus: rcStatus },
        });
        return NextResponse.json({
          status: rcStatus,
          trialEndsAt: null,
          currentPeriodEnd: null,
          trialEligible: !dbUser?.trialClaimedAt,
          pauseEndsAt: null,
        });
      }

      // No Stripe subscription and no RevenueCat — no pro access
      return NextResponse.json({
        status: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        trialEligible: !dbUser?.trialClaimedAt,
        pauseEndsAt: null,
      });
    }

    // Eager trial-expiry check — if DB says trialing but the stored trial
    // end is in the past, the trial_will_end / subscription.updated webhook
    // may have been missed or delayed. Always hit Stripe fresh; if Stripe
    // also still reports trialing despite time clearly being up, trust the
    // DB date and override to canceled (conservative: both signals must
    // agree trial is over before yanking pro).
    const trialLikelyExpired =
      dbUser.subscriptionStatus === "trialing" &&
      dbUser.trialEndsAt != null &&
      dbUser.trialEndsAt < new Date();

    // Re-sync status from Stripe to catch webhook misses
    try {
      const sub = await stripe.subscriptions.retrieve(dbUser.subscriptionId);
      let status = sub.status; // trialing | active | past_due | canceled | etc.
      const stripeTrialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
      const stripeTrialEndedPast = stripeTrialEnd != null && stripeTrialEnd < new Date();

      // Conservative override: only if both DB and Stripe agree trial time
      // has passed but Stripe is still reporting "trialing" (stuck/stale).
      if (trialLikelyExpired && status === "trialing" && stripeTrialEndedPast) {
        status = "canceled";
        console.log(
          `[GET /api/subscription] Trial stuck in "trialing" past trialEndsAt for user ${user.id}; overriding to canceled`
        );
      }

      if (status !== dbUser.subscriptionStatus) {
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus: status },
        });
      }

      return NextResponse.json({
        status: isPaused ? "paused" : status,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        trialEligible: !dbUser?.trialClaimedAt,
        pauseEndsAt: pauseEndsAt ? pauseEndsAt.toISOString() : null,
      });
    } catch {
      // Stripe unreachable — return cached status, but if we know the trial
      // already expired by wall-clock time, don't keep reporting "trialing".
      const cachedStatus = trialLikelyExpired ? "canceled" : dbUser.subscriptionStatus;
      return NextResponse.json({
        status: isPaused ? "paused" : cachedStatus,
        trialEndsAt: dbUser.trialEndsAt ? dbUser.trialEndsAt.toISOString() : null,
        currentPeriodEnd: null,
        trialEligible: !dbUser?.trialClaimedAt,
        pauseEndsAt: pauseEndsAt ? pauseEndsAt.toISOString() : null,
      });
    }
  } catch (e) {
    console.error("[GET /api/subscription]", e);
    return NextResponse.json({ error: "Failed to fetch subscription status" }, { status: 500 });
  }
}

// ─── POST /api/subscription — create subscription with trial ──────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { priceId, deviceId } = body as { priceId: string; deviceId?: string };

    if (!priceId || !VALID_PRICES.has(priceId)) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

    // ── Anti-abuse: one trial per account ──────────────────────────────────────
    if (dbUser?.trialClaimedAt) {
      // Already claimed trial — if subscription is active/trialing just return status
      if (dbUser.subscriptionStatus === "trialing" || dbUser.subscriptionStatus === "active") {
        return NextResponse.json({ error: "Subscription already active" }, { status: 400 });
      }
      // Trial ended / canceled — let them resubscribe without a new trial
      if (!dbUser.stripeCustomerId) {
        return NextResponse.json({ error: "No Stripe customer found. Please contact support." }, { status: 400 });
      }
      return await createResubscription(user.id, dbUser.stripeCustomerId, priceId);
    }

    // ── Anti-abuse: one trial per device ───────────────────────────────────────
    if (deviceId) {
      const deviceClaimed = await prisma.user.findFirst({
        where: { trialDeviceId: deviceId, NOT: { id: user.id } },
      });
      if (deviceClaimed) {
        return NextResponse.json(
          { error: "Trial already used on this device. Please subscribe to continue." },
          { status: 403 }
        );
      }
    }

    // ── Create or retrieve Stripe customer ─────────────────────────────────────
    let customerId = dbUser?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
    }

    // ── Ephemeral key (for Stripe mobile SDK payment sheet) ───────────────────
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-11-20.acacia" }
    );

    // ── Setup intent — collect payment method without charging ────────────────
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      metadata: { userId: user.id, priceId },
    });

    // ── Create subscription with free trial ────────────────────────────────────
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: TRIAL_DAYS,
      payment_settings: { save_default_payment_method: "on_subscription" },
    });

    // ── Persist to DB ─────────────────────────────────────────────────────────
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customerId,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status, // "trialing"
        trialClaimedAt: new Date(),
        trialDeviceId: deviceId ?? null,
      },
    });

    return NextResponse.json({
      setupIntentClientSecret: setupIntent.client_secret,
      ephemeralKeySecret: ephemeralKey.secret,
      customerId,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (e) {
    console.error("[POST /api/subscription]", e);
    const msg = e instanceof Error ? e.message : "Failed to create subscription";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Re-subscribe (post-trial, no new trial) ──────────────────────────────────

async function createResubscription(userId: string, customerId: string, priceId: string) {
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: "2024-11-20.acacia" }
  );

  // Create a PaymentIntent for immediate charge (no trial this time)
  const amountMap: Record<string, number> = {
    [PRICE_MONTHLY]: 1299,
    [PRICE_YEARLY]: 6999,
  };
  const paymentIntent = await stripe.paymentIntents.create({
    customer: customerId,
    amount: amountMap[priceId] ?? 1299,
    currency: "usd",
    setup_future_usage: "off_session",
    metadata: { userId, priceId, type: "resubscribe" },
  });

  return NextResponse.json({
    setupIntentClientSecret: paymentIntent.client_secret,
    ephemeralKeySecret: ephemeralKey.secret,
    customerId,
    isResubscribe: true,
  });
}

// ─── RevenueCat REST API check ────────────────────────────────────────────────

async function checkRevenueCatSubscription(userId: string): Promise<string | null> {
  const rcSecret = process.env.REVENUECAT_SECRET_KEY;
  if (!rcSecret) return null;

  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
      headers: {
        Authorization: `Bearer ${rcSecret}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const entitlements = data?.subscriber?.entitlements;
    const pro = entitlements?.pro ?? entitlements?.["threely Pro"];
    if (!pro) return null;
    const expiresDate = pro.expires_date ? new Date(pro.expires_date) : null;

    if (expiresDate && expiresDate > new Date()) {
      // Check if in trial period
      const productId = pro.product_identifier ?? "";
      const purchaseDate = pro.purchase_date ? new Date(pro.purchase_date) : null;
      if (purchaseDate && expiresDate) {
        // RevenueCat sets period_type in the subscription info
        const subInfo = data?.subscriber?.subscriptions?.[productId];
        if (subInfo?.period_type === "trial") {
          return "trialing";
        }
      }
      return "active";
    }

    return null;
  } catch {
    return null;
  }
}
