"use client";

import { useState, useTransition } from "react";
import { StarInput } from "./Stars";
import { addReview } from "@/app/things-to-do/actions";
import { recordBusinessStat } from "@/lib/businessStats";
import type { Review, BusinessOffer } from "@/lib/businesses";

// "Write a review" form for a single business. On submit it calls the addReview
// server action and hands the created review back up to the card via onAdded so
// it shows immediately. When persistence is off the review is still added for
// the session; we surface a small "preview" note so it's clear it won't stick.
//
// Review-for-discount (compliant design): when the business offers a deal, we
// unlock it after ANY honest review — the reward is never conditioned on a
// positive rating or sentiment (FTC), and it applies only to these first-party
// Dogedin listings, never to Google/Yelp/etc. The disclosure is shown up front.
// See docs/review-incentive-compliance.md.
export default function ReviewForm({
  businessId,
  businessName,
  offer,
  canPersist,
  onAdded,
}: {
  businessId: string;
  businessName: string;
  offer: BusinessOffer | null;
  canPersist: boolean;
  onAdded: (review: Review) => void;
}) {
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
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
      // A saved review unlocks the deal. Only when it actually persisted, so a
      // preview-mode review doesn't hand out a code that isn't recorded. The
      // unlock is also counted (business_stats_daily) so the business can see
      // its offer working in the insights portal.
      if (offer && res.persisted) {
        setUnlocked(true);
        recordBusinessStat(businessId, "offer_unlock");
      }
    });
  };

  // After a saved review, reveal the business's thank-you offer. This is the
  // confirmation that "unlocks" the discount, shown for a review of any rating.
  if (unlocked && offer) {
    return (
      <div className="flex flex-col gap-2 border-[3px] border-black bg-[var(--green)] p-4 text-[var(--sand)] shadow-hard">
        <p className="font-display text-lg font-extrabold">
          Thanks for reviewing {businessName}! 🎟
        </p>
        <p className="text-sm font-bold">{offer.label}</p>
        <p className="text-sm">{offer.detail}</p>
        {offer.code && (
          <p className="w-fit border-2 border-black bg-[var(--sand)] px-3 py-1 font-mono text-base font-black tracking-widest text-black">
            {offer.code}
          </p>
        )}
        <p className="text-[11px] font-bold text-[var(--sand)]/80">
          You earned this by leaving an honest review — reviews of any rating
          qualify. Show this at {businessName} to redeem.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-[3px] border-black bg-[var(--sand)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-lg font-extrabold">Write a review</span>
        <StarInput value={rating} onChange={setRating} />
      </div>

      {offer && (
        <p className="border-2 border-black bg-[var(--gold)]/40 px-3 py-2 text-xs font-bold">
          🎟 Leave an honest review — any rating — and {businessName} unlocks a
          thank-you deal for you. No positive review required.
        </p>
      )}

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
