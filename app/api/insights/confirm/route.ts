import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Checkout return leg for Business Insights: verify the payment straight with
// Stripe and activate the subscription row BEFORE bouncing the buyer on to the
// portal — same belt-and-suspenders as ad activation (lib/confirmAdPayment.ts),
// so a slow or misconfigured webhook can't leave a paid subscription stuck.
// Idempotent: re-visiting the URL just re-upserts the same active row.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  const portal = (
    process.env.BUSINESS_PORTAL_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ""
  ).replace(/\/$/, "");

  if (stripe && supabaseAdmin && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const bizId = session.metadata?.business_insights_id;
      if (bizId && session.payment_status === "paid") {
        await supabaseAdmin.from("business_insights_subs").upsert(
          {
            business_id: bizId,
            status: "active",
            stripe_customer_id:
              typeof session.customer === "string" ? session.customer : null,
            stripe_subscription_id:
              typeof session.subscription === "string"
                ? session.subscription
                : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "business_id" }
        );
      }
    } catch (e) {
      // Best-effort — the webhook remains the async backup.
      console.error("insights confirm failed:", e);
    }
  }

  return NextResponse.redirect(`${portal}/portal?sub=success`, 303);
}
