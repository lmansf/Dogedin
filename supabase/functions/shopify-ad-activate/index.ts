// Auto-fulfilment for ad-space bought as a Shopify product. Shopify fires an
// `orders/paid` webhook here; we find the advertiser the buyer already applied
// with (same email + placement, still 'applied') and flip it live for the days
// they purchased. The buyer's flow is two steps, mirroring the website's paid
// path: (1) apply with a spec'd creative at /pages/advertise, (2) pay for the
// matching ad product using the same email. This closes the loop automatically;
// if it's not deployed, an admin can still activate the ad from the order in
// /pages/ads-admin — so the shop's ad sales work either way.
//
// Auth: Shopify webhooks created via the Admin API don't share a signing secret
// we can see here, so this verifies a shared secret carried on the callback URL
// (`?secret=...`) against WEBHOOK_SECRET. Deploy with `--no-verify-jwt` (Shopify
// can't send a Supabase JWT) and set WEBHOOK_SECRET to a long random string that
// matches the one in the registered webhook URL.
import { json, serviceClient } from "../_shared/mod.ts";

// SKU convention on the ad products: AD-<PLACEMENT>-<DAYS>, e.g. AD-BANNER-28,
// AD-RIBBON-7. Placement must match the ad_placement enum (banner|ribbon).
function parseSku(sku: string | null): { placement: string; days: number } | null {
  if (!sku) return null;
  const m = /^AD-([A-Z]+)-(\d+)$/.exec(sku.trim().toUpperCase());
  if (!m) return null;
  const placement = m[1].toLowerCase();
  const days = parseInt(m[2], 10);
  if (!["banner", "ribbon", "generic"].includes(placement) || !(days > 0)) return null;
  return { placement, days };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const secret = Deno.env.get("WEBHOOK_SECRET");
  const url = new URL(req.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return json(401, { error: "bad secret" });
  }

  const order = await req.json().catch(() => null);
  if (!order) return json(400, { error: "no body" });

  const email: string =
    (order.email || order.contact_email || order.customer?.email || "").toString().trim();
  if (!email) return json(200, { skipped: "no email on order" });

  const lineItems: Array<{ sku: string | null }> = Array.isArray(order.line_items)
    ? order.line_items
    : [];
  // An order can, in theory, contain more than one ad line — activate each.
  const ads = lineItems.map((li) => parseSku(li.sku)).filter(Boolean) as Array<{
    placement: string;
    days: number;
  }>;
  if (!ads.length) return json(200, { skipped: "no ad line items" });

  const service = serviceClient();
  // Start today (UTC). The buyer's requested start, if we ever capture one as a
  // line-item property, could override this; today is the safe default.
  const today = new Date().toISOString().slice(0, 10);
  const activated: string[] = [];

  for (const ad of ads) {
    // Newest matching application the buyer filed for this placement.
    const { data: rows } = await service
      .from("advertisers")
      .select("id, contact_email, placement, status, created_at")
      .ilike("contact_email", email)
      .eq("placement", ad.placement)
      .eq("status", "applied")
      .order("created_at", { ascending: false })
      .limit(1);
    const advertiser = rows?.[0];
    if (!advertiser) continue;

    await service
      .from("advertisers")
      .update({
        status: "active",
        active: true,
        starts_at: today,
        ends_at: addDays(today, Math.max(0, ad.days - 1)),
        paid_at: new Date().toISOString(),
        stripe_payment_ref: `shopify:${order.id ?? order.name ?? ""}`,
      })
      .eq("id", advertiser.id);
    activated.push(advertiser.id);
  }

  return json(200, { activated, count: activated.length });
});
