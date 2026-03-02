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

export const PRICE_MONTHLY   = "price_1T6NmULR2WAEIJdDcilEthc2"; // $12.99/month
export const PRICE_YEARLY    = "price_1T6NmTLR2WAEIJdDbD4W2gDf"; // $69.99/year ($5.83/mo)
export const TRIAL_DAYS      = 7;
