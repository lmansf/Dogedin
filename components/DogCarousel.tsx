"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { Product } from "@/lib/shopify";
import { formatMoney, discountPercent } from "@/lib/format";
import AddToCartButton from "@/components/cart/AddToCartButton";

// Center-focused "album" carousel: the centered slide shows full, and slides
// shrink + dim the further they sit from center, compacting on either side.
// Native CSS scroll-snap for the scrolling; one cheap scroll handler maps each
// slide's distance-from-center to an inline scale/opacity. With JS off it
// degrades to a plain centered scroll-snap carousel (all slides full).
const DOG_SLIDES = [
  { grad: "from-[var(--turq)] to-[var(--sky)]", emoji: "🏖️" }, // Honeymoon Island
  { grad: "from-[var(--green)] to-[var(--navy)]", emoji: "🏴" }, // Highland
  { grad: "from-[var(--orange)] to-[var(--coral)]", emoji: "🌅" }, // citrus sunset
  { grad: "from-[var(--gold)] to-[var(--amber)]", emoji: "🍺" }, // craft beer
];

// Distance-from-center → scale/opacity. Exported so the math is unit-testable.
export function focus(distance: number, slideWidth: number) {
  const t = Math.min(distance / slideWidth, 1); // 0 at center → 1 a slide away
  return { scale: 1 - t * 0.16, opacity: 1 - t * 0.45 };
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
    <section className="border-[3px] border-black bg-white p-3 shadow-hard-lg">
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-[20%] py-2"
      >
        {DOG_SLIDES.map((slide, i) => (
          <div
            key={i}
            data-slide
            className="aspect-[16/9] min-w-[60%] shrink-0 origin-center snap-center transition-[transform,opacity] duration-150 ease-out md:min-w-[52%]"
          >
            <div
              className={`flex h-full w-full items-end justify-between rounded-xl border-[3px] border-black bg-gradient-to-br ${slide.grad} p-6`}
            >
              <span className="border-2 border-black bg-white px-3 py-1 text-sm font-extrabold uppercase">
                Dog #{i + 1}
              </span>
              <span className="text-5xl drop-shadow">{slide.emoji}</span>
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
    <div className="relative flex h-full w-full overflow-hidden rounded-xl border-[3px] border-black bg-[var(--sand)]">
      <div className="relative w-1/2 border-r-[3px] border-black bg-zinc-100">
        {product?.image ? (
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            priority
            sizes="350px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">
            🦴
          </div>
        )}
        {off > 0 && (
          <span className="absolute -right-2 -top-2 rotate-6 border-[3px] border-black bg-[var(--coral)] px-2 py-1 text-sm font-black text-white shadow-hard">
            -{off}%
          </span>
        )}
      </div>

      <div className="flex w-1/2 flex-col justify-center gap-2 p-5">
        <span className="w-fit -rotate-2 border-2 border-black bg-[var(--turq)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--sand)]">
          ★ Featured
        </span>
        <h3 className="font-display text-xl font-extrabold leading-tight">
          {product?.title ?? "Featured item slot"}
        </h3>
        <p className="line-clamp-2 text-sm text-black/60">
          {product?.description ?? "Connect Shopify to feature a product here."}
        </p>
        {product && (
          <>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-xl font-extrabold">
                {formatMoney(product.price, product.currency)}
              </span>
              {product.compareAtPrice && (
                <span className="text-sm text-black/40 line-through">
                  {formatMoney(product.compareAtPrice, product.currency)}
                </span>
              )}
            </div>
            <AddToCartButton variantId={product.variantId} className="mt-2 w-fit" />
          </>
        )}
      </div>
    </div>
  );
}
