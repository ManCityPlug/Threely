import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { notifySubscription, notifyTrialStarted, notifyCancellation, notifyTrialExpiring } from "@/lib/discord";

// Disable body parsing — Stripe needs the raw body to verify signature
export const runtime = "nodejs";

// ─── Idempotency: in-memory LRU of processed Stripe event IDs ─────────────────
// Stripe retries webhooks on non-2xx responses; the same event.id can arrive
// multiple times. This dedupes within a single process. Lost on deploy/restart
// but covers the common 5-minute retry window for ~99% of duplicates.
const processedEvents = new Map<string, number>();
const MAX_EVENTS = 10000;
function markProcessed(eventId: string): boolean {
  if (processedEvents.has(eventId)) return false;
  if (processedEvents.size >= MAX_EVENTS) {
    const oldest = processedEvents.keys().next().value;
    if (oldest) processedEvents.delete(oldest);
  }
  processedEvents.set(eventId, Date.now());
  return true;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook verification failed";
    console.error("Stripe webhook error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Idempotency check — skip duplicate deliveries of the same event
  if (!markProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      // Subscription created or updated (status changes: trialing → active, active → past_due, etc.)
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        // Don't overwrite "canceled" with "active" — this happens when admin
        // refunds/cancels and Stripe fires an update event before the delete event
        const existingUser = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
        const skipStatusSync = existingUser?.subscriptionStatus === "canceled" && sub.status === "active" && sub.cancel_at_period_end;

        if (!skipStatusSync) {
          await prisma.user.updateMany({
            where: { subscriptionId: sub.id },
            data: { subscriptionStatus: sub.status },
          });
        }

        // Also persist stripeCustomerId if missing (backfill)
        if (customerId) {
          await prisma.user.updateMany({
            where: { subscriptionId: sub.id, stripeCustomerId: null },
            data: { stripeCustomerId: customerId },
          });
        }

        const planName = sub.items.data[0]?.price?.nickname ?? sub.items.data[0]?.price?.id ?? "Pro";

        // User started a free trial (entered card info via Stripe Checkout)
        if (sub.status === "trialing" && event.type === "customer.subscription.created") {
          const user = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
          notifyTrialStarted(user?.email ?? "unknown", planName);
        }

        // Trial converted to paid, or resubscription — actual payment
        if (sub.status === "active" && event.type === "customer.subscription.updated") {
          const user = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
          notifySubscription(user?.email ?? "unknown", planName, "active");
        }
        break;
      }

      // Subscription deleted / canceled
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const cancelledUser = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
        await prisma.user.updateMany({
          where: { subscriptionId: sub.id },
          data: { subscriptionStatus: "canceled" },
        });
        notifyCancellation(cancelledUser?.email ?? "unknown", sub.id);
        break;
      }

      // Charge refunded — revoke pro access. Fires for both full and partial
      // refunds; we revoke on any refund since Stripe doesn't cleanly
      // differentiate. refund.created is handled as a defensive duplicate
      // below (idempotency dedupe protects against double-processing).
      case "charge.refunded":
      case "refund.created": {
        const charge = event.data.object as Stripe.Charge & {
          subscription?: string | { id: string } | null;
        };
        const subId = typeof charge.subscription === "string"
          ? charge.subscription
          : charge.subscription?.id;
        if (!subId) break;
        const refundedUser = await prisma.user.findFirst({ where: { subscriptionId: subId } });
        if (!refundedUser) break;
        await prisma.user.update({
          where: { id: refundedUser.id },
          data: { subscriptionStatus: "canceled", subscriptionId: null },
        });
        console.log(`[stripe.webhook] ${event.type} -> revoked pro for user ${refundedUser.id}`);
        break;
      }

      // Trial will end in 7 days — send Discord alert
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const trialUser = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toLocaleDateString() : "soon";
        notifyTrialExpiring(trialUser?.email ?? "unknown", trialEnd);
        break;
      }

      // Payment succeeded — make sure status is "active" + notify on real payments
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string }).subscription;
        if (subId) {
          await prisma.user.updateMany({
            where: { subscriptionId: subId },
            data: { subscriptionStatus: "active" },
          });
          // Notify on actual payment (not $0 trial invoices)
          const amountPaid = (invoice as { amount_paid?: number }).amount_paid ?? 0;
          if (amountPaid > 0) {
            const user = await prisma.user.findFirst({ where: { subscriptionId: subId } });
            const dollars = (amountPaid / 100).toFixed(2);
            notifySubscription(
              user?.email ?? "unknown",
              `$${dollars}`,
              "active — payment received"
            );
          }
        }
        break;
      }

      // Payment failed
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string }).subscription;
        if (subId) {
          await prisma.user.updateMany({
            where: { subscriptionId: subId },
            data: { subscriptionStatus: "past_due" },
          });
        }
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
