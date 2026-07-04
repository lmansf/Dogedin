import { supabase } from "@/lib/supabase";
import { dogPhotoUrl } from "@/lib/dogProfiles";

// Data layer for the dog-friends graph (see supabase/schema.sql § 6). Dogs act
// through their owner's authenticated session — RLS enforces that a caller
// can only send/respond to requests for a dog they own.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MyDog = { id: string; slug: string; dogName: string; photoPath: string | null };
export type Friend = { friendshipId: string; dogId: string; slug: string; dogName: string; photoPath: string | null };
export type IncomingRequest = {
  id: string;
  requesterDogId: string;
  slug: string;
  dogName: string;
  photoPath: string | null;
};
export type RelationshipStatus = "none" | "pending-outgoing" | "pending-incoming" | "accepted";
export type FriendshipEdge = { status: RelationshipStatus; friendshipId: string | null };

// Dogs owned by the signed-in caller (RLS restricts to auth.uid() = user_id).
export async function myDogs(): Promise<MyDog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("dog_profiles")
    .select("id, slug, dog_name, photo_path")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((d) => ({ id: d.id, slug: d.slug, dogName: d.dog_name, photoPath: d.photo_path }));
}

async function hydrateDogs(ids: string[]) {
  const map = new Map<string, { slug: string; dogName: string; photoPath: string | null }>();
  if (!supabase || ids.length === 0) return map;
  const { data } = await supabase
    .from("public_dog_profiles")
    .select("id, slug, dog_name, photo_path")
    .in("id", ids);
  for (const d of data ?? []) map.set(d.id, { slug: d.slug, dogName: d.dog_name, photoPath: dogPhotoUrl(d.photo_path) });
  return map;
}

// A dog's accepted friendships. RLS keeps dog_friendships private to the two
// owners involved (plus admins), so this returns rows only when the caller
// owns dogId — call it for the owner's own dog, never for visitors.
export async function listFriends(dogId: string): Promise<Friend[]> {
  if (!supabase || !UUID_RE.test(dogId)) return [];
  const { data, error } = await supabase
    .from("dog_friendships")
    .select("id, requester_dog_id, recipient_dog_id")
    .eq("status", "accepted")
    .or(`requester_dog_id.eq.${dogId},recipient_dog_id.eq.${dogId}`);
  if (error || !data || data.length === 0) return [];

  const otherIds = data.map((f) => (f.requester_dog_id === dogId ? f.recipient_dog_id : f.requester_dog_id));
  const dogs = await hydrateDogs(otherIds);
  const friends: Friend[] = [];
  for (const f of data) {
    const otherId = f.requester_dog_id === dogId ? f.recipient_dog_id : f.requester_dog_id;
    const dog = dogs.get(otherId);
    if (dog) friends.push({ friendshipId: f.id, dogId: otherId, ...dog });
  }
  return friends;
}

// Pending requests sent TO dogId — RLS only returns these to that dog's owner.
export async function listIncomingRequests(dogId: string): Promise<IncomingRequest[]> {
  if (!supabase || !UUID_RE.test(dogId)) return [];
  const { data, error } = await supabase
    .from("dog_friendships")
    .select("id, requester_dog_id")
    .eq("recipient_dog_id", dogId)
    .eq("status", "pending");
  if (error || !data || data.length === 0) return [];

  const dogs = await hydrateDogs(data.map((f) => f.requester_dog_id));
  const requests: IncomingRequest[] = [];
  for (const f of data) {
    const dog = dogs.get(f.requester_dog_id);
    if (dog) requests.push({ id: f.id, requesterDogId: f.requester_dog_id, ...dog });
  }
  return requests;
}

// Existing relationship between two dogs (either direction) — decides which
// button to show: add friend / pending / accept / already friends. Also
// returns the row id so a non-owner viewer can unfriend without needing the
// (owner-only) friends list. RLS still resolves this for the viewer because
// they own one of the two dogs on the edge being asked about.
export async function friendshipBetween(dogA: string, dogB: string): Promise<FriendshipEdge> {
  if (!supabase || !UUID_RE.test(dogA) || !UUID_RE.test(dogB)) return { status: "none", friendshipId: null };
  // A pair can have more than one historical row (e.g. a declined request
  // followed by a fresh one), so this reads all of them rather than
  // .maybeSingle() — which errors (and was silently swallowed as "none") the
  // moment a second row exists.
  const { data } = await supabase
    .from("dog_friendships")
    .select("id, requester_dog_id, status")
    .or(`and(requester_dog_id.eq.${dogA},recipient_dog_id.eq.${dogB}),and(requester_dog_id.eq.${dogB},recipient_dog_id.eq.${dogA})`);
  if (!data || data.length === 0) return { status: "none", friendshipId: null };
  const accepted = data.find((f) => f.status === "accepted");
  if (accepted) return { status: "accepted", friendshipId: accepted.id };
  const pending = data.find((f) => f.status === "pending");
  if (!pending) return { status: "none", friendshipId: null };
  return {
    status: pending.requester_dog_id === dogA ? "pending-outgoing" : "pending-incoming",
    friendshipId: pending.id,
  };
}

export async function friendshipStatus(dogA: string, dogB: string): Promise<RelationshipStatus> {
  return (await friendshipBetween(dogA, dogB)).status;
}

export async function sendFriendRequest(fromDogId: string, toDogId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Not configured" };
  // Guard against a duplicate/reverse row (e.g. both owners request at once,
  // or a stale button click) — not airtight against a true race, but covers
  // the common case without a DB-level uniqueness constraint on direction.
  const existing = await friendshipStatus(fromDogId, toDogId);
  if (existing !== "none") return { error: null };
  const { error } = await supabase
    .from("dog_friendships")
    .insert({ requester_dog_id: fromDogId, recipient_dog_id: toDogId });
  return { error: error?.message ?? null };
}

export async function respondToRequest(friendshipId: string, accept: boolean): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Not configured" };
  const { error } = await supabase
    .from("dog_friendships")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", friendshipId);
  return { error: error?.message ?? null };
}

export async function removeFriendship(friendshipId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Not configured" };
  const { error } = await supabase.from("dog_friendships").delete().eq("id", friendshipId);
  return { error: error?.message ?? null };
}
