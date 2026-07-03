"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseUser, AuthPanel } from "./auth";
import {
  friendshipStatus,
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
  addComment,
  createPost,
  likeCounts,
  listApprovedPosts,
  listComments,
  listOwnPosts,
  myLikes,
  reportPost,
  retryModeration,
  toggleLike,
  validatePhoto,
  type Comment,
  type DogPost,
} from "@/lib/dogPosts";

// Friends + photo feed for a dog's public profile. Read-only for anonymous
// visitors (friends list, approved photos, like counts, comments). Signed-in
// owners of ANY dog get an "acting as {dog}" identity to friend/like/comment
// with; the profile's own owner additionally gets the upload form, their
// pending/rejected posts, and incoming friend requests.
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
  const [posts, setPosts] = useState<DogPost[]>([]);
  const [ownPosts, setOwnPosts] = useState<DogPost[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [myLikedIds, setMyLikedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const amOwner = mine.some((d) => d.id === dogId);

  const load = useCallback(async () => {
    const [f, approved] = await Promise.all([listFriends(dogId), listApprovedPosts(dogId)]);
    setFriends(f);
    setPosts(approved);
    setLikes(await likeCounts(approved.map((p) => p.id)));

    if (!user) return;
    const dogs = await myDogs();
    setMine(dogs);
    setActingDogId((prev) => prev ?? dogs.find((d) => d.id !== dogId)?.id ?? dogs[0]?.id ?? null);

    if (dogs.some((d) => d.id === dogId)) {
      const [reqs, own] = await Promise.all([listIncomingRequests(dogId), listOwnPosts(dogId)]);
      setIncoming(reqs);
      setOwnPosts(own);
    }
    const acting = dogs.find((d) => d.id !== dogId);
    if (acting) {
      setRelationship(await friendshipStatus(acting.id, dogId));
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

  const doUnfriend = async (friendshipId: string) => {
    setNotice(null);
    const { error } = await removeFriendship(friendshipId);
    if (error) return setNotice(`Couldn't remove: ${error}`);
    setRelationship("none");
    load();
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
      <FriendsPanel
        friends={friends}
        canAct={configured && !!user && !amOwner && !!actingDogId}
        relationship={relationship}
        onAdd={doFriendRequest}
      />

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

      {relationship === "accepted" && !amOwner && friends.length > 0 && (
        <UnfriendControl friends={friends} actingDogId={actingDogId} onUnfriend={doUnfriend} />
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
            <AuthPanel intro={`Sign in to friend ${dogName} and like or comment on photos.`} />
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

function FriendsPanel({
  friends,
  canAct,
  relationship,
  onAdd,
}: {
  friends: Friend[];
  canAct: boolean;
  relationship: RelationshipStatus;
  onAdd: () => void;
}) {
  return (
    <div className="border-[3px] border-black bg-white p-4 shadow-hard">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-extrabold">
          Friends {friends.length > 0 && `(${friends.length})`}
        </h3>
        {canAct && relationship === "none" && (
          <button
            type="button"
            onClick={onAdd}
            className="border-2 border-black bg-[var(--turq)] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5"
          >
            + Add friend
          </button>
        )}
        {canAct && relationship === "pending-outgoing" && (
          <span className="text-xs font-bold text-black/50">Request sent</span>
        )}
        {canAct && relationship === "accepted" && (
          <span className="text-xs font-black uppercase text-[var(--green)]">Friends ✓</span>
        )}
      </div>
      {friends.length === 0 ? (
        <p className="mt-2 text-sm text-black/50">No friends yet — be the first!</p>
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

function UnfriendControl({
  friends,
  actingDogId,
  onUnfriend,
}: {
  friends: Friend[];
  actingDogId: string | null;
  onUnfriend: (id: string) => void;
}) {
  const mine = friends.find((f) => f.dogId === actingDogId);
  if (!mine) return null;
  return (
    <button
      type="button"
      onClick={() => onUnfriend(mine.friendshipId)}
      className="w-fit text-xs font-bold text-black/50 hover:underline"
    >
      Unfriend
    </button>
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
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const toggleComments = async () => {
    setShowComments((v) => !v);
    if (!comments) setComments(await listComments(post.id));
  };

  const submitComment = async () => {
    if (!actingDogId || !draft.trim()) return;
    const { error } = await addComment(post.id, actingDogId, draft);
    if (error) return setNotice(error);
    setDraft("");
    setComments(await listComments(post.id));
  };

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
              className={`font-black uppercase tracking-wide disabled:opacity-40 ${
                liked ? "text-[var(--coral)]" : "text-black/60"
              }`}
            >
              {liked ? "♥" : "♡"} {likeCount}
            </button>
            <button type="button" onClick={toggleComments} className="font-bold text-black/60">
              💬 {showComments ? "Hide" : "Comments"}
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

        {showComments && (
          <div className="flex flex-col gap-2 border-t border-black/10 pt-2">
            {(comments ?? []).map((c) => (
              <p key={c.id} className="text-xs">
                <span className="font-black">{c.dogName}: </span>
                {c.body}
              </p>
            ))}
            {comments?.length === 0 && <p className="text-xs text-black/40">No comments yet.</p>}
            {canAct && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={500}
                  placeholder="Add a comment…"
                  className="flex-1 border-2 border-black bg-white px-2 py-1 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={submitComment}
                  className="border-2 border-black bg-[var(--turq)] px-2 py-1 text-[11px] font-black uppercase text-[var(--sand)]"
                >
                  Post
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
