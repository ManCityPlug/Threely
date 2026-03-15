import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe, PRICE_YEARLY, PRICE_MONTHLY, TRIAL_DAYS } from "@/lib/stripe";

// ─── POST /api/start/confirm — create subscription after card setup ──────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer found." }, { status: 400 });
    }

    // Anti-abuse: block if already active
    if (dbUser.subscriptionStatus === "trialing" || dbUser.subscriptionStatus === "active") {
      return NextResponse.json({ error: "Subscription already active" }, { status: 400 });
    }

    // Determine price from request body
    const body = await request.json().catch(() => ({}));
    const plan = body.plan === "monthly" ? "monthly" : "yearly";
    const priceId = plan === "monthly" ? PRICE_MONTHLY : PRICE_YEARLY;

    const stripeClient = getStripe();
    const customerId = dbUser.stripeCustomerId;

    // Get latest payment method and set as default
    const paymentMethods = await stripeClient.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });

    if (!paymentMethods.data.length) {
      return NextResponse.json({ error: "No payment method found." }, { status: 400 });
    }

    const defaultPaymentMethod = paymentMethods.data[0].id;
    const cardFingerprint = paymentMethods.data[0].card?.fingerprint ?? null;

    await stripeClient.customers.update(customerId, {
      invoice_settings: { default_payment_method: defaultPaymentMethod },
    });

    // Determine trial eligibility
    let trialEligible = !dbUser.trialClaimedAt;

    if (trialEligible && cardFingerprint) {
      const existingFingerprint = await prisma.trialCardFingerprint.findUnique({
        where: { fingerprint: cardFingerprint },
      });
      if (existingFingerprint) {
        trialEligible = false;
      }
    }

    // Create subscription
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: defaultPaymentMethod,
    };

    if (trialEligible) {
      subscriptionParams.trial_period_days = TRIAL_DAYS;
    }

    const subscription = await stripeClient.subscriptions.create(subscriptionParams);

    // Persist to DB
    const updateData: Record<string, unknown> = {
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    };

    if (trialEligible) {
      updateData.trialClaimedAt = new Date();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Save card fingerprint
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
  } catch (err: unknown) {
    console.error("[start/confirm] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
