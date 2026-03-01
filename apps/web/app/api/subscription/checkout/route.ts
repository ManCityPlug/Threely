import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe, PRICE_MONTHLY, PRICE_YEARLY, TRIAL_DAYS } from "@/lib/stripe";

const PRICE_MAP: Record<string, string> = {
  monthly: PRICE_MONTHLY,
  yearly: PRICE_YEARLY,
};

// ─── POST /api/subscription/checkout — create Stripe Checkout session ────────

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { plan: string };
  const priceId = PRICE_MAP[body.plan];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan. Use 'monthly' or 'yearly'." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  // ── Anti-abuse: if already active, block ──────────────────────────────────
  if (dbUser?.subscriptionStatus === "trialing" || dbUser?.subscriptionStatus === "active") {
    return NextResponse.json({ error: "Subscription already active" }, { status: 400 });
  }

  const stripeClient = getStripe();

  // ── Create or retrieve Stripe customer ────────────────────────────────────
  let customerId = dbUser?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripeClient.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;

    // Persist customer ID early so we don't create duplicates on retry
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // ── Determine trial eligibility ───────────────────────────────────────────
  const alreadyClaimedTrial = !!dbUser?.trialClaimedAt;

  // ── Build Checkout Session ────────────────────────────────────────────────
  const origin = request.headers.get("origin") || request.headers.get("referer")?.replace(/\/[^/]*$/, "") || "https://threely.co";

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?subscribed=1`,
    cancel_url: `${origin}/pricing`,
    payment_method_types: ["card"],
  };

  // Only add trial if they haven't claimed one before
  if (!alreadyClaimedTrial) {
    params.subscription_data = {
      trial_period_days: TRIAL_DAYS,
    };
  }

  const session = await stripeClient.checkout.sessions.create(params);

  // ── Mark trial as claimed ─────────────────────────────────────────────────
  if (!alreadyClaimedTrial) {
    await prisma.user.update({
      where: { id: user.id },
      data: { trialClaimedAt: new Date() },
    });
  }

  return NextResponse.json({ url: session.url });
}
