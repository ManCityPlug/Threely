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
  try {
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
    // Force 3DS for yearly plans (high-value commitments) — bank authentication
    // reduces chargebacks and verifies card ownership before the trial begins.
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      metadata: { userId: user.id, plan: body.plan },
      ...(body.plan === "yearly" && {
        payment_method_options: {
          card: { request_three_d_secure: "any" },
        },
      }),
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
      trialEligible,
    });
  } catch (err: unknown) {
    console.error("[checkout] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
