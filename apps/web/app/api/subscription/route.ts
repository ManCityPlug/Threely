import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { stripe, PRICE_MONTHLY, PRICE_YEARLY, TRIAL_DAYS } from "@/lib/stripe";

const VALID_PRICES = new Set([PRICE_MONTHLY, PRICE_YEARLY]);

// ─── GET /api/subscription — return current subscription status ───────────────

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  if (!dbUser?.subscriptionId) {
    return NextResponse.json({ status: null, trialEndsAt: null, currentPeriodEnd: null });
  }

  // Re-sync status from Stripe to catch webhook misses
  try {
    const sub = await stripe.subscriptions.retrieve(dbUser.subscriptionId);
    const status = sub.status; // trialing | active | past_due | canceled | etc.

    if (status !== dbUser.subscriptionStatus) {
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: status },
      });
    }

    return NextResponse.json({
      status,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    });
  } catch {
    // Stripe unreachable — return cached status
    return NextResponse.json({
      status: dbUser.subscriptionStatus,
      trialEndsAt: null,
      currentPeriodEnd: null,
    });
  }
}

// ─── POST /api/subscription — create subscription with 7-day trial ────────────

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { priceId: string; deviceId?: string };
  const { priceId, deviceId } = body;

  if (!VALID_PRICES.has(priceId)) {
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
    return await createResubscription(user.id, dbUser.stripeCustomerId!, priceId);
  }

  // ── Anti-abuse: one trial per device ───────────────────────────────────────
  if (deviceId) {
    const deviceClaimed = await prisma.user.findFirst({
      where: { trialDeviceId: deviceId, NOT: { id: user.id } },
    });
    if (deviceClaimed) {
      return NextResponse.json(
        { error: "Free trial already used on this device. Please subscribe to continue." },
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

  // ── Create subscription with 7-day free trial ─────────────────────────────
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
}

// ─── Re-subscribe (post-trial, no new trial) ──────────────────────────────────

async function createResubscription(userId: string, customerId: string, priceId: string) {
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: "2024-11-20.acacia" }
  );

  // Create a PaymentIntent for immediate charge (no trial this time)
  const paymentIntent = await stripe.paymentIntents.create({
    customer: customerId,
    amount: priceId === "price_1T2mo8Q3O0etrH9yOIxkMv7H" ? 7000 : 799,
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
