import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Monthly price for the per-business insights subscription, in cents. Lives in
// env so repricing is a config change; the display label on the portal is
// NEXT_PUBLIC_INSIGHTS_PRICE_LABEL over there. Keep the two in sync.
const MONTHLY_CENTS =
  parseInt(process.env.INSIGHTS_MONTHLY_CENTS ?? "", 10) || 1500;

// Where the buyer lands after checkout — the business portal on the media-kit
// site. Falls back to the main site so an unset env is never a dead end.
function portalUrl(): string {
  const raw =
    process.env.BUSINESS_PORTAL_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return raw.replace(/\/$/, "");
}

// Starts a Stripe subscription checkout for one business's insights plan.
// GET so the portal (a separate deployment) can link to it directly:
// /api/insights/checkout?business=<uuid>. No auth needed to PAY — anyone
// paying for a business's insights is welcome; VIEWING them still requires
// signing in with the listing's owner_email (see business_insights() in
// supabase/schema.sql § 8). The webhook + portal-return both key off
// metadata.business_insights_id to activate the subscription row.
export async function GET(req: NextRequest) {
  if (!stripe || !supabaseAdmin) {
    return new Response("Payments aren't configured.", { status: 500 });
  }
  const businessId = req.nextUrl.searchParams.get("business") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
    return new Response("Missing or invalid business id.", { status: 400 });
  }

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id, name, status, owner_email")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz || biz.status !== "approved") {
    return new Response("Business not found.", { status: 404 });
  }

  const portal = portalUrl();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: MONTHLY_CENTS,
            recurring: { interval: "month" },
            product_data: {
              name: `Dogedin Business Insights — ${biz.name}`,
            },
          },
        },
      ],
      customer_email: biz.owner_email || undefined,
      // Both places so the webhook can resolve the business from the session
      // AND from later subscription lifecycle events (renewal failure, cancel).
      metadata: { business_insights_id: biz.id },
      subscription_data: { metadata: { business_insights_id: biz.id } },
      // Success routes through /api/insights/confirm on THIS site first, which
      // verifies the payment and activates the row webhook-independently, then
      // forwards to the portal.
      success_url: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/api/insights/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${portal}/portal?sub=canceled`,
    });
    if (!session.url) return new Response("Stripe error.", { status: 502 });
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    console.error("insights checkout failed:", e);
    return new Response("Couldn't start checkout — try again shortly.", {
      status: 502,
    });
  }
}
