// Photo moderation for the dog-social feed. The client uploads the photo and
// inserts a `dog_posts` row as 'pending' BEFORE calling this — vision models
// can't judge a file that isn't hosted yet. This function fetches the stored
// image, asks Claude to approve/reject it, and flips the row's
// moderation_status. Unlike fun-fact moderation (which fails open to raw
// text), this fails CLOSED: if the call errors, the post just stays 'pending'
// (visible only to its owner) rather than defaulting to public, since photo
// content risk is higher. A rejected photo's storage object is deleted so
// nothing inappropriate lingers in the public bucket.
import {
  corsHeaders,
  json,
  requireUser,
  serviceClient,
} from "../_shared/mod.ts";

const SYSTEM =
  "You moderate photos submitted to a family-friendly dog community website " +
  "in Dunedin, Florida. Approve ordinary photos of dogs (and their owners, " +
  "other pets, or everyday scenes) even if not perfectly framed. Reject " +
  "nudity or sexual content, graphic violence or gore, hate symbols, or " +
  "anything unsafe or inappropriate for a public family website. Respond " +
  "with exactly one word: APPROVED or REJECTED.";

const BUCKET = "dog-photos";

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

  const service = serviceClient();
  const caller = await requireUser(req, service);
  if (!caller) return json(401, { error: "Sign in required" });

  const body = await req.json().catch(() => ({}));
  const postId = typeof body?.post_id === "string" ? body.post_id : "";
  if (!postId) return json(400, { error: "Missing post_id" });

  const { data: post, error: postErr } = await service
    .from("dog_posts")
    .select("id, dog_id, photo_path, moderation_status")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return json(404, { error: "Post not found" });

  // Already decided (e.g. a duplicate/retry call) — no-op, report current state.
  if (post.moderation_status !== "pending") {
    return json(200, { status: post.moderation_status });
  }

  if (caller !== "service") {
    const { data: dog } = await service
      .from("dog_profiles")
      .select("user_id")
      .eq("id", post.dog_id)
      .maybeSingle();
    if (!dog || dog.user_id !== caller) {
      return json(403, { error: "Not your post" });
    }
  }

  const base = Deno.env.get("SUPABASE_URL")!;
  const photoUrl = `${base}/storage/v1/object/public/${BUCKET}/${post.photo_path}`;
  const imgRes = await fetch(photoUrl);
  if (!imgRes.ok) return json(502, { error: "Couldn't fetch photo" });
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
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
            { type: "text", text: "Moderate this photo." },
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

  await service
    .from("dog_posts")
    .update({ moderation_status: approved ? "approved" : "rejected" })
    .eq("id", postId);

  if (!approved) {
    await service.storage.from(BUCKET).remove([post.photo_path]);
  }

  return json(200, { status: approved ? "approved" : "rejected" });
});
