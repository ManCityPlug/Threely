import { prisma } from "@/lib/prisma";

export interface UserAccess {
  hasPro: boolean;
  reason: "trialing" | "subscribed" | "expired" | "paused" | "none";
  trialEndsAt: Date | null;
  pauseEndsAt?: Date | null;
}

/**
 * Check whether a user has Pro access.
 * Pro requires an active Stripe subscription, Stripe trial (card on file), or RevenueCat subscription.
 * No automatic free trial — trial only starts when user subscribes via Stripe Checkout.
 *
 * Paused subscriptions return hasPro: false (paid time is "frozen").
 */
export async function getUserAccess(userId: string): Promise<UserAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      rcSubscriptionActive: true,
      pauseEndsAt: true,
    },
  });

  if (!user) {
    return { hasPro: false, reason: "none", trialEndsAt: null };
  }

  // 0. Paused — pause overrides everything until it ends
  if (user.pauseEndsAt && user.pauseEndsAt > new Date()) {
    return {
      hasPro: false,
      reason: "paused",
      trialEndsAt: user.trialEndsAt,
      pauseEndsAt: user.pauseEndsAt,
    };
  }

  // 1. Active Stripe subscription (paid or Stripe-managed trial with card on file)
  if (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") {
    return {
      hasPro: true,
      reason: user.subscriptionStatus === "trialing" ? "trialing" : "subscribed",
      trialEndsAt: user.trialEndsAt,
      pauseEndsAt: user.pauseEndsAt,
    };
  }

  // 2. Active RevenueCat subscription (mobile IAP)
  if (user.rcSubscriptionActive) {
    return { hasPro: true, reason: "subscribed", trialEndsAt: null };
  }

  // 3. No active subscription
  return { hasPro: false, reason: "none", trialEndsAt: null };
}
