"use server";

import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  AD_SPECS,
  adRunDays,
  adTotalCents,
  type AdPlacement,
} from "@/lib/ads";

const AD_CREATIVE_BUCKET = "ad-creatives";

// Self-serve paid-ad flow. The browser uploads the creative to the
// ad-creatives bucket first, then calls this. We moderate the creative with
// Claude BEFORE taking any money (so nobody is charged for content we'd
// reject), then — if it's clean — create an `approved` advertiser row and a
// Stripe Checkout session. Paying it flips the ad to `active` via the existing
// webhook (metadata.advertiser_id), and public_ads only serves it inside its
// booked date window. Moderation fails CLOSED: if Claude is unavailable we fall
// back to a manual-review `applied` row and DON'T charge — we never auto-charge
// or auto-publish an unreviewed ad.
export type PaidAdResult =
  | { url: string } // go pay — the ad goes live automatically once paid
  | { rejected: true } // creative failed moderation; nothing charged
  | { queued: true } // moderation unavailable; sent for manual review, no charge
  | { error: string };

export async function submitPaidAd(input: {
  businessName: string;
  contactName: string;
  email: string;
  placement: AdPlacement;
  linkUrl: string;
  startsAt: string;
  endsAt: string;
  imagePath: string;
  imageUrl: string;
  mobileImagePath: string | null;
  mobileImageUrl: string | null;
}): Promise<PaidAdResult> {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!stripe) return { error: "Payments aren't set up yet." };
  if (!supabaseAdmin)
    return { error: "Server isn't fully configured (service role required)." };
  if (!base) return { error: "Set NEXT_PUBLIC_SITE_URL to enable checkout." };

  // Re-validate everything server-side — never trust the client for money.
  if (!(input.placement in AD_SPECS)) return { error: "Pick a valid spot." };
  if (!input.businessName.trim() || !input.email.trim())
    return { error: "Business name and email are required." };
  if (!/^https?:\/\//i.test(input.linkUrl.trim()))
    return { error: "Add a valid destination link (https://…)." };
  if (!input.imagePath || !input.imageUrl)
    return { error: "Upload your creative first." };
  const days = adRunDays(input.startsAt, input.endsAt);
  if (days < 1)
    return { error: "Pick your run dates (end on or after the start)." };
  const amount = adTotalCents(input.placement, days);
  if (amount < 100) return { error: "That run is under the $1.00 minimum." };

  const mobilePaths = [input.mobileImagePath].filter(Boolean) as string[];

  // 1. Moderate the creative. Fails closed to manual review (never auto-live).
  let verdict: string | null = null;
  try {
    const { data, error } = await supabaseAdmin.functions.invoke("moderate-ad", {
      body: { image_path: input.imagePath },
    });
    if (error) throw error;
    verdict = (data as { verdict?: string } | null)?.verdict ?? null;
  } catch {
    verdict = null; // unavailable → manual fallback below
  }

  if (verdict === "rejected") {
    // Don't keep an inappropriate creative in the public bucket; nothing charged.
    await supabaseAdmin.storage
      .from(AD_CREATIVE_BUCKET)
      .remove([input.imagePath, ...mobilePaths]);
    return { rejected: true };
  }

  const rowBase = {
    business_name: input.businessName.trim().slice(0, 120),
    image_url: input.imageUrl,
    mobile_image_url: input.mobileImageUrl,
    link_url: input.linkUrl.trim(),
    placement: input.placement,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    weight: 1,
    contact_email: input.email.trim().slice(0, 120),
    active: false,
  };

  // 2a. Moderation unavailable → manual admin review, no charge.
  if (verdict !== "approved") {
    await supabaseAdmin
      .from("advertisers")
      .insert({ ...rowBase, status: "applied" });
    return { queued: true };
  }

  // 2b. Approved → create the row (approved, awaiting payment) + a checkout.
  const { data: row, error: insErr } = await supabaseAdmin
    .from("advertisers")
    .insert({ ...rowBase, status: "approved", moderation_status: "approved" })
    .select("id")
    .single();
  if (insErr || !row) return { error: "Couldn't file your ad — please try again." };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: `Dogedin ad — ${rowBase.business_name} (${days} day${days === 1 ? "" : "s"})`,
            },
          },
        },
      ],
      customer_email: input.email.trim() || undefined,
      // The webhook keys off this to activate the right ad on payment.
      metadata: { advertiser_id: row.id },
      success_url: `${base}/advertise?paid=1`,
      cancel_url: `${base}/advertise?canceled=1`,
    });
    if (!session.url) return { error: "Stripe didn't return a checkout URL." };
    return { url: session.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Checkout failed." };
  }
}

// Admin-only: refund a paid ad's Stripe payment and take it down. Verifies the
// caller is a signed-in admin, refunds the stored PaymentIntent in full, then
// disables the ad and stamps refunded_at. Moving money out must never be
// callable by a non-admin.
export type RefundResult = { ok: true } | { error: string };

export async function refundAd(input: {
  accessToken: string;
  advertiserId: string;
}): Promise<RefundResult> {
  if (!stripe) return { error: "Stripe isn't configured." };
  if (!supabase || !supabaseAdmin)
    return { error: "Supabase isn't fully configured (service role required)." };

  const { data, error: authErr } = await supabase.auth.getUser(input.accessToken);
  const user = data?.user;
  if (authErr || !user?.email) return { error: "Please sign in first." };
  const { data: adminRow } = await supabaseAdmin
    .from("app_admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();
  if (!adminRow) return { error: "Only admins can refund." };

  const { data: ad } = await supabaseAdmin
    .from("advertisers")
    .select("id, paid_at, stripe_payment_ref, refunded_at")
    .eq("id", input.advertiserId)
    .maybeSingle();
  if (!ad) return { error: "That ad no longer exists." };
  if (ad.refunded_at) return { error: "This ad has already been refunded." };
  if (!ad.paid_at || !ad.stripe_payment_ref)
    return { error: "No recorded payment to refund." };
  if (!ad.stripe_payment_ref.startsWith("pi_"))
    return {
      error:
        "Payment reference isn't a PaymentIntent — refund it in the Stripe dashboard.",
    };

  try {
    await stripe.refunds.create({ payment_intent: ad.stripe_payment_ref });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Refund failed." };
  }

  await supabaseAdmin
    .from("advertisers")
    .update({
      status: "disabled",
      active: false,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", input.advertiserId);
  return { ok: true };
}
