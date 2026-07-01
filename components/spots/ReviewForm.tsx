"use client";

import { useState, useTransition } from "react";
import { StarInput } from "./Stars";
import { addReview } from "@/app/things-to-do/actions";
import type { Review } from "@/lib/businesses";

// "Write a review" form for a single business. On submit it calls the addReview
// server action and hands the created review back up to the card via onAdded so
// it shows immediately. When persistence is off the review is still added for
// the session; we surface a small "preview" note so it's clear it won't stick.
export default function ReviewForm({
  businessId,
  canPersist,
  onAdded,
}: {
  businessId: string;
  canPersist: boolean;
  onAdded: (review: Review) => void;
}) {
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addReview({ businessId, author, rating, body });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAdded(res.review);
      setAuthor("");
      setRating(0);
      setBody("");
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-[3px] border-black bg-[var(--sand)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-lg font-extrabold">Write a review</span>
        <StarInput value={rating} onChange={setRating} />
      </div>

      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your name"
        maxLength={60}
        className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--turq)]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you and your dog think?"
        rows={3}
        maxLength={1000}
        className="resize-y border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
      />

      {error && (
        <p className="text-sm font-bold text-[var(--red)]">{error}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        {!canPersist && (
          <span className="text-xs font-bold text-black/50">
            Preview mode — not saved yet
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="ml-auto w-fit border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post review"}
        </button>
      </div>
    </form>
  );
}
