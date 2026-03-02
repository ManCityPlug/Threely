import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe, PRICE_MONTHLY, PRICE_YEARLY } from "@/lib/stripe";

const PLAN_MAP: Record<string, string> = {
  monthly: PRICE_MONTHLY,
  yearly: PRICE_YEARLY,
};

// ─── POST /api/subscription/change-plan — switch monthly/yearly ──────────────

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { plan: string };
  const newPriceId = PLAN_MAP[body.plan];
  if (!newPriceId) {
    return NextResponse.json({ error: "Invalid plan. Use 'monthly' or 'yearly'." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.subscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const stripeClient = getStripe();

  try {
    const sub = await stripeClient.subscriptions.retrieve(dbUser.subscriptionId);
    const currentItem = sub.items.data[0];

    if (!currentItem) {
      return NextResponse.json({ error: "No subscription item found" }, { status: 400 });
    }

    // Already on this plan
    if (currentItem.price.id === newPriceId) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
    }

    const updated = await stripeClient.subscriptions.update(dbUser.subscriptionId, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: "always_invoice",
    });

    const updatedItem = updated.items.data[0];

    return NextResponse.json({
      plan: {
        name: newPriceId === PRICE_YEARLY ? "Yearly" : "Monthly",
        priceId: newPriceId,
        amount: updatedItem?.price?.unit_amount ?? 0,
        interval: updatedItem?.price?.recurring?.interval ?? "month",
      },
      status: updated.status,
    });
  } catch (err) {
    console.error("Failed to change plan:", err);
    return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
  }
}
