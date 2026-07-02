// Manual publish: an admin's "Publish now" button on /admin/posts. Takes a
// post_queue id whose status is 'approved' or 'failed' (retry) and runs the
// Instagram content-publishing flow. Deliberately bypasses the once-a-day
// guard (a human pressed the button) but still respects IG's daily cap.
import {
  corsHeaders,
  isServiceRole,
  json,
  publishQueueRow,
  requireAdmin,
  serviceClient,
} from "../_shared/mod.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const service = serviceClient();
  if (!isServiceRole(req) && !(await requireAdmin(req, service))) {
    return json(401, { error: "Not authorised" });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return json(400, { error: "Missing post id" });

  const { data: row, error } = await service
    .from("post_queue")
    .select("id, caption, photo_url, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return json(404, { error: "Post not found" });
  if (row.status !== "approved" && row.status !== "failed") {
    return json(409, { error: `Post is '${row.status}' — approve it first` });
  }

  const result = await publishQueueRow(service, row);
  if (!result.ok) {
    return json(result.rateLimited ? 429 : 502, { error: result.error });
  }
  return json(200, { mediaId: result.mediaId, permalink: result.permalink });
});
