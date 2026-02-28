import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { sendRefundConfirmation } from "@/lib/email";

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

  // Find the most recent charge for this customer
  const charges = await stripe.charges.list({
    customer: user.stripeCustomerId,
    limit: 5,
  });

  const refundableCharge = charges.data.find((c) => c.status === "succeeded" && !c.refunded);

  if (!refundableCharge) {
    return NextResponse.json({ error: "No refundable charge found" }, { status: 400 });
  }

  // Issue full refund
  const refund = await stripe.refunds.create({
    charge: refundableCharge.id,
  });

  // Cancel subscription immediately
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    limit: 5,
  });

  for (const sub of subscriptions.data) {
    if (sub.status === "active" || sub.status === "trialing") {
      await stripe.subscriptions.cancel(sub.id);
    }
  }

  // Update DB
  await prisma.user.update({
    where: { id },
    data: { subscriptionStatus: "canceled" },
  });

  const amountStr = `$${(refundableCharge.amount / 100).toFixed(2)}`;

  // Send refund confirmation email
  try {
    await sendRefundConfirmation(user.email, amountStr);
  } catch {
    // Don't fail the refund if email fails
  }

  return NextResponse.json({
    success: true,
    message: `Refund of ${amountStr} issued and confirmation email sent to ${user.email}`,
    refundId: refund.id,
    amount: refundableCharge.amount / 100,
  });
}
