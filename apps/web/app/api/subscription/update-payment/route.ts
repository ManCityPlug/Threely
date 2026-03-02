import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

// ─── POST /api/subscription/update-payment — create SetupIntent for new card ─

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 });
  }

  const stripeClient = getStripe();

  try {
    const setupIntent = await stripeClient.setupIntents.create({
      customer: dbUser.stripeCustomerId,
      usage: "off_session",
      metadata: { userId: user.id },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (err) {
    console.error("Failed to create SetupIntent:", err);
    return NextResponse.json({ error: "Failed to initiate card update" }, { status: 500 });
  }
}

// ─── PUT /api/subscription/update-payment — attach new payment method ────────

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.stripeCustomerId || !dbUser?.subscriptionId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 });
  }

  const body = await request.json() as { paymentMethodId: string };
  const { paymentMethodId } = body;
  if (!paymentMethodId) {
    return NextResponse.json({ error: "paymentMethodId is required" }, { status: 400 });
  }

  const stripeClient = getStripe();

  try {
    // Set as default on customer
    await stripeClient.customers.update(dbUser.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Set as default on subscription
    await stripeClient.subscriptions.update(dbUser.subscriptionId, {
      default_payment_method: paymentMethodId,
    });

    // Fetch updated payment method info
    const pm = await stripeClient.paymentMethods.retrieve(paymentMethodId);

    return NextResponse.json({
      paymentMethod: pm.card
        ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        : null,
    });
  } catch (err) {
    console.error("Failed to update payment method:", err);
    return NextResponse.json({ error: "Failed to update payment method" }, { status: 500 });
  }
}
