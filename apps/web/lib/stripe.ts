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

// LIVE PRICES (swap back after testing):
// export const PRICE_MONTHLY   = "price_1TKTNOLR2WAEIJdD5saTp8zD"; // $12.99/4 weeks
// export const PRICE_YEARLY    = "price_1T6buHLR2WAEIJdDhlQaqxMe"; // $99.99/year ($8.33/mo)
export const PRICE_MONTHLY   = "price_1TMCwCQ3O0etrH9ylNeLzLyb"; // TEST $12.99/4 weeks
export const PRICE_YEARLY    = "price_1TMCwCQ3O0etrH9yCELHYrL1"; // TEST $99.99/year
export const TRIAL_DAYS      = 7;
