"use client";

import { useRef } from "react";
import ProductCard from "./ProductCard";
import type { Product } from "@/lib/shopify";

// A single category as a horizontal scroll-snap carousel of product cards.
// Cards are a fixed width so a row comfortably fills the screen and overflows
// into a scroll. Arrow buttons nudge the row; native scroll-snap does the rest.
export default function ProductRow({
  title,
  badge,
  badgeColor = "var(--turq)",
  products,
}: {
  title: string;
  badge?: string;
  badgeColor?: string;
  products: Product[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const nudge = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">
            {title}
          </h2>
          {badge && (
            <span
              className="hidden -rotate-2 border-2 border-black px-3 py-1 text-xs font-black uppercase text-[var(--sand)] shadow-hard sm:inline-block"
              style={{ background: badgeColor }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="hidden gap-2 sm:flex">
          <CarouselButton dir={-1} onClick={() => nudge(-1)} />
          <CarouselButton dir={1} onClick={() => nudge(1)} />
        </div>
      </div>

      <div
        ref={trackRef}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-1 pb-2"
      >
        {products.map((p, i) => (
          <div
            key={p.id}
            className="w-[230px] shrink-0 snap-start sm:w-[250px]"
          >
            <ProductCard product={p} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CarouselButton({
  dir,
  onClick,
}: {
  dir: 1 | -1;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 1 ? "Scroll right" : "Scroll left"}
      className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-[var(--gold)] text-lg font-black shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
    >
      {dir === 1 ? "→" : "←"}
    </button>
  );
}
