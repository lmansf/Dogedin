import { supabase } from "@/lib/supabase";
import { DEMO_BUSINESSES } from "@/lib/demoBusinesses";

// "Things to do in Dunedin" domain model. A curated set of local businesses
// (restaurants, breweries, parks, beaches) that customers can review, upvote,
// and reply to. Businesses live in the `businesses` Supabase table; reviews and
// their replies hang off it. ONLY when Supabase isn't configured at all do we
// fall back to the demo seed (lib/demoBusinesses.ts) so the page works out of
// the box - a configured backend that's empty or erroring returns no
// businesses rather than fake ones.

// A partner discount surfaced directly on a business's reviews. Populated once a
// business is matched to a real-world listing (see `placeId`); null for plain
// community entries. This is what lets us advertise deals on the reviews later.
export type BusinessOffer = {
  label: string; // e.g. "$1 off pints"
  detail: string; // e.g. "Show this review at the bar"
  code: string | null; // optional promo code
};

export type Reply = {
  id: string;
  reviewId: string;
  author: string;
  body: string;
  createdAt: string; // ISO date
};

export type Review = {
  id: string;
  businessId: string;
  author: string;
  rating: number; // 1-5
  body: string;
  upvotes: number;
  createdAt: string; // ISO date
  replies: Reply[];
};

// One day's hours. open/close are "HH:MM" 24h strings, both null when closed.
export type DayHours = { open: string | null; close: string | null; closed: boolean };
export type BusinessHours = Record<
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
  DayHours
>;

export const DAYS_OF_WEEK: (keyof BusinessHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Fixed category list for the submission form's dropdown and the site's
// category badges — keeps /things-to-do groupable instead of free-text sprawl.
export const BUSINESS_CATEGORIES = [
  "Restaurant",
  "Cafe",
  "Brewery / Bar",
  "Beach",
  "Park / Trail",
  "Retail / Shop",
  "Vet",
  "Groomer",
  "Service",
  "Other",
] as const;

// The directory's home turf, in display order: Dunedin first, then the ring of
// neighbor towns working outward. Listings from anywhere else sort after these
// (alphabetically by city) rather than being rejected — the guide grows out
// from Dunedin, it isn't fenced to it.
export const DIRECTORY_CITIES = [
  "Dunedin",
  "Clearwater",
  "Palm Harbor",
  "Tarpon Springs",
] as const;

export function cityRank(city: string): number {
  const i = (DIRECTORY_CITIES as readonly string[]).indexOf(city);
  return i === -1 ? DIRECTORY_CITIES.length : i;
}

export type Business = {
  id: string;
  slug: string;
  name: string;
  category: string; // Brewery, Beach, Restaurant, Park, Cafe, Shop, Vet, ...
  city: string; // "Dunedin", "Clearwater", ... — drives the guide's town order
  neighborhood: string;
  description: string;
  image: string; // self-hosted asset path, or a business-photos storage URL
  dogFriendly: boolean;
  phone: string | null;
  website: string | null;
  address: string | null; // street address, used to build map directions links
  hours: BusinessHours | null;
  // Forward-looking: a stable reference to the real-world place (Google Place
  // id, partner id, ...). Null until a business is matched. Enables offers.
  placeId: string | null;
  offer: BusinessOffer | null;
  reviews: Review[];
};

// Universal deep links that work without a Google Place id — just the street
// address, URL-encoded. Opens the native app on mobile, maps.google.com /
// maps.apple.com in a browser otherwise.
export function googleMapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
export function appleMapsDirectionsUrl(address: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
}

// True when a Supabase backend is configured, i.e. submissions/upvotes/replies
// actually persist. When false the page runs in read-only "preview" mode off
// the demo seed and interactions update the session only.
export function persistenceEnabled(): boolean {
  return supabase !== null;
}

// Sort helpers so the UI is deterministic: most-upvoted (then newest) reviews
// first, oldest-first replies (conversation order).
function byUpvotesThenNew(a: Review, b: Review) {
  return b.upvotes - a.upvotes || b.createdAt.localeCompare(a.createdAt);
}

// Guide ordering: reward review activity — most reviews first, highest average
// rating as the tiebreak (then name, so equal listings are stable). This is
// what makes leaving reviews move a business up the page, which is the whole
// point of the review-for-discount loop.
export function byReviewTraffic(a: Business, b: Business) {
  return (
    b.reviews.length - a.reviews.length ||
    averageRating(b.reviews) - averageRating(a.reviews) ||
    a.name.localeCompare(b.name)
  );
}

// Guide page ordering: Dunedin's listings lead, then each neighbor town in
// ring order (see DIRECTORY_CITIES), review activity deciding the order within
// a town. Towns beyond the ring sort alphabetically so the order stays stable
// as the directory spreads.
export function byCityThenReviewTraffic(a: Business, b: Business) {
  return (
    cityRank(a.city) - cityRank(b.city) ||
    a.city.localeCompare(b.city) ||
    byReviewTraffic(a, b)
  );
}

export async function getBusinesses(): Promise<Business[]> {
  if (!supabase) return [...DEMO_BUSINESSES].sort(byCityThenReviewTraffic);
  try {
    // public_businesses is a view (approved listings, no owner contact info) —
    // fetched separately from reviews rather than via a PostgREST embed, since
    // embedding relies on a real foreign key to the base table that a view
    // doesn't reliably carry.
    const { data: businesses, error } = await supabase
      .from("public_businesses")
      .select(
        "id, slug, name, category, city, neighborhood, description, image, dog_friendly, phone, website, address, hours, place_id, offer, created_at"
      )
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getBusinesses: public_businesses query failed:", error.message);
      return [];
    }
    // A configured-but-empty guide is honestly empty — no demo fallback.
    if (!businesses || businesses.length === 0) return [];

    const ids = businesses.map((b) => b.id);
    const { data: reviewRows } = await supabase
      .from("reviews")
      .select(
        "id, business_id, author, rating, body, upvotes, created_at, review_replies ( id, review_id, author, body, created_at )"
      )
      .in("business_id", ids);

    const reviewsByBusiness = new Map<string, unknown[]>();
    for (const r of reviewRows ?? []) {
      const businessId = (r as { business_id: string }).business_id;
      const list = reviewsByBusiness.get(businessId) ?? [];
      list.push(r);
      reviewsByBusiness.set(businessId, list);
    }

    // Dunedin first, then the town ring; most-reviewed first within a town —
    // see byCityThenReviewTraffic. The query's created_at order only decides
    // ties between listings with the same city, review count and rating.
    return businesses
      .map((b) => mapBusinessRow(b, reviewsByBusiness.get(b.id) ?? []))
      .sort(byCityThenReviewTraffic);
  } catch (err) {
    // Table/view may not exist yet, network hiccup, etc. Log and show nothing
    // rather than pretending demo businesses are real listings.
    console.error("getBusinesses: unexpected failure:", err);
    return [];
  }
}

