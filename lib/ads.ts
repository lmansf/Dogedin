// Local-business ad slots. Advertisers live in the `advertisers` Supabase table
// (managed at /admin/ads — no code changes to add/remove one). AdSlot fetches
// active rows client-side from the public_ads view (display columns only);
// impressions/clicks are tracked via SECURITY DEFINER RPCs.

export type Ad = {
  id: string;
  businessName: string;
  imageUrl: string;
  linkUrl: string;
  weight: number;
};

// Weighted-random pick so higher-weight advertisers show more often. Returns
// null for an empty list.
export function pickWeighted(ads: Ad[]): Ad | null {
  if (ads.length === 0) return null;
  const total = ads.reduce((sum, a) => sum + Math.max(0, a.weight), 0);
  // All weights 0 → everything is paused; show nothing rather than a 0-weight ad.
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const ad of ads) {
    r -= Math.max(0, ad.weight);
    if (r <= 0) return ad;
  }
  return ads[ads.length - 1];
}
