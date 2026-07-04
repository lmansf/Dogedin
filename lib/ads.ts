// Local-business ad slots. Advertisers live in the `advertisers` Supabase table
// (managed at /admin/ads — no code changes to add/remove one). AdSlot fetches
// in-flight rows client-side from the public_ads view (display columns only);
// impressions are viewability-gated and recorded per slot per day alongside
// clicks via SECURITY DEFINER RPCs (record_ad_impression / record_ad_click).
//
// AD PLACEMENT POLICY (the published promise on /advertise — keep in sync):
//   Slots that exist:   home_feed (homepage banner between community sections),
//                       ttd_grid (native card inside the /things-to-do grid),
//                       events_feed (banner under the /events calendar —
//                       dormant while events is "coming soon"; nothing renders it).
//   Permanently ad-free: /found and /dog/[slug] (the lost-dog flow — a scared
//   finder or worried owner must never see an ad), /card (a member's own
//   pocket), /register and /account (people handing us their details).
//   One ad per viewport; every ad is labelled.

export type Ad = {
  id: string;
  businessName: string;
  tagline: string | null;
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
