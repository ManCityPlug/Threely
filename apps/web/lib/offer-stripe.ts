import type Stripe from "stripe";
import { getStripe } from "./stripe";

export interface OfferDetails {
  type: string;
  value: number;
  duration?: string | null;
  durationMonths?: number | null;
  description: string;
}

export interface OfferApplyResult {
  couponId?: string;
  customerCreditAmount?: number;
  pauseUntil?: string;
  details: string;
}

/**
 * Apply an offer to a Stripe customer/subscription.
 * Throws on failure.
 */
export async function applyOfferToStripe(
  stripeCustomerId: string,
  offer: OfferDetails
): Promise<OfferApplyResult> {
  const stripe = getStripe();

  if (offer.type === "discount_percent") {
    const couponParams: Stripe.CouponCreateParams = {
      percent_off: offer.value,
      duration:
        offer.duration === "repeating"
          ? "repeating"
          : offer.duration === "forever"
            ? "forever"
            : "once",
      name: offer.description,
    };
    if (offer.duration === "repeating" && offer.durationMonths) {
      couponParams.duration_in_months = offer.durationMonths;
    }
    const coupon = await stripe.coupons.create(couponParams);
    await stripe.customers.update(stripeCustomerId, { coupon: coupon.id });
    return {
      couponId: coupon.id,
      details: `Coupon ${coupon.id} (${offer.value}% off) attached to customer`,
    };
  }

  if (offer.type === "discount_amount") {
    const coupon = await stripe.coupons.create({
      amount_off: Math.round(offer.value * 100),
      currency: "usd",
      duration: "once",
      name: offer.description,
    });
    await stripe.customers.update(stripeCustomerId, { coupon: coupon.id });
    return {
      couponId: coupon.id,
      details: `Coupon ${coupon.id} ($${offer.value} off) attached to customer`,
    };
  }

  if (offer.type === "free_month") {
    // Add credit to the customer balance — negative amount = credit
    await stripe.customers.createBalanceTransaction(stripeCustomerId, {
      amount: -Math.round(offer.value * 100),
      currency: "usd",
      description: offer.description,
    });
    return {
      customerCreditAmount: offer.value,
      details: `$${offer.value} credit added to customer balance`,
    };
  }

  if (offer.type === "pause") {
    // Pause the active subscription for `value` days
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 1,
    });
    if (subs.data.length === 0) {
      throw new Error("No subscription found to pause");
    }
    const sub = subs.data[0];
    const resumesAtDate = new Date();
    resumesAtDate.setDate(resumesAtDate.getDate() + offer.value);
    const resumesAt = Math.floor(resumesAtDate.getTime() / 1000);
    await stripe.subscriptions.update(sub.id, {
      pause_collection: {
        behavior: "mark_uncollectible",
        resumes_at: resumesAt,
      },
    });
    return {
      pauseUntil: resumesAtDate.toISOString(),
      details: `Subscription paused until ${resumesAtDate.toLocaleDateString()}`,
    };
  }

  throw new Error(`Unknown offer type: ${offer.type}`);
}

/**
 * Try to remove an applied offer from Stripe. Returns false if not possible.
 */
export async function removeOfferFromStripe(
  stripeCustomerId: string,
  offerType: string
): Promise<boolean> {
  const stripe = getStripe();
  try {
    if (offerType === "discount_percent" || offerType === "discount_amount") {
      // Remove discount/coupon from customer
      await stripe.customers.deleteDiscount(stripeCustomerId);
      return true;
    }
    if (offerType === "pause") {
      // Resume subscription by clearing pause_collection
      const subs = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        limit: 1,
      });
      if (subs.data.length === 0) return false;
      await stripe.subscriptions.update(subs.data[0].id, {
        pause_collection: null,
      });
      return true;
    }
    if (offerType === "free_month") {
      // Reverse the credit by adding a positive balance transaction
      // But we don't store the exact amount here; caller needs to handle this
      return false;
    }
    return false;
  } catch (err) {
    console.error("[removeOfferFromStripe] failed:", err);
    return false;
  }
}
