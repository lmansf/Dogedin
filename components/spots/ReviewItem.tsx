"use client";

import { useEffect, useState, useTransition } from "react";
import { StarRating } from "./Stars";
import { upvoteReview, addReply } from "@/app/things-to-do/actions";
import type { Review, Reply, BusinessOffer } from "@/lib/businesses";

// Tracks which reviews this browser has already upvoted so the count can't be
// spammed by one visitor (there's no auth). Best-effort only — a client guard,
// not a security boundary. The real dedup lives server-side once auth exists.
const VOTED_KEY = "dogedin_upvoted_reviews";

function loadVoted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function rememberVote(id: string) {
  try {
    const set = loadVoted();
    set.add(id);
    localStorage.setItem(VOTED_KEY, JSON.stringify([...set]));
  } catch {
    /* localStorage unavailable — ignore, worst case a double vote is possible */
  }
}

export default function ReviewItem({
  review,
  offer,
  canPersist,
}: {
  review: Review;
  offer: BusinessOffer | null;
  canPersist: boolean;
}) {
  const [upvotes, setUpvotes] = useState(review.upvotes);
  const [voted, setVoted] = useState(false);
  const [replies, setReplies] = useState<Reply[]>(review.replies);
  const [replying, setReplying] = useState(false);

  // localStorage is only readable after mount (SSR-safe).
  useEffect(() => {
    setVoted(loadVoted().has(review.id));
  }, [review.id]);

  const [voting, startVote] = useTransition();

  const upvote = () => {
    if (voted || voting) return;
    // Optimistic: bump immediately, reconcile with the server's count if given.
    setVoted(true);
    setUpvotes((n) => n + 1);
    rememberVote(review.id);
    startVote(async () => {
      const res = await upvoteReview(review.id);
      if (res.ok && typeof res.upvotes === "number") setUpvotes(res.upvotes);
    });
  };

  return (
    <li className="border-2 border-black bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold">{review.author}</p>
          <StarRating rating={review.rating} className="text-sm" />
        </div>
        <button
          type="button"
          onClick={upvote}
          disabled={voted || voting}
          aria-pressed={voted}
          aria-label={`Upvote ${review.author}'s review`}
          className={`flex shrink-0 items-center gap-1 border-2 border-black px-2 py-1 text-xs font-black shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:hover:translate-y-0 ${
            voted ? "bg-[var(--turq)] text-[var(--sand)]" : "bg-white"
          }`}
        >
          <span aria-hidden>▲</span>
          {upvotes}
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-black/75">{review.body}</p>

      {/* Advertise the partner discount directly on the review. */}
      {offer && (
        <p className="mt-2 w-fit border-2 border-black bg-[var(--gold)] px-2 py-0.5 text-[11px] font-black uppercase tracking-wide">
          🎟 {offer.label}
        </p>
      )}

      <div className="mt-2 flex items-center gap-3 text-xs font-bold text-black/40">
        <span>{review.createdAt}</span>
        <button
          type="button"
          onClick={() => setReplying((v) => !v)}
          className="uppercase tracking-wide text-black/60 hover:underline"
        >
          {replying ? "Cancel" : "Reply"}
        </button>
      </div>

      {(replies.length > 0 || replying) && (
        <div className="mt-3 space-y-2 border-l-[3px] border-black/20 pl-3">
          {replies.map((r) => (
            <div key={r.id}>
              <p className="text-xs font-extrabold">
                {r.author}{" "}
                <span className="font-bold text-black/40">· {r.createdAt}</span>
              </p>
              <p className="text-sm text-black/70">{r.body}</p>
            </div>
          ))}

          {replying && (
            <ReplyForm
              reviewId={review.id}
              canPersist={canPersist}
              onAdded={(reply) => {
                setReplies((prev) => [...prev, reply]);
                setReplying(false);
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

function ReplyForm({
  reviewId,
  canPersist,
  onAdded,
}: {
  reviewId: string;
  canPersist: boolean;
  onAdded: (reply: Reply) => void;
}) {
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addReply({ reviewId, author, body });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAdded(res.reply);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 pt-1">
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your name"
        maxLength={60}
        className="border-2 border-black bg-white px-2 py-1 text-xs font-semibold outline-none focus:ring-2 focus:ring-[var(--turq)]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a reply…"
        rows={2}
        maxLength={600}
        className="resize-y border-2 border-black bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[var(--turq)]"
      />
      {error && <p className="text-xs font-bold text-[var(--red)]">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        {!canPersist && (
          <span className="text-[10px] font-bold text-black/40">Preview only</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="ml-auto w-fit border-2 border-black bg-[var(--turq)] px-3 py-1 text-xs font-black uppercase text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
        >
          {pending ? "…" : "Reply"}
        </button>
      </div>
    </form>
  );
}
