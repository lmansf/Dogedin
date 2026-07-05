// Emails a copy of a new /advertise inquiry to the Dogedin team as soon as
// it's submitted. The inquiry form is anonymous (anyone can pitch a business
// without signing in), so this function accepts unauthenticated calls and
// only ever reads/sends the one row it's told about — nothing an inquirer
// couldn't already put in the row themselves via the public insert policy.
// Best-effort: if the email fails to send, the inquiry is still safely in
// `ad_inquiries` for an admin to find later, so this fails open.
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
  const inquiryId = typeof body?.inquiry_id === "string" ? body.inquiry_id : "";
  if (!inquiryId) return json(400, { error: "Missing inquiry_id" });

  const service = serviceClient();
  const { data: inquiry, error } = await service
    .from("ad_inquiries")
    .select("id, business_name, contact_name, email, message, notified_at")
    .eq("id", inquiryId)
    .maybeSingle();
  if (error || !inquiry) return json(404, { error: "Inquiry not found" });

  // Already emailed (e.g. a retried/duplicate call) — no-op.
  if (inquiry.notified_at) return json(200, { status: "already notified" });

  // No hardcoded fallback inbox — without an explicitly configured
  // destination this no-ops (the inquiry is already safe in ad_inquiries).
  const to = Deno.env.get("AD_INQUIRY_NOTIFY_EMAIL");
  if (!to) return json(200, { skipped: "AD_INQUIRY_NOTIFY_EMAIL not configured" });
  const from = Deno.env.get("AD_INQUIRY_FROM_EMAIL") || "Dogedin <onboarding@resend.dev>";

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: inquiry.email,
      subject: `New ad inquiry — ${inquiry.business_name}`,
      html:
        `<p><strong>Business:</strong> ${escapeHtml(inquiry.business_name)}</p>` +
        `<p><strong>Contact:</strong> ${escapeHtml(inquiry.contact_name)} ` +
        `(<a href="mailto:${escapeHtml(inquiry.email)}">${escapeHtml(inquiry.email)}</a>)</p>` +
        (inquiry.message
          ? `<p><strong>Message:</strong><br>${escapeHtml(inquiry.message).replace(/\n/g, "<br>")}</p>`
          : ""),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json(502, { error: `Email send failed: ${res.status} ${detail.slice(0, 200)}` });
  }

  await service
    .from("ad_inquiries")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", inquiryId);

  return json(200, { status: "sent" });
});
