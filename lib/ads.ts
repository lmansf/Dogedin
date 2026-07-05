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

// Placement types (which kind of slot a creative fits) and lifecycle states —
// mirror the ad_placement / ad_status enums in supabase/schema.sql.
export type AdPlacement = "banner" | "ribbon" | "generic";
export type AdStatus = "applied" | "approved" | "active" | "disabled";

export type Ad = {
  id: string;
  businessName: string;
  tagline: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string;
  weight: number;
  placement: AdPlacement;
};

// Creative specs, defined once and enforced at upload (validateAdCreative) and
// shown on the application form so a business knows exactly what to supply.
// Dimensions are exact + ratio-locked; sizes are the brief's proposed defaults
// (owner may adjust these numbers in one place).
export const AD_CREATIVE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AD_CREATIVE_BUCKET = "ad-creatives";

export const AD_SPECS: Record<
  AdPlacement,
  {
    label: string;
    blurb: string;
    width: number;
    height: number;
    maxBytes: number;
    mobile?: { width: number; height: number };
  }
> = {
  banner: {
    label: "Banner",
    blurb: "Leaderboard on the homepage & feeds",
    width: 728,
    height: 90,
    maxBytes: 150 * 1024,
    mobile: { width: 320, height: 100 },
  },
  ribbon: {
    label: "Ribbon",
    blurb: "Full-width strip near the top of the page",
    width: 1200,
    height: 120,
    maxBytes: 120 * 1024,
  },
  generic: {
    label: "Generic slot",
    blurb: "Medium rectangle inside content",
    width: 300,
    height: 250,
    maxBytes: 120 * 1024,
  },
};

// The named, purchasable ad locations a business actually chooses between on
// /advertise — each maps 1:1 to a placement type (which carries the spec) and
// to the on-page slot that serves it. This is the single source of truth for
// the marketing page, the application form, and the admin console, so "the spot
// they inquired about" is the same string everywhere and an approved ad drops
// straight into that location's rotation.
export type AdLocation = {
  id: string; // matches the AdSlot `slot` name that renders it
  name: string; // what the business sees marketed
  where: string; // one line describing where it appears
  placement: AdPlacement; // the shape/spec + how AdSlot filters for it
};

export const AD_LOCATIONS: AdLocation[] = [
  {
    id: "home_feed",
    name: "Homepage spotlight",
    where: "A banner between the community sections on the homepage",
    placement: "banner",
  },
  {
    id: "home_ribbon",
    name: "Homepage ribbon",
    where: "A full-width strip near the top of the homepage",
    placement: "ribbon",
  },
  {
    id: "ttd_grid",
    name: "Local guide featured card",
    where: "A native card inside the Things-to-do grid",
    placement: "generic",
  },
];

// Each live location has a distinct placement, so a placement uniquely names its
// location (used to label an ad in the console by where it runs).
export function locationForPlacement(
  placement: AdPlacement
): AdLocation | undefined {
  return AD_LOCATIONS.find((l) => l.placement === placement);
}

// Reads an image file's pixel dimensions in the browser (used for spec checks).
export function readImageSize(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

// Enforces an ad spec at upload time: format allowlist, byte cap, and exact
// (ratio-locked) dimensions with a ±1% tolerance for encoder rounding. Returns
// a human-readable error string, or null when the file conforms. `variant`
// selects the desktop ("primary") or, for banners, the "mobile" dimensions.
export async function validateAdCreative(
  file: File,
  placement: AdPlacement,
  variant: "primary" | "mobile" = "primary"
): Promise<string | null> {
  const spec = AD_SPECS[placement];
  const target =
    variant === "mobile" && spec.mobile
      ? spec.mobile
      : { width: spec.width, height: spec.height };

  if (!AD_CREATIVE_TYPES.includes(file.type))
    return "Creative must be a JPG, PNG or WebP.";
  if (file.size > spec.maxBytes)
    return `Creative must be ${Math.round(spec.maxBytes / 1024)} KB or smaller (yours is ${Math.round(file.size / 1024)} KB).`;

  let size: { width: number; height: number };
  try {
    size = await readImageSize(file);
  } catch {
    return "Could not read that image — try a different file.";
  }
  const tol = 0.01;
  const fits =
    Math.abs(size.width - target.width) <= Math.max(1, target.width * tol) &&
    Math.abs(size.height - target.height) <= Math.max(1, target.height * tol);
  if (!fits)
    return `Creative must be exactly ${target.width}×${target.height} px (yours is ${size.width}×${size.height} px).`;
  return null;
}

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
