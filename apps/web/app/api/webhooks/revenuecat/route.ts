import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifySubscription, notifyCancellation } from "@/lib/discord";

export const runtime = "nodejs";

// RevenueCat webhook event types
type RCEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "BILLING_ISSUE"
  | "SUBSCRIBER_ALIAS"
  | "SUBSCRIPTION_PAUSED"
  | "SUBSCRIPTION_EXTENDED"
  | "EXPIRATION"
  | "TRANSFER"
  | "TEST";

interface RCWebhookEvent {
  api_version: string;
  event: {
    type: RCEventType;
    app_user_id: string;
    original_app_user_id: string;
    product_id: string;
    entitlement_ids: string[];
    period_type: "TRIAL" | "INTRO" | "NORMAL";
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    store: "APP_STORE" | "PLAY_STORE" | "STRIPE" | "PROMOTIONAL";
    environment: "SANDBOX" | "PRODUCTION";
    is_family_share: boolean;
    transaction_id: string;
    original_transaction_id: string;
    cancel_reason?: string;
    price_in_purchased_currency?: number;
    currency?: string;
  };
}

export async function POST(request: NextRequest) {
  // Verify webhook auth header
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("REVENUECAT_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: RCWebhookEvent;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event } = payload;
  const userId = event.app_user_id;

  // Skip anonymous RevenueCat IDs (not linked to a Supabase user)
  if (userId.startsWith("$RCAnonymousID:")) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "TEST": {
        console.log("RevenueCat test webhook received");
        break;
      }

      case "INITIAL_PURCHASE": {
        const status = event.period_type === "TRIAL" ? "trialing" : "active";
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: status,
            rcSubscriptionActive: true,
          },
        });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        const planName = event.product_id.includes("yearly") ? "Yearly (IAP)" : "Monthly (IAP)";
        notifySubscription(user?.email ?? "unknown", planName, status);
        break;
      }

      case "RENEWAL":
      case "UNCANCELLATION":
      case "SUBSCRIPTION_EXTENDED": {
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: "active",
            rcSubscriptionActive: true,
          },
        });
        break;
      }

      case "CANCELLATION":
      case "EXPIRATION": {
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: "canceled",
            rcSubscriptionActive: false,
          },
        });

        const cancelledUser = await prisma.user.findUnique({ where: { id: userId } });
        notifyCancellation(cancelledUser?.email ?? "unknown", event.product_id);
        break;
      }

      case "BILLING_ISSUE": {
        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionStatus: "past_due" },
        });
        break;
      }

      case "PRODUCT_CHANGE":
      case "SUBSCRIBER_ALIAS":
      case "SUBSCRIPTION_PAUSED":
      case "TRANSFER":
        // Log but no DB action needed
        console.log(`RevenueCat event: ${event.type} for user ${userId}`);
        break;

      default:
        console.log(`Unhandled RevenueCat event: ${event.type}`);
        break;
    }
  } catch (err) {
    console.error("RevenueCat webhook handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
