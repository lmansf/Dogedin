"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { Product } from "@/lib/shopify";
import { formatMoney, discountPercent } from "@/lib/format";

// Center-focused "album" carousel: the centered slide shows full, and slides
// shrink + dim the further they sit from center, compacting on either side.
// Native CSS scroll-snap does the scrolling; one cheap scroll handler maps each
// slide's distance-from-center to an inline scale/opacity (no Tailwind variant,
// no IntersectionObserver). With JS off it degrades to a plain scroll-snap carousel.
// ponytail: placeholder gradients stand in for dog photos until real ones land.
const DOG_SLIDES = [
  "from-amber-200 to-orange-300",
  "from-sky-200 to-indigo-300",
  "from-emerald-200 to-teal-300",
  "from-rose-200 to-pink-300",
];

// Distance-from-center → scale/opacity. Exported so the math is unit-testable.
export function focus(distance: number, slideWidth: number) {
  const t = Math.min(distance / slideWidth, 1); // 0 at center → 1 a slide away
  return { scale: 1 - t * 0.18, opacity: 1 - t * 0.5 };
}

export default function DogCarousel({ featured }: { featured?: Product | null }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const slides = Array.from(
      track.querySelectorAll<HTMLElement>("[data-slide]")
    );

    const update = () => {
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      for (const slide of slides) {
        const r = slide.getBoundingClientRect();
        const { scale, opacity } = focus(
          Math.abs(center - (r.left + r.width / 2)),
          r.width
        );
        slide.style.transform = `scale(${scale})`;
        slide.style.opacity = String(opacity);
      }
    };

    update();
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      track.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <section className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[20%] py-2"
      >
        {DOG_SLIDES.map((gradient, i) => (
          <div
            key={i}
            data-slide
            className="aspect-[16/9] min-w-[60%] shrink-0 origin-center snap-center transition-[transform,opacity] duration-150 ease-out md:min-w-[52%]"
          >
            <div
              className={`flex h-full w-full items-end rounded-2xl bg-gradient-to-br ${gradient} p-6`}
            >
              <span className="rounded-full bg-black/30 px-3 py-1 text-sm font-medium text-white backdrop-blur">
                🐕 Dog photo {i + 1}
              </span>
            </div>
          </div>
        ))}

        {/* Featured item slot - same album scaling. */}
        <div
          data-slide
          className="aspect-[16/9] min-w-[60%] shrink-0 origin-center snap-center transition-[transform,opacity] duration-150 ease-out md:min-w-[52%]"
        >
          <FeaturedSlide product={featured} />
        </div>
      </div>
    </section>
  );
}

function FeaturedSlide({ product }: { product?: Product | null }) {
  const off = product ? discountPercent(product.price, product.compareAtPrice) : 0;

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-2xl border border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-800">
      <div className="relative w-1/2 bg-zinc-100 dark:bg-zinc-700">
        {product?.image ? (
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes="350px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🦴</div>
        )}
        {off > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2 py-1 text-xs font-semibold text-white">
            -{off}%
          </span>
        )}
      </div>

      <div className="flex w-1/2 flex-col justify-center gap-2 p-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          Featured
        </span>
        <h3 className="text-xl font-bold leading-tight">
          {product?.title ?? "Featured item slot"}
        </h3>
        <p className="line-clamp-3 text-sm text-zinc-500">
          {product?.description ?? "Connect Shopify to feature a product here."}
        </p>
        {product && (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-semibold">
              {formatMoney(product.price, product.currency)}
            </span>
            {product.compareAtPrice && (
              <span className="text-sm text-zinc-400 line-through">
                {formatMoney(product.compareAtPrice, product.currency)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
