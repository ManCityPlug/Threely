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

export const PRICE_MONTHLY   = "price_1TKTNOLR2WAEIJdD5saTp8zD"; // $12.99/4 weeks
export const PRICE_YEARLY    = "price_1T6buHLR2WAEIJdDhlQaqxMe"; // $99.99/year ($8.33/mo)
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
