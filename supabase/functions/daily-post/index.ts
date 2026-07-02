// Dog of the day — the once-a-day pipeline tick (pg_cron → here).
//
// 1. PUBLISH: if an APPROVED post is waiting (oldest first) and nothing has
//    been published in the last ~20h, publish it to Instagram. Admin approval
//    happens ahead of time on /admin/posts; this tick keeps the daily rhythm.
// 2. DRAFT: if the queue has no PENDING draft, pick the oldest registered dog
//    (dog_profiles.created_at asc) that has a photo and has never been queued,
//    generate a caption with Claude (fixed hashtags appended in code), insert
//    it as 'pending', and notify the admin.
//
// Auth: the pg_cron job calls with the service-role key. Admins may also
// invoke it from /admin/posts with {"draft_only": true} to pull the next
// draft forward without publishing.
import {
  corsHeaders,
  generateCaption,
  isServiceRole,
  json,
  notifyAdmin,
  publishQueueRow,
  requireAdmin,
  serviceClient,
} from "../_shared/mod.ts";

const ONCE_A_DAY_GUARD_MS = 20 * 3600 * 1000; // "once a day" with cron jitter room

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const service = serviceClient();
  if (!isServiceRole(req) && !(await requireAdmin(req, service))) {
    return json(401, { error: "Not authorised" });
  }

  const body = await req.json().catch(() => ({}));
  const draftOnly = Boolean(body?.draft_only);
  const summary: Record<string, unknown> = {};

  // ---- 1. Publish the oldest approved post (unless drafting only) ----------
  if (!draftOnly) {
    const { data: lastPublished } = await service
      .from("post_queue")
      .select("published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const recentEnough =
      lastPublished?.published_at &&
      Date.now() - new Date(lastPublished.published_at).getTime() <
        ONCE_A_DAY_GUARD_MS;

    if (recentEnough) {
      summary.publish = "skipped — already posted in the last day";
    } else {
      const { data: next } = await service
        .from("post_queue")
        .select("id, caption, photo_url, dog_id")
        .eq("status", "approved")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!next) {
        summary.publish = "skipped — no approved post waiting";
      } else {
        const result = await publishQueueRow(service, next);
        summary.publish = result.ok
          ? `published ${result.mediaId}`
          : `failed: ${result.error}`;
        if (!result.ok && !result.rateLimited) {
          await notifyAdmin(
            `🚨 Dogedin: today's Instagram post failed — ${result.error}. Retry from /admin/posts.`,
          );
        }
      }
    }
  }

  // ---- 2. Draft the next post if the review queue is empty -----------------
  const { count: pendingCount } = await service
    .from("post_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if ((pendingCount ?? 0) > 0) {
    summary.draft = "skipped — a draft is already awaiting review";
    return json(200, summary);
  }

  // Every dog that has ever been queued (any status) is out of the running:
  // published/pending/approved are done or in flight; rejected means the admin
  // decided not to feature that dog.
  const { data: queuedRows } = await service.from("post_queue").select("dog_id");
  const queuedIds = new Set((queuedRows ?? []).map((r) => r.dog_id));

  const { data: dogs, error: dogsErr } = await service
    .from("dog_profiles")
    .select("id, dog_name, breed, bio, photo_path, created_at")
    .not("photo_path", "is", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (dogsErr) return json(500, { ...summary, draft: `failed: ${dogsErr.message}` });

  const nextDog = (dogs ?? []).find((d) => !queuedIds.has(d.id));
  if (!nextDog) {
    summary.draft = "skipped — every registered dog with a photo has been queued";
    return json(200, summary);
  }

  try {
    const caption = await generateCaption(nextDog);
    const photoUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/dog-photos/${nextDog.photo_path}`;

    const { error: insErr } = await service.from("post_queue").insert({
      dog_id: nextDog.id,
      caption,
      photo_url: photoUrl,
    });
    if (insErr) return json(500, { ...summary, draft: `failed: ${insErr.message}` });

    summary.draft = `drafted ${nextDog.dog_name}`;
    await notifyAdmin(
      `🐶 Dogedin: tomorrow's dog of the day is ${nextDog.dog_name} — review the caption at /admin/posts.`,
    );
  } catch (e) {
    // Caption generation failed — no row inserted; the next tick retries the
    // same dog.
    summary.draft = `failed: ${e instanceof Error ? e.message : String(e)}`;
    return json(500, summary);
  }

  return json(200, summary);
});
