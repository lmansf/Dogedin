"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { StarRating } from "./Stars";
import ReviewItem from "./ReviewItem";
import ReviewForm from "./ReviewForm";
import type { Business, BusinessHours, Review } from "@/lib/businesses";

// Average star rating, rounded to one decimal. Inlined (rather than imported
// from lib/businesses) so this client component doesn't pull the Supabase data
// layer into the browser bundle.
function averageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

// Same reasoning as averageRating above — small pure helpers, inlined rather
// than imported from lib/businesses.
function googleMapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
function appleMapsDirectionsUrl(address: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
}

const DAY_ORDER: (keyof BusinessHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const DAY_LABELS: Record<keyof BusinessHours, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};
// Date.getDay(): 0 = Sunday … 6 = Saturday.
const JS_DAY_TO_KEY: (keyof BusinessHours)[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// A single "things to do" business: image, meta, an optional partner offer, and
// an expandable reviews section (list + upvotes + replies + write-a-review).
// Reviews are held in local state so newly posted ones appear immediately, in
// both persisted and preview modes.
export default function BusinessCard({
  business,
  canPersist,
  defaultOpen = false,
  // On the standalone /things-to-do/[slug] page the card IS the page, so the
  // name links nowhere; in the grid it deep-links to that permalink.
  isPermalink = false,
}: {
  business: Business;
  canPersist: boolean;
  defaultOpen?: boolean;
  isPermalink?: boolean;
}) {
  const [reviews, setReviews] = useState<Review[]>(business.reviews);
  const [open, setOpen] = useState(defaultOpen);
  const [showHours, setShowHours] = useState(false);
  const permalink = `/things-to-do/${business.slug}`;

  const avg = useMemo(() => averageRating(reviews), [reviews]);
  const todayKey = useMemo(() => JS_DAY_TO_KEY[new Date().getDay()], []);
  const today = business.hours?.[todayKey];

  const addReview = (review: Review) =>
    // Newest first — matches the server's upvotes-then-recency ordering closely
    // enough for a fresh 0-upvote review.
    setReviews((prev) => [review, ...prev]);

  return (
    <article className="flex flex-col border-[3px] border-black bg-white shadow-hard">
      <div className="relative aspect-[16/9] border-b-[3px] border-black bg-zinc-100">
        <Image
          src={business.image}
          alt={business.name}
          fill
          sizes="(max-width: 768px) 100vw, 500px"
          className="object-cover"
        />
        {business.dogFriendly && (
          <span className="absolute left-2 top-2 border-2 border-black bg-[var(--sand)] px-2 py-0.5 text-xs font-black uppercase shadow-hard">
            🐾 Dog friendly
          </span>
        )}
        {business.offer && (
          <span className="absolute -right-2 -top-2 rotate-3 border-[3px] border-black bg-[var(--coral)] px-2 py-1 text-xs font-black text-white shadow-hard">
            🎟 Deal
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-2 border-black bg-[var(--turq)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--sand)]">
            {business.category}
          </span>
          <span className="text-xs font-bold text-black/50">
            {business.neighborhood}
          </span>
        </div>

        <h3 className="font-display text-2xl font-extrabold leading-tight">
          {isPermalink ? (
            business.name
          ) : (
            <Link href={permalink} className="hover:underline">
              {business.name}
            </Link>
          )}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <StarRating rating={avg} showValue={reviews.length > 0} />
          <span className="text-xs font-bold text-black/50">
            {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </span>
          {/* Stable, shareable link a business can send its audience straight
              to — the landing spot for "leave us a review". */}
          <Link
            href={permalink}
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            🔗 Share
          </Link>
        </div>

        <p className="text-sm leading-relaxed text-black/70">
          {business.description}
        </p>

        {/* Directions, contact, and today's hours — the practical info a
            visitor actually needs to go there. */}
        {(business.address || business.phone || business.website) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
            {business.address && (
              <>
                <a
                  href={googleMapsDirectionsUrl(business.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--turq)] underline"
                >
                  📍 Google Maps
                </a>
                <a
                  href={appleMapsDirectionsUrl(business.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--turq)] underline"
                >
                  Apple Maps
                </a>
              </>
            )}
            {business.phone && (
              <a href={`tel:${business.phone}`} className="text-black/60 underline">
                📞 {business.phone}
              </a>
            )}
            {business.website && (
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-black/60 underline"
              >
                🔗 Website
              </a>
            )}
          </div>
        )}

        {business.hours && (
          <div>
            <button
              type="button"
              onClick={() => setShowHours((v) => !v)}
              className="text-xs font-black uppercase tracking-wide text-black/50 hover:underline"
            >
              🕒{" "}
              {today
                ? today.closed
                  ? "Closed today"
                  : `Open today ${today.open}–${today.close}`
                : "Hours"}{" "}
              {showHours ? "▲" : "▼"}
            </button>
            {showHours && (
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-black/60">
                {DAY_ORDER.map((day) => {
                  const d = business.hours![day];
                  return (
                    <li
                      key={day}
                      className={day === todayKey ? "font-black text-black" : ""}
                    >
                      {DAY_LABELS[day]}: {d.closed ? "Closed" : `${d.open}–${d.close}`}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Partner offer banner — a Club member deal. Hidden while the Club
            is pre-launch: no card exists to show, so displaying the deal
            would promise a perk nobody can redeem. Restore at launch. */}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 w-fit border-[3px] border-black bg-[var(--gold)] px-4 py-2 text-sm font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
        >
          {open ? "Hide reviews" : `Reviews & reply →`}
        </button>

        {open && (
          <div className="mt-3 flex flex-col gap-3">
            {reviews.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {reviews.map((r) => (
                  <ReviewItem
                    key={r.id}
                    review={r}
                    offer={business.offer}
                    canPersist={canPersist}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm font-bold text-black/50">
                No reviews yet — be the first!
              </p>
            )}

            <ReviewForm
              businessId={business.id}
              businessName={business.name}
              offer={business.offer}
              canPersist={canPersist}
              onAdded={addReview}
            />
          </div>
        )}
      </div>
    </article>
  );
}
