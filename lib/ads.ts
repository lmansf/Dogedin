import { supabase } from "@/lib/supabase";

// Local-business ad slots. Advertisers live in the `advertisers` Supabase table
// (managed at /admin/ads — no code changes to add/remove one). Impressions and
// clicks are tracked via SECURITY DEFINER RPCs so the public key never writes
// the table directly. Returns [] when Supabase isn't configured.

export type Ad = {
  id: string;
  businessName: string;
  imageUrl: string;
  linkUrl: string;
  weight: number;
};

export async function getActiveAds(): Promise<Ad[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("advertisers")
      .select("id, business_name, image_url, link_url, weight")
      .eq("active", true);
    if (error || !data) return [];
    return data.map((a) => ({
      id: a.id,
      businessName: a.business_name,
      imageUrl: a.image_url,
      linkUrl: a.link_url,
      weight: a.weight ?? 1,
    }));
  } catch {
    return [];
  }
}

// Weighted-random pick so higher-weight advertisers show more often. Returns
// null for an empty list.
export function pickWeighted(ads: Ad[]): Ad | null {
  if (ads.length === 0) return null;
  const total = ads.reduce((sum, a) => sum + Math.max(0, a.weight), 0);
  if (total <= 0) return ads[Math.floor(Math.random() * ads.length)];
  let r = Math.random() * total;
  for (const ad of ads) {
    r -= Math.max(0, ad.weight);
    if (r <= 0) return ad;
  }
  return ads[ads.length - 1];
}
