"use client";

import { useState } from "react";

// Read-only star display. Rounds to the nearest whole star for the glyphs but
// shows the precise value (e.g. "4.5") alongside when `showValue` is set.
export function StarRating({
  rating,
  showValue = false,
  className = "",
}: {
  rating: number;
  showValue?: boolean;
  className?: string;
}) {
  const filled = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span aria-hidden className="tracking-tight text-[var(--gold)]">
        {"★★★★★".slice(0, filled)}
        <span className="text-black/20">{"★★★★★".slice(filled)}</span>
      </span>
      {showValue && (
        <span className="text-xs font-extrabold text-black/60">
          {rating.toFixed(1)}
        </span>
      )}
      <span className="sr-only">{rating} out of 5 stars</span>
    </span>
  );
}

// Interactive 1-5 star picker for the review form.
export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className={`text-2xl leading-none transition-transform hover:scale-110 ${
            n <= shown ? "text-[var(--gold)]" : "text-black/20"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
