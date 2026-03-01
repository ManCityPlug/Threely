import { prisma } from "@/lib/prisma";

export interface UserAccess {
  hasPro: boolean;
  reason: "trialing" | "subscribed" | "expired" | "none";
  trialEndsAt: Date | null;
}

/**
 * Check whether a user has Pro access.
 * Priority: active Stripe subscription > automatic 7-day trial > expired/none.
 */
export async function getUserAccess(userId: string): Promise<UserAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true, trialEndsAt: true, rcSubscriptionActive: true },
  });

  if (!user) {
    return { hasPro: false, reason: "none", trialEndsAt: null };
  }

  // 1. Active Stripe subscription (paid or Stripe-managed trial)
  if (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") {
    return { hasPro: true, reason: "subscribed", trialEndsAt: user.trialEndsAt };
  }

  // 1b. Active RevenueCat subscription (mobile IAP)
  if (user.rcSubscriptionActive) {
    return { hasPro: true, reason: "subscribed", trialEndsAt: null };
  }

  // 2. Automatic 7-day free trial (no card required)
  if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) {
    return { hasPro: true, reason: "trialing", trialEndsAt: user.trialEndsAt };
  }

  // 3. No trial set (pre-trial-system user) — grant a 7-day trial now
  if (!user.trialEndsAt) {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: userId }, data: { trialEndsAt: trialEnd } });
    return { hasPro: true, reason: "trialing", trialEndsAt: trialEnd };
  }

  // 4. Trial expired
  return { hasPro: false, reason: "expired", trialEndsAt: user.trialEndsAt };
}
