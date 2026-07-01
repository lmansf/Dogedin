"use server";

import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

// Creates a Stripe Checkout session for the recurring membership. The price
// itself lives in Stripe (STRIPE_PRICE_ID) so the amount is set/confirmed there,
// not in code. Returns { url } to redirect to, or { error }.
//
// The caller passes their Supabase access token (JWT); we verify it server-side
// and derive the user from it, so the membership can't be attached to someone
// else's account by a forged id.
export type CheckoutResult = { url: string } | { error: string };

export async function createCheckoutSession(input: {
  accessToken: string;
}): Promise<CheckoutResult> {
  const priceId = process.env.STRIPE_PRICE_ID;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (!stripe || !priceId) return { error: "Membership isn't set up yet." };
  if (!base)
    return { error: "Set NEXT_PUBLIC_SITE_URL to enable checkout redirects." };
  if (!supabase) return { error: "Auth isn't configured." };

  // Verify the session token and use the authenticated identity — never a
  // client-supplied user id.
  const { data, error: authErr } = await supabase.auth.getUser(input.accessToken);
  const user = data?.user;
  if (authErr || !user) return { error: "Please sign in first." };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email || undefined,
      client_reference_id: user.id,
      // Both places so the webhook can recover the user from the session AND
      // from later subscription lifecycle events.
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
      success_url: `${base}/card?welcome=1`,
      cancel_url: `${base}/membership`,
    });
    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    return { url: session.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Checkout failed." };
  }
}
