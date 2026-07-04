import { unstable_cache } from "next/cache";
import { getTopBusiness } from "@/lib/businesses";

// Cached lookup of the top-rated business, shared by the layout marquee's
// "TOP OF THE PACK" line and the home page's FeaturedBusiness card so the two
// always name the same spot. Lives apart from lib/businesses.ts because
// next/cache is server-only and that module is imported by client components.
//
// 5-minute revalidate: new reviews shift the featured spot without a redeploy,
// while every route rendered within a window shares a single Supabase fetch.
// The root layout's matching `revalidate = 300` is what re-renders the
// otherwise-static pages that bake this value into their HTML.
export const getTopBusinessCached = unstable_cache(getTopBusiness, ["top-business"], {
  revalidate: 300,
});
