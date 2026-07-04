import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhook — the source of truth for membership status. Verifies the
// signature, then upserts the members row using the service-role client (RLS
// bypass). The browser can only READ its own row; it never writes status.
export async function POST(req: Request) {
  if (!stripe || !supabaseAdmin) {
    return new Response("Payments not configured", { status: 500 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;

        // Ad-slot payment: an admin generated a pay link for an approved ad
        // (see createAdCheckoutSession), which stamps the advertiser id into
        // metadata. When the business pays, flip the ad live automatically —
        // this is the "auto-update once paid" path, no manual toggle needed.
        const advertiserId = s.metadata?.advertiser_id as string | undefined;
        if (advertiserId) {
          await supabaseAdmin
            .from("advertisers")
            .update({
              status: "active",
              active: true,
              // Record the payment reference for the console/audit trail.
              paid_at: new Date().toISOString(),
              stripe_payment_ref:
                typeof s.payment_intent === "string" ? s.payment_intent : s.id,
            })
            .eq("id", advertiserId);
          break;
        }

        const userId =
          (s.metadata?.supabase_user_id as string | undefined) ??
          (s.client_reference_id ?? undefined);
        if (userId) {
          await supabaseAdmin.from("members").upsert(
            {
              user_id: userId,
              member_name: s.customer_details?.name ?? null,
              stripe_customer_id:
                typeof s.customer === "string" ? s.customer : null,
              stripe_subscription_id:
                typeof s.subscription === "string" ? s.subscription : null,
              status: "active",
              // card_code is intentionally omitted — the DB default generates it
              // once on insert and it must stay stable across retries.
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id", ignoreDuplicates: false }
          );
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id as string | undefined;
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : sub.status === "active" || sub.status === "trialing"
              ? "active"
              : sub.status === "past_due"
                ? "past_due"
                : "inactive";
        // Prefer the user id from metadata, but fall back to matching the stored
        // subscription id so a cancellation still downgrades the member even if
        // the event lacks our metadata (dashboard edits, portal changes, etc.).
        const query = supabaseAdmin
          .from("members")
          .update({ status, updated_at: new Date().toISOString() });
        await (userId
          ? query.eq("user_id", userId)
          : query.eq("stripe_subscription_id", sub.id));
        break;
      }
    }
  } catch {
    // Log-and-200 would drop retries; 500 tells Stripe to retry.
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok");
}
