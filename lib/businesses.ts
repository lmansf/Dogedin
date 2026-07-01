import { supabase } from "@/lib/supabase";
import { DEMO_BUSINESSES } from "@/lib/demoBusinesses";

// "Things to do in Dunedin" domain model. A curated set of local businesses
// (restaurants, breweries, parks, beaches) that customers can review, upvote,
// and reply to. Businesses live in the `businesses` Supabase table; reviews and
// their replies hang off it. When Supabase isn't configured we fall back to the
// demo seed (lib/demoBusinesses.ts) so the page works out of the box - same
// pattern as the Shopify/demo-catalog split on the storefront.

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

export type Business = {
  id: string;
  slug: string;
  name: string;
  category: string; // Brewery, Beach, Restaurant, Park, Cafe, Shop, ...
  neighborhood: string;
  description: string;
  image: string; // self-hosted path under /public, e.g. /assets/spots/foo.svg
  dogFriendly: boolean;
  // Forward-looking: a stable reference to the real-world place (Google Place
  // id, partner id, ...). Null until a business is matched. Enables offers.
  placeId: string | null;
  offer: BusinessOffer | null;
  reviews: Review[];
};

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
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id, slug, name, category, neighborhood, description, image, dog_friendly, place_id, offer, " +
          "reviews ( id, business_id, author, rating, body, upvotes, created_at, " +
          "review_replies ( id, review_id, author, body, created_at ) )"
      )
      .eq("active", true);

    if (error || !data || data.length === 0) return DEMO_BUSINESSES;
    return data.map(mapBusinessRow);
  } catch {
    // Table may not exist yet, network hiccup, etc. Degrade to the demo seed.
    return DEMO_BUSINESSES;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Map a Supabase row (snake_case, nested) onto our camelCase domain types.
function mapBusinessRow(row: any): Business {
  const reviews: Review[] = (row.reviews ?? [])
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
