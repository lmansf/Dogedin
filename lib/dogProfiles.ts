import { supabase } from "@/lib/supabase";

// Data layer for Phase 1 dog profiles. Public reads only: the profile page and
// search hit the privilege-gated view / RPC (see supabase/dogs.sql), so nothing
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
        "id, slug, dog_name, breed, photo_path, lost_contact_opt_in, owner_phone, owner_email"
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      slug: data.slug,
      dogName: data.dog_name,
      breed: data.breed,
      photoPath: data.photo_path,
      lostContactOptIn: data.lost_contact_opt_in,
      ownerPhone: data.owner_phone ?? null,
      ownerEmail: data.owner_email ?? null,
    };
  } catch {
    return null;
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
