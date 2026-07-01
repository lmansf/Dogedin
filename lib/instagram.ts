// Auto-pulled Instagram feed via the official Instagram Graph API. Requires a
// linked Instagram *Business/Creator* account and a Facebook app token — set:
//   INSTAGRAM_ACCESS_TOKEN   (long-lived token)
//   INSTAGRAM_USER_ID        (the IG business account id)
//   NEXT_PUBLIC_INSTAGRAM_HANDLE  (e.g. "dogedin" — used for the fallback link)
//
// With the token unset we return null and the UI shows a "follow us" card, so
// there's no manual copy-paste and nothing breaks before it's configured.
// Note: Instagram Basic Display was retired; this uses the Graph API endpoint.

export type InstagramPost = {
  id: string;
  caption: string | null;
  mediaUrl: string;
  permalink: string;
  isVideo: boolean;
};

export async function getInstagramPosts(limit = 8): Promise<InstagramPost[] | null> {
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
