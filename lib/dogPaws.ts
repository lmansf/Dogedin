import { supabase } from "@/lib/supabase";

// Data layer for profile-level paws (see supabase/schema.sql § 6, dog_paws).
// One paw per signed-in USER per dog — separate from post_likes, which paw
// individual photos and are keyed by acting dog. Who pawed is never exposed:
// direct reads return only the caller's own rows (RLS), and the public tally
// comes from the dog_paw_count() SECURITY DEFINER function.

export async function getDogPawCount(dogId: string): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.rpc("dog_paw_count", { p_dog_id: dogId });
    if (error || data == null) return 0;
    return Number(data);
  } catch {
    return 0;
  }
}

// Whether the signed-in caller has pawed this dog (always false when anon —
// RLS returns no rows).
export async function hasPawedDog(dogId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase
    .from("dog_paws")
    .select("dog_id")
    .eq("dog_id", dogId)
    .maybeSingle();
  return !!data;
}

export async function toggleDogPaw(
  dogId: string,
  currentlyPawed: boolean
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Not configured" };
  if (currentlyPawed) {
    // RLS scopes the delete to the caller's own row.
    const { error } = await supabase.from("dog_paws").delete().eq("dog_id", dogId);
    return { error: error?.message ?? null };
  }
  // user_id defaults to auth.uid() server-side.
  const { error } = await supabase.from("dog_paws").insert({ dog_id: dogId });
  // 23505 = already pawed (double-click / stale state) — treat as success.
  if (error && error.code === "23505") return { error: null };
  return { error: error?.message ?? null };
}
