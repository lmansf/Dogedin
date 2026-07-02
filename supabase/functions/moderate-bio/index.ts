// Fun-fact moderation + cleanup. The registration form sends the owner's raw
// "fun fact" here BEFORE inserting the dog, and stores what comes back:
//   { cleaned: "Tidied, family-friendly text" }   — use it
//   { cleaned: null }                              — inappropriate; store no bio
// The model fixes spelling/grammar, trims rambles, keeps the owner's voice,
// and rejects profanity, contact info, links, and spam — protecting both the
// public dog page and the Instagram captions built from this text.
//
// Model is env-swappable (MODERATION_MODEL). To use a serverless Hugging Face
// model instead, this fetch is the only thing to change — see
// docs/instagram-pipeline.md § Fun-fact moderation.
import {
  corsHeaders,
  json,
  requireUser,
  serviceClient,
} from "../_shared/mod.ts";

const SYSTEM =
  "You clean up 'fun fact' blurbs that dog owners submit about their dogs for " +
  "a family-friendly community website in Dunedin, Florida. Fix spelling and " +
  "grammar, trim rambling, and keep the owner's playful voice. Write about the " +
  "dog in third person, at most 200 characters. Do NOT invent facts that were " +
  "not provided. If the submission contains profanity, sexual or violent " +
  "content, hate or harassment, personal contact details (phone numbers, " +
  "emails, addresses), URLs, or advertising/spam, respond with exactly: " +
  "REJECTED. Otherwise respond ONLY with the cleaned text — no preamble, no " +
  "quotes.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const service = serviceClient();
  if (!(await requireUser(req, service))) {
    return json(401, { error: "Sign in to submit a fun fact" });
  }

  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 500) : "";
  if (!text) return json(400, { error: "Missing text" });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("MODERATION_MODEL") ?? "claude-haiku-4-5",
      max_tokens: 150,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json(502, { error: `Moderation unavailable: ${res.status} ${detail.slice(0, 200)}` });
  }

  const data = await res.json();
  // A safety refusal on user-submitted text is itself a strong reject signal.
  if (data.stop_reason === "refusal") return json(200, { cleaned: null });

  const textBlock = (data.content ?? []).find(
    (b: { type: string }) => b.type === "text",
  );
  const out = textBlock?.text?.trim() ?? "";
  if (!out || out.toUpperCase().startsWith("REJECTED")) {
    return json(200, { cleaned: null });
  }
  return json(200, { cleaned: out.slice(0, 300) });
});
