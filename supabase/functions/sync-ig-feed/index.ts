// Refresh ig_feed_cache from the Instagram Graph API (pg_cron, every 30-60min).
// The website reads the cache table — never the IG API — so page loads are
// fast and the API's rate limits are irrelevant to site traffic.
import {
  corsHeaders,
  isServiceRole,
  json,
  requireAdmin,
  serviceClient,
} from "../_shared/mod.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const service = serviceClient();
  if (!isServiceRole(req) && !(await requireAdmin(req, service))) {
    return json(401, { error: "Not authorised" });
  }

  const igUserId = Deno.env.get("IG_USER_ID");
  const token = Deno.env.get("IG_ACCESS_TOKEN");
  if (!igUserId || !token) {
    return json(500, { error: "IG_USER_ID / IG_ACCESS_TOKEN not configured" });
  }

  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media?fields=${fields}&limit=24&access_token=${token}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return json(502, { error: body?.error?.message ?? `IG API HTTP ${res.status}` });
  }

  const media = (await res.json()).data ?? [];
  const rows = media.map((m: Record<string, string | undefined>) => ({
    media_id: m.id,
    permalink: m.permalink,
    // Videos expose thumbnail_url; images use media_url.
    media_url: m.thumbnail_url || m.media_url || null,
    caption: m.caption ?? null,
    media_type: m.media_type ?? null,
    posted_at: m.timestamp ?? null,
    fetched_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await service
      .from("ig_feed_cache")
      .upsert(rows, { onConflict: "media_id" });
    if (error) return json(500, { error: error.message });
  }

  return json(200, { synced: rows.length });
});