// A single listing by its stable slug, for the per-business permalink page
// (/things-to-do/[slug]). Returns null when it isn't found or isn't approved —
// the view only exposes approved listings. Falls back to the demo seed only
// when Supabase isn't configured, matching getBusinesses().
export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  if (!supabase) return DEMO_BUSINESSES.find((b) => b.slug === slug) ?? null;
  try {
    const { data: row, error } = await supabase
      .from("public_businesses")
      .select(
        "id, slug, name, category, city, neighborhood, description, image, dog_friendly, phone, website, address, hours, place_id, offer, created_at"
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error || !row) return null;

    const { data: reviewRows } = await supabase
      .from("reviews")
      .select(
        "id, business_id, author, rating, body, upvotes, created_at, review_replies ( id, review_id, author, body, created_at )"
      )
      .eq("business_id", row.id);

    return mapBusinessRow(row, reviewRows ?? []);
  } catch (err) {
    console.error("getBusinessBySlug: unexpected failure:", err);
    return null;
  }
}

// Lightweight slug list for the sitemap — just approved listings' slugs and
// created dates, no reviews. Empty (not demo) when Supabase isn't configured,
// so the sitemap never advertises demo permalinks that 404 in production.
export async function listBusinessSlugs(): Promise<
  { slug: string; createdAt: string | null }[]
> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("public_businesses")
      .select("slug, created_at");
    if (error || !data) return [];
    return data.map((r) => ({
      slug: r.slug as string,
      createdAt: (r.created_at as string) ?? null,
    }));
  } catch {
    return [];
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Map a Supabase row (snake_case) plus its separately-fetched reviews onto our
// camelCase domain types.
function mapBusinessRow(row: any, reviewRows: any[]): Business {
  const reviews: Review[] = reviewRows
    .map(
      (r: any): Review => ({
        id: r.id,
        businessId: r.business_id,
        author: r.author,
        rating: r.rating,
        body: r.body,
        upvotes: r.upvotes ?? 0,
        createdAt: String(r.created_at).slice(0, 10),
        replies: (r.review_replies ?? [])
          .map(
            (p: any): Reply => ({
              id: p.id,
              reviewId: p.review_id,
              author: p.author,
              body: p.body,
              createdAt: String(p.created_at).slice(0, 10),
            })
          )
          .sort((a: Reply, b: Reply) => a.createdAt.localeCompare(b.createdAt)),
      })
    )
    .sort(byUpvotesThenNew);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    // Pre-city rows (and the demo seed) are all Dunedin businesses.
    city: row.city ?? "Dunedin",
    neighborhood: row.neighborhood ?? "",
    description: row.description ?? "",
    image: row.image ?? "",
    dogFriendly: row.dog_friendly ?? false,
    phone: row.phone ?? null,
    website: row.website ?? null,
    address: row.address ?? null,
    hours: row.hours ?? null,
    placeId: row.place_id ?? null,
    offer: row.offer ?? null,
    reviews,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Average star rating for a business, rounded to one decimal. 0 when no reviews.
export function averageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

// The community's current favourite: the highest-rated business, ties broken
// by review count. Null when there are no businesses at all, so nothing gets
// "featured" in a configured-but-empty environment. Static pages should read
// this through lib/topBusiness.ts, which caches the lookup.
export async function getTopBusiness(): Promise<Business | null> {
  const businesses = await getBusinesses();
  if (businesses.length === 0) return null;
  return [...businesses].sort(
    (a, b) =>
      averageRating(b.reviews) - averageRating(a.reviews) ||
      b.reviews.length - a.reviews.length
  )[0];
}

/* -------------------------------------------------------------------------- */
/* Self-service submission (/list-your-business)                              */
/* -------------------------------------------------------------------------- */

export const BUSINESS_PHOTO_BUCKET = "business-photos";
const MAX_BUSINESS_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const BUSINESS_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateBusinessPhoto(file: File): string | null {
  if (!BUSINESS_PHOTO_TYPES.includes(file.type)) return "Photo must be a JPG, PNG or WEBP.";
  if (file.size > MAX_BUSINESS_PHOTO_BYTES) return "Photo must be 5 MB or smaller.";
  return null;
}

function businessPhotoUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUSINESS_PHOTO_BUCKET}/${path}`;
}

// Turn a business name into a URL-safe slug stem — a short random suffix is
// appended at insert time so two "Main Street Cafe"s don't collide.
function slugStem(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "business"
  );
}

function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

export const EMPTY_HOURS: BusinessHours = DAYS_OF_WEEK.reduce((acc, day) => {
  acc[day] = { open: "09:00", close: "17:00", closed: false };
  return acc;
}, {} as BusinessHours);

export type BusinessSubmission = {
  name: string;
  category: string;
  city: string;
  neighborhood: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  dogFriendly: boolean;
  hours: BusinessHours;
  ownerName: string;
  ownerEmail: string;
  photo: File;
};

// Uploads the card photo, then inserts the listing as 'pending' (RLS enforces
// that status regardless of what's sent — see supabase/schema.sql). Retries
// on a slug collision the same way dog registration does. Returns the new
// listing's id (minted client-side — the anon insert policy can't read the row
// back) so the form can trigger the welcome-business email.
export async function submitBusiness(
  input: BusinessSubmission
): Promise<{ error: string | null; businessId?: string }> {
  if (!supabase) return { error: "Supabase isn't configured." };
  const bad = validateBusinessPhoto(input.photo);
  if (bad) return { error: bad };

  const ext = input.photo.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUSINESS_PHOTO_BUCKET)
    .upload(path, input.photo, { contentType: input.photo.type, upsert: false });
  if (upErr) return { error: `Photo upload failed: ${upErr.message}` };

  const imageUrl = businessPhotoUrl(path);
  const cleanupPhoto = async () => {
    await supabase!.storage.from(BUSINESS_PHOTO_BUCKET).remove([path]);
  };
  if (!imageUrl) {
    await cleanupPhoto();
    return { error: "Supabase isn't configured." };
  }

  const stem = slugStem(input.name);
  const businessId = crypto.randomUUID();
  const base = {
    id: businessId,
    name: input.name.trim(),
    category: input.category,
    city: input.city.trim() || "Dunedin",
    neighborhood: input.neighborhood.trim() || null,
    description: input.description.trim(),
    address: input.address.trim(),
    phone: input.phone.trim() || null,
    website: input.website.trim() || null,
    dog_friendly: input.dogFriendly,
    hours: input.hours,
    owner_name: input.ownerName.trim(),
    owner_email: input.ownerEmail.trim(),
    image: imageUrl,
    status: "pending",
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = `${stem}-${randomSuffix()}`;
    const { error: insErr } = await supabase.from("businesses").insert({ ...base, slug });
    if (!insErr) return { error: null, businessId };
    if (insErr.code !== "23505") {
      await cleanupPhoto();
      return { error: `Couldn't submit: ${insErr.message}` };
    }
    // 23505 = unique violation on slug -> try a fresh one.
  }
  await cleanupPhoto();
  return { error: "Couldn't generate a unique listing link — please try again." };
}

export type ClaimSubmission = {
  businessId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  role?: string;
  message?: string;
};

// "Claim this business" lead. Low-friction (no account needed): anyone may
// insert, forced to status 'new' by RLS, exactly like an ad inquiry. An admin
// verifies by phone / in person, then links the listing to this email so the
// claimant gets portal access. Rows land in business_claims — the same table
// the shop's admin desk reads, so a claim from either surface shows up in one
// running list.
export async function submitClaim(
  input: ClaimSubmission
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Claims aren't connected yet — please try again later." };
  const { error } = await supabase.from("business_claims").insert({
    business_id: input.businessId,
    business_name: input.businessName.slice(0, 120),
    contact_name: input.contactName.trim().slice(0, 80),
    email: input.email.trim().slice(0, 120),
    phone: input.phone.trim().slice(0, 40),
    role: input.role?.trim().slice(0, 80) || null,
    message: input.message?.trim().slice(0, 2000) || null,
    status: "new",
  });
  if (error) return { error: "Couldn't submit that — please try again." };
  return { error: null };
}
