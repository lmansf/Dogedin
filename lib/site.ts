// Sitewide copy shared across pages so duplicated strings can't drift apart.

// The rotated sticker badge on the home and shop heroes — one string, two pages.
export const HERO_BADGE = "🐾 Dunedin, Florida · dog-first community";

// Canonical origin for absolute URLs (metadata, sitemap, robots, JSON-LD).
// NEXT_PUBLIC_SITE_URL is the source of truth once the production domain is
// attached in Vercel; the fallback keeps preview builds producing valid URLs.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://dogedin.com"
).replace(/\/+$/, "");

export const SITE_NAME = "Dogedin";

// One description, reused by the root metadata and the Organization JSON-LD.
export const SITE_DESCRIPTION =
  "The dog-owner community of Dunedin, Florida: dog profiles, lost-dog tags, a dog-friendly local guide and events on the Gulf coast — plus a wee shop that keeps the lights on.";
