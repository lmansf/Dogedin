// Emails a just-listed business a link to its portal dashboard, right after
// the /list-your-business form inserts the row. Mirrors notify-ad-inquiry:
// unauthenticated calls are accepted (the submit form is anonymous), but the
// function only ever emails the owner_email already stored on the one row it's
// told about — and welcome_sent_at makes it one-shot, so repeated calls can't
// be used to spam an owner. Best-effort / fails open: a failed send leaves the
// listing untouched for the admin queue, and without RESEND_API_KEY it no-ops.
import { corsHeaders, json, serviceClient } from "../_shared/mod.ts";

const RESEND_API = "https://api.resend.com/emails";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json(200, { skipped: "RESEND_API_KEY not configured" });

  const body = await req.json().catch(() => ({}));
  const businessId = typeof body?.business_id === "string" ? body.business_id : "";
  if (!businessId) return json(400, { error: "Missing business_id" });

  const service = serviceClient();
  const { data: biz, error } = await service
    .from("businesses")
    .select("id, name, owner_name, owner_email, welcome_sent_at")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !biz) return json(404, { error: "Business not found" });
  if (!biz.owner_email) return json(200, { skipped: "no owner email" });

  // Already welcomed (retry / duplicate call) — no-op.
  if (biz.welcome_sent_at) return json(200, { status: "already sent" });

  const portal =
    (Deno.env.get("BUSINESS_PORTAL_URL") ?? "").replace(/\/$/, "") ||
    "https://dogedin-media-kit.vercel.app";
  const from = Deno.env.get("AD_INQUIRY_FROM_EMAIL") || "Dogedin <onboarding@resend.dev>";
  const name = escapeHtml(biz.name);
  const firstName = escapeHtml((biz.owner_name ?? "").split(" ")[0] || "there");

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [biz.owner_email],
      subject: `${biz.name} is on Dogedin — here's your business dashboard 🐾`,
      html:
        `<p>Hi ${firstName},</p>` +
        `<p>Thanks for listing <strong>${name}</strong> on Dogedin — Dunedin's dog community. ` +
        `Our team reviews every listing before it appears in the local guide (usually within a day).</p>` +
        `<p><strong>Your personalized business dashboard is ready:</strong></p>` +
        `<p><a href="${portal}/portal" ` +
        `style="display:inline-block;background:#1fa89b;color:#f4e9ce;font-weight:bold;` +
        `padding:12px 20px;border:3px solid #211e18;text-decoration:none">` +
        `Open my dashboard &rarr;</a></p>` +
        `<p>Sign in — or create your account — with <strong>this email address</strong> ` +
        `(the one you listed with). It's the same login as dogedin.com, so if you already ` +
        `have a Dogedin account, just use it.</p>` +
        `<p>You'll see how many dog people view your listing and your reviews at a ` +
        `glance. Once your listing is approved, the counters start automatically.</p>` +
        `<p>🐾 The Dogedin pack<br><a href="${portal}/portal">${portal}/portal</a></p>`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json(502, { error: `Email send failed: ${res.status} ${detail.slice(0, 200)}` });
  }

  await service
    .from("businesses")
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq("id", businessId);

  return json(200, { status: "sent" });
});
