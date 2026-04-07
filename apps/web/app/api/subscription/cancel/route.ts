import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe, PRICE_YEARLY } from "@/lib/stripe";

// ─── POST /api/subscription/cancel ────────────────────────────────────────────
// Body:
//   {
//     reason: string,                    // required - one of the survey options
//     feedback?: string,                 // optional free-form text
//     refund?: boolean,                  // request immediate full refund (yearly only, ≤14 days)
//   }
// Behavior:
//   - If refund=true: must be yearly + within 14 days of first paid charge.
//     Issues full refund + cancels subscription immediately.
//   - Else: sets cancel_at_period_end on the subscription.
//   - Always records a CancellationFeedback row.

const REFUND_WINDOW_DAYS = 14;

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.subscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  // Parse + validate body
  let body: { reason?: string; feedback?: string; refund?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const reason = (body.reason ?? "").trim();
  const feedback = (body.feedback ?? "").trim() || null;
  const wantsRefund = body.refund === true;

  if (!reason) {
    return NextResponse.json({ error: "Cancel reason is required" }, { status: 400 });
  }

  const stripeClient = getStripe();

  try {
    const sub = await stripeClient.subscriptions.retrieve(dbUser.subscriptionId);
    const item = sub.items.data[0];
    const priceId = item?.price?.id;
    const isYearly = priceId === PRICE_YEARLY;
    const planName = isYearly ? "yearly" : "monthly";

    // ── Refund branch (yearly + within 14 days) ────────────────────────────────
    if (wantsRefund) {
      if (!isYearly) {
        return NextResponse.json(
          { error: "Refunds are only available on yearly plans" },
          { status: 400 }
        );
      }

      // Find the most recent paid invoice (the one we'll refund)
      const invoices = await stripeClient.invoices.list({
        subscription: dbUser.subscriptionId,
        limit: 10,
      });
      const paidInvoice = invoices.data.find(
        (inv) => inv.status === "paid" && (inv.amount_paid ?? 0) > 0
      );

      if (!paidInvoice) {
        return NextResponse.json(
          { error: "No paid invoice found to refund" },
          { status: 400 }
        );
      }

      const paidAt = paidInvoice.status_transitions?.paid_at ?? paidInvoice.created;
      const ageDays = (Date.now() / 1000 - paidAt) / 86400;
      if (ageDays > REFUND_WINDOW_DAYS) {
        return NextResponse.json(
          { error: `Refunds are only available within ${REFUND_WINDOW_DAYS} days of your charge` },
          { status: 400 }
        );
      }

      const chargeId = typeof paidInvoice.charge === "string"
        ? paidInvoice.charge
        : paidInvoice.charge?.id;
      if (!chargeId) {
        return NextResponse.json({ error: "No charge found on invoice" }, { status: 400 });
      }

      // Issue the refund
      await stripeClient.refunds.create({
        charge: chargeId,
        reason: "requested_by_customer",
      });

      // Cancel immediately
      const cancelled = await stripeClient.subscriptions.cancel(dbUser.subscriptionId);

      // Update DB
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: cancelled.status },
      });

      // Save feedback
      await prisma.cancellationFeedback.create({
        data: { userId: user.id, reason, feedback, plan: planName },
      });

      return NextResponse.json({
        refunded: true,
        amount: paidInvoice.amount_paid,
        currency: paidInvoice.currency,
        cancelAt: new Date().toISOString(),
      });
    }

    // ── Standard cancel-at-period-end branch ───────────────────────────────────
    const updated = await stripeClient.subscriptions.update(dbUser.subscriptionId, {
      cancel_at_period_end: true,
    });

    // Save feedback
    await prisma.cancellationFeedback.create({
      data: { userId: user.id, reason, feedback, plan: planName },
    });

    return NextResponse.json({
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: new Date(updated.current_period_end * 1000).toISOString(),
    });
  } catch (err) {
    console.error("Failed to cancel subscription:", err);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
