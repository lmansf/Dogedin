import { supabase } from "@/lib/supabase";

// The site's Instagram feed. Primary source is the ig_feed_cache table in
// Supabase, refreshed on a schedule by the sync-ig-feed Edge Function — so
// page loads never call the Instagram API and its rate limits don't matter to
// site traffic. When the cache is empty (pipeline not set up yet) we fall back
// to a direct Graph API fetch if INSTAGRAM_ACCESS_TOKEN/INSTAGRAM_USER_ID are
// set, and otherwise return null so the UI shows a "follow us" card.
// Note: Instagram Basic Display was retired; this uses the Graph API endpoint.

export type InstagramPost = {
  id: string;
  caption: string | null;
  mediaUrl: string;
  permalink: string;
  isVideo: boolean;
};

async function getCachedPosts(limit: number): Promise<InstagramPost[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("ig_feed_cache")
      .select("media_id, permalink, media_url, caption, media_type, posted_at")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error || !data || data.length === 0) return null;
    return data
      .map((m) => ({
        id: m.media_id,
        caption: m.caption ?? null,
        mediaUrl: m.media_url ?? "",
        permalink: m.permalink,
        isVideo: m.media_type === "VIDEO",
      }))
      .filter((p) => p.mediaUrl);
  } catch {
    return null;
  }
}

export async function getInstagramPosts(limit = 8): Promise<InstagramPost[] | null> {
  const cached = await getCachedPosts(limit);
  if (cached && cached.length > 0) return cached;

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) return null;

  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink";
  const url = `https://graph.facebook.com/v19.0/${userId}/media?fields=${fields}&limit=${limit}&access_token=${token}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        caption?: string;
        media_type: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink: string;
      }>;
    };
    if (!json.data) return null;
    return json.data
      .map((m) => ({
        id: m.id,
        caption: m.caption ?? null,
        // Videos expose a thumbnail_url; images use media_url.
        mediaUrl: m.thumbnail_url || m.media_url || "",
        permalink: m.permalink,
        isVideo: m.media_type === "VIDEO",
      }))
      .filter((p) => p.mediaUrl);
  } catch {
    return null;
  }
}
