import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer ID" }, { status: 400 });
  }

  const stripe = getStripe();

  // Find active subscription
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "active",
    limit: 1,
  });

  // Also check trialing
  if (subscriptions.data.length === 0) {
    const trialingSubs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "trialing",
      limit: 1,
    });
    subscriptions.data.push(...trialingSubs.data);
  }

  if (subscriptions.data.length === 0) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  const sub = subscriptions.data[0];

  // Cancel at period end (they keep access until billing period ends)
  await stripe.subscriptions.update(sub.id, {
    cancel_at_period_end: true,
  });

  // Update DB — clear subscriptionId so webhook events can't re-activate
  await prisma.user.update({
    where: { id },
    data: { subscriptionStatus: "canceled", subscriptionId: null },
  });

  return NextResponse.json({
    success: true,
    message: `Subscription will cancel at end of period (${new Date(sub.current_period_end * 1000).toLocaleDateString()})`,
    cancelAt: new Date(sub.current_period_end * 1000).toISOString(),
  });
}
