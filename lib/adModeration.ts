// Server-side ad-creative moderation via Claude vision. Called by submitPaidAd
// (app/advertise/actions.ts) BEFORE any payment, so nobody is charged for a
// creative that would be rejected. Runs in the Next server (same place as the
// checkout) rather than a Supabase Edge Function — that removes the
// service-role-JWT / functions-gateway auth entirely; all it needs is
// ANTHROPIC_API_KEY in the app's own environment (Vercel).
//
// Returns "approved" | "rejected" | "error". "error" (key missing, API down,
// image unfetchable) makes the caller fall back to MANUAL review and NOT charge
// — moderation is a gate that fails closed, never an auto-approve on failure.

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

export type AdVerdict = "approved" | "rejected" | "error";

export async function moderateAdImage(imageUrl: string): Promise<AdVerdict> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("moderateAdImage: ANTHROPIC_API_KEY is not set in the app env");
    return "error";
  }

  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.error("moderateAdImage: couldn't fetch creative", imgRes.status, imageUrl);
      return "error";
    }
    const contentType = imgRes.headers.get("content-type") ?? "image/png";
    const b64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

    // Canonical dated id; override with MODERATION_MODEL if the account needs a
    // different one (a bare "claude-haiku-4-5" alias isn't guaranteed to resolve).
    const model = process.env.MODERATION_MODEL ?? "claude-haiku-4-5-20251001";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: contentType, data: b64 },
              },
              { type: "text", text: "Moderate this ad creative." },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("moderateAdImage: Anthropic error", res.status, model, detail.slice(0, 300));
      return "error";
    }

    const data = await res.json();
    const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === "text");
    const verdict = textBlock?.text?.trim().toUpperCase() ?? "";
    const approved = data.stop_reason !== "refusal" && verdict.startsWith("APPROVED");
    console.log("moderateAdImage: verdict", { model, approved, raw: verdict });
    return approved ? "approved" : "rejected";
  } catch (e) {
    console.error("moderateAdImage: failed", e);
    return "error";
  }
}
