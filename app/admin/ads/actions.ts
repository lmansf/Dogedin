"use server";

import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Creates a one-time Stripe Checkout link for an approved ad. The admin enters
// the agreed amount (the price lives in the session, not a pre-made Stripe
// Price, so there's nothing to configure per campaign). The advertiser id is
// stamped into metadata; when the business pays, the Stripe webhook flips that
// ad to `active` automatically (see app/api/stripe/webhook/route.ts).
//
// Admin-gated server-side: we verify the caller's token AND that their email is
// in app_admins before minting a payment link — a link is a request for money,
// so it must never be generatable by a non-admin.
export type AdCheckoutResult = { url: string } | { error: string };

export async function createAdCheckoutSession(input: {
  accessToken: string;
  advertiserId: string;
  amountCents: number;
}): Promise<AdCheckoutResult> {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!stripe) return { error: "Stripe isn't configured." };
  if (!supabase || !supabaseAdmin)
    return { error: "Supabase isn't fully configured (service role required)." };
  if (!base)
    return { error: "Set NEXT_PUBLIC_SITE_URL to enable checkout redirects." };

  const amount = Math.round(input.amountCents);
  if (!(amount >= 100)) return { error: "Enter an amount of at least $1.00." };

  // Verify the caller is a signed-in admin.
  const { data, error: authErr } = await supabase.auth.getUser(input.accessToken);
  const user = data?.user;
  if (authErr || !user?.email) return { error: "Please sign in first." };
  const { data: adminRow } = await supabaseAdmin
    .from("app_admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();
  if (!adminRow) return { error: "Only admins can create pay links." };

  // Look up the ad so the checkout line item names the business.
  const { data: ad } = await supabaseAdmin
    .from("advertisers")
    .select("id, business_name")
    .eq("id", input.advertiserId)
    .maybeSingle();
  if (!ad) return { error: "That ad no longer exists." };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: { name: `Dogedin ad — ${ad.business_name}` },
          },
        },
      ],
      // The webhook keys off this to activate the right ad on payment.
      metadata: { advertiser_id: ad.id },
      success_url: `${base}/admin/ads?paid=1`,
      cancel_url: `${base}/admin/ads`,
    });
    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    return { url: session.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Checkout failed." };
  }
}
