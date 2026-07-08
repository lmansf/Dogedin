import { supabase } from "@/lib/supabase";

// Data layer for Phase 1 dog profiles. Public reads only: the profile page and
// search hit the privilege-gated view / RPC (see supabase/schema.sql), so nothing
// here can leak contact info or owner names. Owner-side reads/writes happen in
// the client components using the authenticated Supabase session + RLS.

export const DOG_PHOTO_BUCKET = "dog-photos";

// A public dog profile. Contact fields are non-null only when the owner turned
// on the "lost dog contact" toggle.
export type PublicDog = {
  id: string;
  slug: string;
  dogName: string;
  breed: string | null;
  bio: string | null;
  photoPath: string | null;
  lostContactOptIn: boolean;
  ownerPhone: string | null;
  ownerEmail: string | null;
};

export type DogSearchResult = {
  slug: string;
  dogName: string;
  breed: string | null;
  photoPath: string | null;
  hasContact: boolean;
};

// A pack-roster row: a public dog plus its profile-paw tally and real UUID
// (so cards can render a live paw button). Powers both the "Meet the pack"
// carousel and the "Top of the pack" most-pawed rail.
export type PackDogRow = {
  id: string;
  slug: string;
  dogName: string;
  breed: string | null;
  bio: string | null;
  photoPath: string | null;
  hasContact: boolean;
  pawCount: number;
};

// Build the public URL for a stored dog photo. Storage bucket is public-read, so
// this is a plain object URL (no signing). Returns null when there's no photo.
export function dogPhotoUrl(path: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/${DOG_PHOTO_BUCKET}/${path}`;
}

export async function getPublicDog(slug: string): Promise<PublicDog | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("public_dog_profiles")
      .select(
        "id, slug, dog_name, breed, bio, photo_path, lost_contact_opt_in, owner_phone, owner_email"
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      slug: data.slug,
      dogName: data.dog_name,
      breed: data.breed,
      bio: data.bio ?? null,
      photoPath: data.photo_path,
      lostContactOptIn: data.lost_contact_opt_in,
      ownerPhone: data.owner_phone ?? null,
      ownerEmail: data.owner_email ?? null,
    };
  } catch {
    return null;
  }
}

// Shared reader for the pack_dogs RPC (public view + paw tallies, no contact
// data). sort='paws' ranks by profile-paw count; 'recent' is newest-first.
// Returns [] when Supabase is absent or the pack is still empty — carousel
// callers fall back to the mascot roster.
async function fetchPackDogs(
  sort: "recent" | "paws",
  limit: number
): Promise<PackDogRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("pack_dogs", {
      p_sort: sort,
      p_limit: limit,
    });
    if (error || !data) return [];
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return (data as any[]).map((d) => ({
      id: d.id,
      slug: d.slug,
      dogName: d.dog_name,
      breed: d.breed,
      bio: d.bio ?? null,
      photoPath: d.photo_path,
      hasContact: d.has_contact,
      pawCount: Number(d.paw_count) || 0,
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch {
    return [];
  }
}

// Most recently registered dogs, for the homepage "Meet the pack" carousel.
export function listRecentDogs(limit = 8): Promise<PackDogRow[]> {
  return fetchPackDogs("recent", limit);
}

// Every public profile slug, for the sitemap. Reads the same public view as
// the profile page (approved public data only). [] when Supabase is absent or
// anything fails — the sitemap then simply lists the static routes.
export async function listDogSlugs(
  limit = 5000
): Promise<{ slug: string; createdAt: string }[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("public_dog_profiles")
      .select("slug, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((d) => ({ slug: d.slug, createdAt: d.created_at }));
  } catch {
    return [];
  }
}

// Resolve a physical tag code (typed in, or read from a QR that points at
// /found?tag=CODE) to a profile slug. Returns null if no dog carries that code.
export async function resolveTag(code: string): Promise<string | null> {
  const c = code.trim();
  if (!supabase || c.length < 2) return null;
  try {
    const { data, error } = await supabase.rpc("resolve_tag", { code: c });
    if (error || !data) return null;
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

export type BreedCount = { breed: string; count: number };

// Community-wide breed tally, for the /dogs "breed leaderboard" bar chart.
// breed_counts() is SECURITY DEFINER (reads across all dogs, not just the
// caller's own), but only ever returns a breed label + a count — no owner or
// contact data, same privacy bar as public_dog_profiles.
export async function getBreedCounts(): Promise<BreedCount[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("breed_counts");
    if (error || !data) return [];
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return (data as any[]).map((d) => ({ breed: d.breed, count: Number(d.dog_count) }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch {
    return [];
  }
}

export async function searchDogs(query: string): Promise<DogSearchResult[]> {
  const q = query.trim();
  if (!supabase || q.length < 2) return [];
  try {
    const { data, error } = await supabase.rpc("search_dogs", { q });
    if (error || !data) return [];
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return (data as any[]).map((d) => ({
      slug: d.slug,
      dogName: d.dog_name,
      breed: d.breed,
      photoPath: d.photo_path,
      hasContact: d.has_contact,
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch {
    return [];
  }
}
