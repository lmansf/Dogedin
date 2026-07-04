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
  "Service",
  "Other",
] as const;

export type Business = {
  id: string;
  slug: string;
  name: string;
  category: string; // Brewery, Beach, Restaurant, Park, Cafe, Shop, ...
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

export async function getBusinesses(): Promise<Business[]> {
  if (!supabase) return DEMO_BUSINESSES;
  try {
    // public_businesses is a view (approved listings, no owner contact info) —
    // fetched separately from reviews rather than via a PostgREST embed, since
    // embedding relies on a real foreign key to the base table that a view
    // doesn't reliably carry.
    const { data: businesses, error } = await supabase
      .from("public_businesses")
      .select(
        "id, slug, name, category, neighborhood, description, image, dog_friendly, phone, website, address, hours, place_id, offer, created_at"
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

    return businesses.map((b) => mapBusinessRow(b, reviewsByBusiness.get(b.id) ?? []));
  } catch (err) {
    // Table/view may not exist yet, network hiccup, etc. Log and show nothing
    // rather than pretending demo businesses are real listings.
    console.error("getBusinesses: unexpected failure:", err);
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
// on a slug collision the same way dog registration does.
export async function submitBusiness(input: BusinessSubmission): Promise<{ error: string | null }> {
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
  const base = {
    name: input.name.trim(),
    category: input.category,
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
    if (!insErr) return { error: null };
    if (insErr.code !== "23505") {
      await cleanupPhoto();
      return { error: `Couldn't submit: ${insErr.message}` };
    }
    // 23505 = unique violation on slug -> try a fresh one.
  }
  await cleanupPhoto();
  return { error: "Couldn't generate a unique listing link — please try again." };
}
