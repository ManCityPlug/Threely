import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe, PRICE_MONTHLY, PRICE_YEARLY } from "@/lib/stripe";

// ─── GET /api/subscription/details — full subscription info for management page ─

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // RevenueCat-only users — managed externally
  if (!dbUser.subscriptionId && dbUser.rcSubscriptionActive) {
    return NextResponse.json({ managedExternally: true });
  }

  // No subscription at all
  if (!dbUser.subscriptionId || !dbUser.stripeCustomerId) {
    return NextResponse.json({
      status: null,
      trialEligible: !dbUser.trialClaimedAt,
    });
  }

  const stripeClient = getStripe();

  try {
    const [sub, invoicesRes] = await Promise.all([
      stripeClient.subscriptions.retrieve(dbUser.subscriptionId, {
        expand: ["default_payment_method"],
      }),
      stripeClient.invoices.list({
        subscription: dbUser.subscriptionId,
        limit: 10,
      }),
    ]);

    // Extract payment method info
    const pm = sub.default_payment_method;
    let paymentMethod = null;
    if (pm && typeof pm === "object" && "card" in pm && pm.card) {
      paymentMethod = {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      };
    }

    // Determine plan info from subscription items
    const item = sub.items.data[0];
    const priceId = item?.price?.id;
    const interval = item?.price?.recurring?.interval ?? "month";
    const amount = item?.price?.unit_amount ?? 0;

    // Map invoices
    const invoices = invoicesRes.data.map((inv) => ({
      id: inv.id,
      date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      amount: inv.amount_paid ?? inv.amount_due ?? 0,
      currency: inv.currency,
      status: inv.status,
      hostedUrl: inv.hosted_invoice_url,
    }));

    return NextResponse.json({
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null,
      currentPeriodEnd: new Date(
        sub.current_period_end * 1000
      ).toISOString(),
      plan: {
        name: priceId === PRICE_YEARLY ? "Yearly" : "Monthly",
        priceId,
        amount,
        interval,
      },
      paymentMethod,
      customerEmail: dbUser.email,
      invoices,
      trialEligible: !dbUser.trialClaimedAt,
      currentPriceMonthly: PRICE_MONTHLY,
      currentPriceYearly: PRICE_YEARLY,
    });
  } catch (err) {
    console.error("Failed to fetch subscription details:", err);
    return NextResponse.json(
      { error: "Failed to fetch subscription details" },
      { status: 500 }
    );
  }
}
