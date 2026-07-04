"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseUser, AuthPanel } from "./auth";
import {
  friendshipBetween,
  listFriends,
  listIncomingRequests,
  myDogs,
  removeFriendship,
  respondToRequest,
  sendFriendRequest,
  type Friend,
  type IncomingRequest,
  type MyDog,
  type RelationshipStatus,
} from "@/lib/dogFriends";
import {
  createPost,
  likeCounts,
  listApprovedPosts,
  listOwnPosts,
  myLikes,
  reportPost,
  retryModeration,
  toggleLike,
  validatePhoto,
  type DogPost,
} from "@/lib/dogPosts";
import { getDogPawCount, hasPawedDog, toggleDogPaw } from "@/lib/dogPaws";

// Friends + paws + photo feed for a dog's public profile. Anonymous visitors
// see approved photos and paw tallies only — the friends LIST is private to
// the dog's owner (RLS hides dog_friendships from everyone else, so it isn't
// even fetched for other viewers). Signed-in owners of ANY dog get an
// "acting as {dog}" identity to friend/photo-paw with; the profile's own
// owner additionally gets the friends list, the upload form, their
// pending/rejected posts, and incoming friend requests. No commenting/DMs —
// friend + paw only for now. Two paw systems: post_likes paw individual
// PHOTOS (per acting dog), dog_paws paw the PROFILE (one per signed-in
// user). "Paw" is UI language for a like — internal code (post_likes,
// toggleLike, likeCounts) keeps its existing names.
export default function DogSocial({
  dogId,
  dogName,
}: {
  dogId: string;
  dogName: string;
}) {
  const { user, loading, configured } = useSupabaseUser();
  const [mine, setMine] = useState<MyDog[]>([]);
  const [actingDogId, setActingDogId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [relationship, setRelationship] = useState<RelationshipStatus>("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [posts, setPosts] = useState<DogPost[]>([]);
  const [ownPosts, setOwnPosts] = useState<DogPost[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [myLikedIds, setMyLikedIds] = useState<Set<string>>(new Set());
  const [pawCount, setPawCount] = useState(0);
  const [pawed, setPawed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const amOwner = mine.some((d) => d.id === dogId);

  const load = useCallback(async () => {
    const [approved, paws] = await Promise.all([listApprovedPosts(dogId), getDogPawCount(dogId)]);
    setPosts(approved);
    setPawCount(paws);
    setLikes(await likeCounts(approved.map((p) => p.id)));

    if (!user) {
      setMine([]);
      setFriends([]);
      setPawed(false);
      return;
    }
    setPawed(await hasPawedDog(dogId));
    const dogs = await myDogs();
    setMine(dogs);
    setActingDogId((prev) => prev ?? dogs.find((d) => d.id !== dogId)?.id ?? dogs[0]?.id ?? null);

    if (dogs.some((d) => d.id === dogId)) {
      // Owner-only: the friends list is private (see lib/dogFriends.ts), so
      // it's never fetched for other viewers.
      const [f, reqs, own] = await Promise.all([
        listFriends(dogId),
        listIncomingRequests(dogId),
        listOwnPosts(dogId),
      ]);
      setFriends(f);
      setIncoming(reqs);
      setOwnPosts(own);
    } else {
      setFriends([]);
    }
    const acting = dogs.find((d) => d.id !== dogId);
    if (acting) {
      const edge = await friendshipBetween(acting.id, dogId);
      setRelationship(edge.status);
      setFriendshipId(edge.friendshipId);
      setMyLikedIds(await myLikes(acting.id, approved.map((p) => p.id)));
    }
  }, [dogId, user]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const doFriendRequest = async () => {
    if (!actingDogId) return;
    setNotice(null);
    const { error } = await sendFriendRequest(actingDogId, dogId);
    if (error) return setNotice(`Couldn't send request: ${error}`);
    setNotice("Friend request sent!");
    setRelationship("pending-outgoing");
  };

  const doRespond = async (friendshipId: string, accept: boolean) => {
    setNotice(null);
    const { error } = await respondToRequest(friendshipId, accept);
    if (error) return setNotice(`Couldn't respond: ${error}`);
    load();
  };

  const doUnfriend = async (id: string) => {
    setNotice(null);
    const { error } = await removeFriendship(id);
    if (error) return setNotice(`Couldn't remove: ${error}`);
    setRelationship("none");
    setFriendshipId(null);
    load();
  };

  // Optimistic profile-paw toggle (one per signed-in user; see lib/dogPaws.ts).
  const doTogglePaw = async () => {
    if (!user) return;
    const was = pawed;
    setPawed(!was);
    setPawCount((c) => Math.max(0, c + (was ? -1 : 1)));
    const { error } = await toggleDogPaw(dogId, was);
    if (error) {
      setPawed(was);
      setPawCount((c) => Math.max(0, c + (was ? 1 : -1)));
      setNotice(`Couldn't update paw: ${error}`);
    }
  };

  const doToggleLike = async (post: DogPost) => {
    if (!actingDogId) return;
    const liked = myLikedIds.has(post.id);
    setMyLikedIds((prev) => {
      const next = new Set(prev);
      liked ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    setLikes((prev) => ({ ...prev, [post.id]: (prev[post.id] ?? 0) + (liked ? -1 : 1) }));
    await toggleLike(post.id, actingDogId, liked);
  };

  if (loading) return null;

  return (
    <div className="flex flex-col gap-6">
      <ProfilePawPanel
        dogName={dogName}
        count={pawCount}
        pawed={pawed}
        canPaw={configured && !!user}
        signedOut={configured && !user}
        onToggle={doTogglePaw}
      />

      {/* The friends LIST is private to the dog's owner. Signed-in visitors
          still get friend-request actions for their own edge with this dog. */}
      {amOwner && <FriendsPanel friends={friends} />}
      {!amOwner && configured && !!user && !!actingDogId && (
        <FriendActions
          relationship={relationship}
          onAdd={doFriendRequest}
          onUnfriend={friendshipId ? () => doUnfriend(friendshipId) : undefined}
        />
      )}

      {amOwner && incoming.length > 0 && (
        <div className="border-[3px] border-black bg-[var(--gold)]/20 p-4 shadow-hard">
          <h3 className="font-display text-lg font-extrabold">Friend requests</h3>
          <div className="mt-2 flex flex-col gap-2">
            {incoming.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <Link href={`/dog/${r.slug}`} className="text-sm font-bold underline">
                  {r.dogName}
                </Link>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => doRespond(r.id, true)}
                    className="border-2 border-black bg-[var(--green)] px-2 py-1 text-[11px] font-black uppercase text-[var(--sand)]"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => doRespond(r.id, false)}
                    className="border-2 border-black bg-white px-2 py-1 text-[11px] font-black uppercase"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {notice && (
        <p className="border-2 border-black bg-[var(--gold)]/25 px-3 py-2 text-sm font-bold">{notice}</p>
      )}

      {amOwner ? (
        <UploadPanel
          userId={user?.id ?? ""}
          dogId={dogId}
          onDone={() => load()}
        />
      ) : (
        !user &&
        configured && (
          <div className="border-2 border-black bg-white p-4">
            <AuthPanel intro={`Sign in to friend ${dogName} and give their photos a paw.`} />
          </div>
        )
      )}

      {amOwner && ownPosts.some((p) => p.status !== "approved") && (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-lg font-extrabold">Your posts under review</h3>
          {ownPosts
            .filter((p) => p.status !== "approved")
            .map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-2 border-black bg-white p-3">
                {p.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="h-14 w-14 shrink-0 border-2 border-black object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className={`border border-black px-1.5 py-0.5 text-[10px] font-black uppercase ${
                      p.status === "rejected" ? "bg-[var(--coral)] text-white" : "bg-[var(--sand)]"
                    }`}
                  >
                    {p.status}
                  </span>
                  {p.caption && <p className="mt-1 truncate text-xs text-black/60">{p.caption}</p>}
                </div>
                {p.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => retryModeration(p.id).then(() => load())}
                    className="border-2 border-black bg-white px-2 py-1 text-[11px] font-black uppercase"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      <PhotoFeed posts={posts} likes={likes} myLikedIds={myLikedIds} canAct={!!actingDogId} onLike={doToggleLike} actingDogId={actingDogId} />
    </div>
  );
}

// Owner-only: the friends list never renders for other viewers (and RLS means
// it couldn't be fetched anyway).
function FriendsPanel({ friends }: { friends: Friend[] }) {
  return (
    <div className="border-[3px] border-black bg-white p-4 shadow-hard">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-extrabold">
          Friends {friends.length > 0 && `(${friends.length})`}
        </h3>
        <span className="text-[10px] font-black uppercase tracking-wide text-black/40">
          🔒 Only you see this
        </span>
      </div>
      {friends.length === 0 ? (
        <p className="mt-2 text-sm text-black/50">
          No friends yet — requests you accept show up here.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {friends.map((f) => (
            <Link
              key={f.friendshipId}
              href={`/dog/${f.slug}`}
              className="flex w-20 flex-col items-center gap-1 text-center"
            >
              <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-black bg-zinc-100">
                {f.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.photoPath} alt={f.dogName} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-xl">🐶</span>
                )}
              </div>
              <span className="truncate text-[11px] font-bold">{f.dogName}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Signed-in non-owner with an acting dog: their own friendship edge with this
// dog (add / sent / friends + unfriend) — no list of anyone else's friends.
function FriendActions({
  relationship,
  onAdd,
  onUnfriend,
}: {
  relationship: RelationshipStatus;
  onAdd: () => void;
  onUnfriend?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-[3px] border-black bg-white p-4 shadow-hard">
      <h3 className="font-display text-lg font-extrabold">Friends</h3>
      {relationship === "none" && (
        <button
          type="button"
          onClick={onAdd}
          className="border-2 border-black bg-[var(--turq)] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5"
        >
          + Add friend
        </button>
      )}
      {relationship === "pending-outgoing" && (
        <span className="text-xs font-bold text-black/50">Request sent</span>
      )}
      {relationship === "pending-incoming" && (
        <span className="text-xs font-bold text-black/50">
          Sent your dog a request — respond from their page
        </span>
      )}
      {relationship === "accepted" && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase text-[var(--green)]">Friends ✓</span>
          {onUnfriend && (
            <button
              type="button"
              onClick={onUnfriend}
              className="text-xs font-bold text-black/50 hover:underline"
            >
              Unfriend
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Profile-level paw tally (dog_paws): one per signed-in user, clearly
// separate from the per-photo paws on each PostCard below.
function ProfilePawPanel({
  dogName,
  count,
  pawed,
  canPaw,
  signedOut,
  onToggle,
}: {
  dogName: string;
  count: number;
  pawed: boolean;
  canPaw: boolean;
  signedOut: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-[3px] border-black bg-white p-4 shadow-hard">
      <div className="min-w-0">
        <h3 className="font-display text-lg font-extrabold">Profile paws</h3>
        <p className="mt-0.5 text-xs text-black/50">
          {signedOut
            ? `Sign in below to give ${dogName} a paw.`
            : "One per person — photo paws count separately."}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={!canPaw}
        aria-pressed={pawed}
        aria-label={
          pawed ? `Remove your paw from ${dogName}'s profile` : `Give ${dogName}'s profile a paw`
        }
        className={`border-[3px] border-black px-4 py-2 text-sm font-black uppercase tracking-wide shadow-hard transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40 ${
          pawed ? "bg-[var(--coral)] text-white" : "bg-white text-black/60"
        }`}
      >
        🐾 {count}
      </button>
    </div>
  );
}

function UploadPanel({ userId, dogId, onDone }: { userId: string; dogId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return setError("Choose a photo first.");
    const bad = validatePhoto(file);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    const { error } = await createPost(userId, dogId, file, caption);
    setBusy(false);
    if (error) return setError(error);
    setFile(null);
    setCaption("");
    onDone();
  };

  return (
    <div className="border-[3px] border-black bg-white p-4 shadow-hard">
      <h3 className="font-display text-lg font-extrabold">Share a photo</h3>
      <p className="mt-1 text-xs text-black/50">
        Photos are reviewed automatically before they go public.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={300}
          placeholder="Caption (optional)"
          className="border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
        />
        {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="w-fit border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? "Sharing…" : "Share photo"}
        </button>
      </div>
    </div>
  );
}

function PhotoFeed({
  posts,
  likes,
  myLikedIds,
  canAct,
  actingDogId,
  onLike,
}: {
  posts: DogPost[];
  likes: Record<string, number>;
  myLikedIds: Set<string>;
  canAct: boolean;
  actingDogId: string | null;
  onLike: (post: DogPost) => void;
}) {
  if (posts.length === 0) {
    return (
      <div className="border-[3px] border-black bg-white p-6 text-center shadow-hard">
        <p className="text-sm font-bold text-black/50">No photos yet.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          likeCount={likes[post.id] ?? 0}
          liked={actingDogId ? myLikedIds.has(post.id) : false}
          canAct={canAct}
          actingDogId={actingDogId}
          onLike={() => onLike(post)}
        />
      ))}
    </div>
  );
}

function PostCard({
  post,
  likeCount,
  liked,
  canAct,
  actingDogId,
  onLike,
}: {
  post: DogPost;
  likeCount: number;
  liked: boolean;
  canAct: boolean;
  actingDogId: string | null;
  onLike: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const submitReport = async () => {
    if (!actingDogId) return;
    const { error } = await reportPost(post.id, actingDogId, reportReason);
    setReporting(false);
    setReportReason("");
    setNotice(error ? `Couldn't report: ${error}` : "Reported to admins. Thank you.");
  };

  return (
    <div className="flex flex-col overflow-hidden border-[3px] border-black bg-white shadow-hard">
      {post.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.photoUrl} alt={post.caption ?? ""} className="aspect-square w-full object-cover" />
      )}
      <div className="flex flex-col gap-2 p-3">
        {post.caption && <p className="text-sm">{post.caption}</p>}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLike}
              disabled={!canAct}
              aria-pressed={liked}
              aria-label={liked ? "Remove paw" : "Give a paw"}
              className={`font-black uppercase tracking-wide disabled:opacity-40 ${
                liked ? "text-[var(--coral)]" : "text-black/60"
              }`}
            >
              🐾 {likeCount}
            </button>
          </div>
          {canAct && (
            <button
              type="button"
              onClick={() => setReporting((v) => !v)}
              className="text-black/30 hover:text-black/60"
            >
              Report
            </button>
          )}
        </div>

        {reporting && (
          <div className="flex flex-col gap-1 border-t border-black/10 pt-2">
            <input
              type="text"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Why are you reporting this? (optional)"
              maxLength={500}
              className="border-2 border-black bg-white px-2 py-1 text-xs outline-none"
            />
            <button
              type="button"
              onClick={submitReport}
              className="w-fit border-2 border-black bg-[var(--coral)] px-2 py-1 text-[11px] font-black uppercase text-white"
            >
              Submit report
            </button>
          </div>
        )}

        {notice && <p className="text-xs font-bold text-black/60">{notice}</p>}
      </div>
    </div>
  );
}
