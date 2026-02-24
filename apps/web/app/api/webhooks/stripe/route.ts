import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Disable body parsing — Stripe needs the raw body to verify signature
export const runtime = "nodejs";

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

  try {
    switch (event.type) {
      // Subscription created or updated (status changes: trialing → active, active → past_due, etc.)
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { subscriptionId: sub.id },
          data: { subscriptionStatus: sub.status },
        });
        break;
      }

      // Subscription deleted / canceled
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { subscriptionId: sub.id },
          data: { subscriptionStatus: "canceled" },
        });
        break;
      }

      // Trial will end in 3 days — good place to send reminder (optional)
      case "customer.subscription.trial_will_end": {
        // TODO: send push notification reminder
        break;
      }

      // Payment succeeded — make sure status is "active"
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string }).subscription;
        if (subId) {
          await prisma.user.updateMany({
            where: { subscriptionId: subId },
            data: { subscriptionStatus: "active" },
          });
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
