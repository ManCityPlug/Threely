import Stripe from "stripe";

// Lazy initialization to avoid build-time errors when env var not set
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Keep named export for backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// TODO (Stripe admin) — Threely is now displayed publicly as TWO tiers:
//   • Standard: $1 today → $39/mo (monthly) or $99/yr (yearly)
//   • Pro:      $1 today → $79/mo (monthly) or $199/yr (yearly)
// Until new Stripe SKUs exist, BOTH tiers map to the same legacy price IDs
// below. We forward `tier` ("standard" | "pro") through checkout/confirm and
// store it on the subscription metadata as `threely_tier` so we know which
// tier the user picked even when both bill the same amount.
//
// To swap to real per-tier prices when the Stripe dashboard is set up:
//   1. Create four new prices in Stripe:
//        PRICE_STANDARD_MONTHLY  ($39/mo recurring)
//        PRICE_STANDARD_YEARLY   ($99/yr recurring)
//        PRICE_PRO_MONTHLY       ($79/mo recurring)
//        PRICE_PRO_YEARLY        ($199/yr recurring)
//   2. Add the constants below (replace these legacy ones; or keep them as
//      aliases for in-flight URLs until analytics show no traffic).
//        export const PRICE_STANDARD_MONTHLY = "price_..."
//        export const PRICE_STANDARD_YEARLY  = "price_..."
//        export const PRICE_PRO_MONTHLY      = "price_..."
//        export const PRICE_PRO_YEARLY       = "price_..."
//   3. In /api/subscription/checkout/route.ts and /confirm/route.ts, replace
//      the single PRICE_MAP with a tiered lookup keyed on (tier, plan).
//   4. Display copy across the app already references the per-tier numbers —
//      swapping Stripe IDs is the last step to make billing match copy.
export const PRICE_MONTHLY   = "price_1TKTNOLR2WAEIJdD5saTp8zD"; // LEGACY — used by both tiers' monthly until per-tier SKUs exist
export const PRICE_YEARLY    = "price_1T6buHLR2WAEIJdDhlQaqxMe"; // LEGACY — used by both tiers' yearly until per-tier SKUs exist
export const TRIAL_DAYS      = 3;

/**
 * Cleanup a Stripe customer when the associated Threely account is deleted.
 * Policy: cancel any billable subscriptions (so we stop charging), then tag
 * the customer with metadata.deleted_at and keep the record. Preserves the
 * payment history for up to ~90 days of potential chargeback / refund work
 * without leaving an active billing relationship.
 *
 * Never throws — deletion of the user should not block on Stripe errors.
 */
export async function cancelAndTombstoneCustomer(params: {
  stripeCustomerId: string | null | undefined;
  threelyUserId: string;
}): Promise<{ canceledSubs: number; tombstoned: boolean }> {
  const { stripeCustomerId, threelyUserId } = params;
  if (!stripeCustomerId) return { canceledSubs: 0, tombstoned: false };
  const s = getStripe();

  let canceledSubs = 0;
  try {
    // Cancel any subs still in a billable state.
    const subs = await s.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 20 });
    for (const sub of subs.data) {
      if (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") {
        try {
          await s.subscriptions.cancel(sub.id, { invoice_now: false, prorate: false });
          canceledSubs++;
        } catch (e) {
          console.warn(`[stripe cleanup] cancel sub ${sub.id} failed:`, e instanceof Error ? e.message : e);
        }
      }
    }
  } catch (e) {
    console.warn(`[stripe cleanup] list subs for ${stripeCustomerId} failed:`, e instanceof Error ? e.message : e);
  }

  // Tag the customer. Keep the Threely user id in metadata for later refund /
  // dispute lookups — "who did this customer used to be in our system."
  try {
    await s.customers.update(stripeCustomerId, {
      metadata: {
        deleted_at: new Date().toISOString(),
        original_user_id: threelyUserId,
      },
    });
    return { canceledSubs, tombstoned: true };
  } catch (e) {
    console.warn(`[stripe cleanup] tombstone ${stripeCustomerId} failed:`, e instanceof Error ? e.message : e);
    return { canceledSubs, tombstoned: false };
  }
}
