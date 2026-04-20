import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getAnyUserFromRequest } from "@/lib/supabase";
import { getStripe, PRICE_MONTHLY, PRICE_YEARLY, TRIAL_DAYS } from "@/lib/stripe";

const PRICE_MAP: Record<string, string> = {
  monthly: PRICE_MONTHLY,
  yearly: PRICE_YEARLY,
};

// ─── POST /api/subscription/confirm — create subscription after card setup ────

export async function POST(request: NextRequest) {
  const user = await getAnyUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { plan: string };
  const priceId = PRICE_MAP[body.plan];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan. Use 'monthly' or 'yearly'." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer found. Start checkout first." }, { status: 400 });
  }

  // ── Anti-abuse: if already active, block ──────────────────────────────────
  if (dbUser.subscriptionStatus === "trialing" || dbUser.subscriptionStatus === "active") {
    return NextResponse.json({ error: "Subscription already active" }, { status: 400 });
  }

  const stripeClient = getStripe();
  const customerId = dbUser.stripeCustomerId;

  // ── Get the latest payment method and set as default ──────────────────────
  const paymentMethods = await stripeClient.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });

  if (!paymentMethods.data.length) {
    return NextResponse.json({ error: "No payment method found. Complete card setup first." }, { status: 400 });
  }

  const defaultPaymentMethod = paymentMethods.data[0].id;
  const cardFingerprint = paymentMethods.data[0].card?.fingerprint ?? null;

  await stripeClient.customers.update(customerId, {
    invoice_settings: { default_payment_method: defaultPaymentMethod },
  });

  // ── Determine trial eligibility ───────────────────────────────────────────
  let trialEligible = !dbUser.trialClaimedAt;

  // Check card fingerprint — block trial if this card was already used
  if (trialEligible && cardFingerprint) {
    const existingFingerprint = await prisma.trialCardFingerprint.findUnique({
      where: { fingerprint: cardFingerprint },
    });
    if (existingFingerprint) {
      trialEligible = false;
    }
  }

  // ── Create subscription ───────────────────────────────────────────────────
  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId }],
    default_payment_method: defaultPaymentMethod,
  };

  // Only grant the free trial (TRIAL_DAYS) if they've never had one before
  if (trialEligible) {
    subscriptionParams.trial_period_days = TRIAL_DAYS;
  }

  const subscription = await stripeClient.subscriptions.create(subscriptionParams);

  // ── Persist to DB ─────────────────────────────────────────────────────────
  const updateData: Record<string, unknown> = {
    stripeCustomerId: customerId,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
  };

  // Only set trialClaimedAt on first trial
  if (trialEligible) {
    updateData.trialClaimedAt = new Date();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  // Save card fingerprint so this card can't claim another trial
  if (trialEligible && cardFingerprint) {
    await prisma.trialCardFingerprint.create({
      data: { fingerprint: cardFingerprint, email: dbUser.email },
    });
  }

  return NextResponse.json({
    status: "success",
    subscriptionStatus: subscription.status,
    trialGranted: trialEligible,
  });
}
