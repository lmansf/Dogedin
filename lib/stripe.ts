import Stripe from "stripe";

// Server-only Stripe client. Null when STRIPE_SECRET_KEY is unset so the app
// builds/runs without payments configured (membership then shows as "not
// available yet"). Never import this from a client component.
const key = process.env.STRIPE_SECRET_KEY;

export const stripe = key ? new Stripe(key) : null;

// Human-readable price shown on the membership page. Set from env so the actual
// amount is confirmed/owned in Stripe, not hardcoded here.
export const membershipPriceLabel =
  process.env.NEXT_PUBLIC_MEMBERSHIP_PRICE_LABEL || "Membership";
