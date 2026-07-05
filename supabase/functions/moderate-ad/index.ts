// Ad-creative moderation for the self-serve advertising flow. The Next server
// action (app/advertise/actions.ts) uploads the creative to the ad-creatives
// bucket, then calls this with the service role to get a verdict BEFORE it
// takes any payment — so a business is never charged for a creative that would
// be rejected. Mirrors moderate-photo's Claude-vision approach but with an
// ad-appropriate policy, and it only reports a verdict (approved/rejected); the
// caller owns creating the advertiser row + checkout. Fails loud (non-200) so
// the caller can fall back to manual review rather than silently auto-approving.
import {
  corsHeaders,
  isServiceRole,
  json,
} from "../_shared/mod.ts";

const SYSTEM =
  "You moderate advertising creatives submitted to a family-friendly local " +
  "dog-community website in Dunedin, Florida. APPROVE ordinary local-business " +
  "ads — shops, cafés, breweries, restaurants, groomers, vets, trainers, " +
  "patios, events and services — that are suitable for a general audience, " +
  "even if plainly designed. REJECT nudity or sexual content, graphic violence " +
  "or gore, hate symbols, clearly illegal or heavily age-restricted goods " +
  "(drugs, weapons, gambling, vaping/tobacco), obvious scams or deceptive " +
  "'you won'-style claims, and anything unsafe or inappropriate for a public " +
  "family website. A normal local business ad — including a brewery or bar — is " +
  "fine. Respond with exactly one word: APPROVED or REJECTED.";

const BUCKET = "ad-creatives";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Only the server (self-serve ad flow) calls this, with the service role.
  if (!isServiceRole(req)) return json(401, { error: "Service role required" });

  const body = await req.json().catch(() => ({}));
  const imagePath = typeof body?.image_path === "string" ? body.image_path : "";
  if (!imagePath) return json(400, { error: "Missing image_path" });

  const base = Deno.env.get("SUPABASE_URL")!;
  const imgRes = await fetch(
    `${base}/storage/v1/object/public/${BUCKET}/${imagePath}`,
  );
  if (!imgRes.ok) return json(502, { error: "Couldn't fetch creative" });
  const contentType = imgRes.headers.get("content-type") ?? "image/png";
  const bytes = new Uint8Array(await imgRes.arrayBuffer());

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model:
        Deno.env.get("PHOTO_MODERATION_MODEL") ??
        Deno.env.get("MODERATION_MODEL") ??
        "claude-haiku-4-5",
      max_tokens: 10,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: contentType, data: toBase64(bytes) },
            },
            { type: "text", text: "Moderate this ad creative." },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json(502, { error: `Moderation unavailable: ${res.status} ${detail.slice(0, 200)}` });
  }

  const data = await res.json();
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === "text");
  const verdict = textBlock?.text?.trim().toUpperCase() ?? "";
  const approved = data.stop_reason !== "refusal" && verdict.startsWith("APPROVED");

  return json(200, { verdict: approved ? "approved" : "rejected" });
});
