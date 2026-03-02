import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe, PRICE_MONTHLY, PRICE_YEARLY } from "@/lib/stripe";

const PRICE_MAP: Record<string, string> = {
  monthly: PRICE_MONTHLY,
  yearly: PRICE_YEARLY,
};

// ─── POST /api/subscription/checkout — create SetupIntent for card collection ─

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
  const trialEligible = !dbUser?.trialClaimedAt;

  // ── Create SetupIntent — collect card without charging ────────────────────
  const setupIntent = await stripeClient.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    metadata: { userId: user.id, plan: body.plan },
  });

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    customerId,
    trialEligible,
  });
}
