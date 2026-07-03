import { supabase } from "@/lib/supabase";
import { DOG_PHOTO_BUCKET, dogPhotoUrl } from "@/lib/dogProfiles";

// Data layer for the dog photo feed (see supabase/schema.sql § 6). Every post
// goes through the `moderate-photo` Edge Function before it's public.

const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MB
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type PostStatus = "pending" | "approved" | "rejected";

export type DogPost = {
  id: string;
  dogId: string;
  photoUrl: string | null;
  caption: string | null;
  status: PostStatus;
  createdAt: string;
};

type PostRow = {
  id: string;
  dog_id: string;
  photo_path: string;
  caption: string | null;
  moderation_status: PostStatus;
  created_at: string;
};

function toDogPost(d: PostRow): DogPost {
  return {
    id: d.id,
    dogId: d.dog_id,
    photoUrl: dogPhotoUrl(d.photo_path),
    caption: d.caption,
    status: d.moderation_status,
    createdAt: d.created_at,
  };
}

export function validatePhoto(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Photo must be a JPG, PNG or WEBP.";
  if (file.size > MAX_PHOTO_BYTES) return "Photo must be 3 MB or smaller.";
  return null;
}

const POST_COLUMNS = "id, dog_id, photo_path, caption, moderation_status, created_at";

export async function listApprovedPosts(dogId: string, limit = 24): Promise<DogPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("dog_posts")
    .select(POST_COLUMNS)
    .eq("dog_id", dogId)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(toDogPost);
}

// Every status, owner-only (RLS). Lets the owner see pending/rejected posts.
export async function listOwnPosts(dogId: string): Promise<DogPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("dog_posts")
    .select(POST_COLUMNS)
    .eq("dog_id", dogId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map(toDogPost);
}

// Uploads the photo, inserts a 'pending' post, then kicks off moderation.
// If moderation can't be reached, the post simply stays 'pending' (owner-only
// visibility) rather than defaulting public — see moderate-photo/index.ts.
export async function createPost(
  userId: string,
  dogId: string,
  photo: File,
  caption: string
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase isn't configured." };
  const bad = validatePhoto(photo);
  if (bad) return { error: bad };

  const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/posts/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(DOG_PHOTO_BUCKET)
    .upload(path, photo, { contentType: photo.type, upsert: false });
  if (upErr) return { error: `Photo upload failed: ${upErr.message}` };

  const { data: post, error: insErr } = await supabase
    .from("dog_posts")
    .insert({ dog_id: dogId, photo_path: path, caption: caption.trim().slice(0, 300) || null })
    .select("id")
    .single();
  if (insErr || !post) {
    await supabase.storage.from(DOG_PHOTO_BUCKET).remove([path]);
    return { error: `Couldn't save the post: ${insErr?.message ?? "unknown error"}` };
  }

  await retryModeration(post.id);
  return { error: null };
}

export async function retryModeration(postId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.functions.invoke("moderate-photo", { body: { post_id: postId } });
  } catch {
    // Moderation unavailable — the post stays 'pending' until retried.
  }
}

export async function likeCounts(postIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (!supabase || postIds.length === 0) return counts;
  const { data } = await supabase.from("post_likes").select("post_id").in("post_id", postIds);
  for (const row of data ?? []) counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
  return counts;
}

export async function myLikes(dogId: string, postIds: string[]): Promise<Set<string>> {
  if (!supabase || postIds.length === 0) return new Set();
  const { data } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("dog_id", dogId)
    .in("post_id", postIds);
  return new Set((data ?? []).map((r) => r.post_id));
}

export async function toggleLike(postId: string, dogId: string, currentlyLiked: boolean): Promise<void> {
  if (!supabase) return;
  if (currentlyLiked) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("dog_id", dogId);
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, dog_id: dogId });
  }
}

export async function reportPost(postId: string, reporterDogId: string, reason: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Not configured" };
  const { error } = await supabase
    .from("post_reports")
    .insert({ post_id: postId, reporter_dog_id: reporterDogId, reason: reason.trim().slice(0, 500) || null });
  return { error: error?.message ?? null };
}

export type PawpularityEntry = { slug: string; dogName: string; photoUrl: string | null; pawCount: number };

// "Pawpularity contest" — top dogs by total paws (post_likes) across their
// approved posts. See breed_counts() for the sibling /dogs stat.
export async function getPawpularityLeaderboard(limit = 10): Promise<PawpularityEntry[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("pawpularity_leaderboard", { p_limit: limit });
    if (error || !data) return [];
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return (data as any[]).map((d) => ({
      slug: d.slug,
      dogName: d.dog_name,
      photoUrl: dogPhotoUrl(d.photo_path),
      pawCount: Number(d.paw_count),
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch {
    return [];
  }
}
