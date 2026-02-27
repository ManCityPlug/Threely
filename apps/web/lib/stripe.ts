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

export const PRICE_MONTHLY   = "price_1T2mnkQ3O0etrH9yHFjRpjtt"; // $11.99/month  — TODO: create new Stripe price
export const PRICE_QUARTERLY = "price_quarterly_placeholder";     // $23.99/quarter ($7.99/mo) — TODO: create in Stripe
export const PRICE_YEARLY    = "price_1T2mo8Q3O0etrH9yOIxkMv7H"; // $59.99/year ($4.99/mo) — TODO: create new Stripe price
export const TRIAL_DAYS      = 3;
