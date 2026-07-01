"use server";

import { stripe } from "@/lib/stripe";

// Creates a Stripe Checkout session for the recurring membership. The price
// itself lives in Stripe (STRIPE_PRICE_ID) so the amount is set/confirmed there,
// not in code. Returns { url } to redirect to, or { error }.
export type CheckoutResult = { url: string } | { error: string };

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
}): Promise<CheckoutResult> {
  const priceId = process.env.STRIPE_PRICE_ID;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (!stripe || !priceId) return { error: "Membership isn't set up yet." };
  if (!base)
    return { error: "Set NEXT_PUBLIC_SITE_URL to enable checkout redirects." };
  if (!input.userId) return { error: "Please sign in first." };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: input.email || undefined,
      client_reference_id: input.userId,
      // Both places so the webhook can recover the user from the session AND
      // from later subscription lifecycle events.
      metadata: { supabase_user_id: input.userId },
      subscription_data: { metadata: { supabase_user_id: input.userId } },
      success_url: `${base}/card?welcome=1`,
      cancel_url: `${base}/membership`,
    });
    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    return { url: session.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Checkout failed." };
  }
}
