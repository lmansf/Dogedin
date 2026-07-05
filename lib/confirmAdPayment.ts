import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Belt-and-suspenders ad activation. The Stripe webhook is the primary path
// that flips a paid ad live, but a misconfigured/slow webhook would leave a
// genuinely-paid ad stuck at "approved". So when the buyer returns from Checkout
// (success_url carries the session id), we verify the payment straight with
// Stripe and activate the ad ourselves — no webhook required.
//
// Safe + idempotent: only a session Stripe reports as actually paid activates,
// only its own advertiser (from the session metadata), and only while the row
// hasn't already been marked paid — so it never double-stamps or reactivates a
// refunded/disabled ad that was already handled.
export async function confirmAdPaymentBySession(sessionId: string): Promise<void> {
  if (!stripe || !supabaseAdmin || !sessionId) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return;
    const advertiserId = session.metadata?.advertiser_id;
    if (!advertiserId) return;

    await supabaseAdmin
      .from("advertisers")
      .update({
        status: "active",
        active: true,
        paid_at: new Date().toISOString(),
        stripe_payment_ref:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.id,
      })
      .eq("id", advertiserId)
      .is("paid_at", null); // only the first confirmation activates + stamps
  } catch {
    // Best-effort — the webhook remains the primary activation path.
  }
}
