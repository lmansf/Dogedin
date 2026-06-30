import Image from "next/image";
import type { Product } from "@/lib/shopify";
import { formatMoney, discountPercent } from "@/lib/format";

// Native CSS scroll-snap carousel — no carousel library, no JS.
// Slides are dog photos; one slide is the "featured item" slot.
// ponytail: placeholder gradients stand in for dog photos until real ones land.
const DOG_SLIDES = [
  "from-amber-200 to-orange-300",
  "from-sky-200 to-indigo-300",
  "from-emerald-200 to-teal-300",
  "from-rose-200 to-pink-300",
];

export default function DogCarousel({ featured }: { featured?: Product | null }) {
  return (
    <section className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth">
        {DOG_SLIDES.map((gradient, i) => (
          <div
            key={i}
            className={`relative flex aspect-[16/9] min-w-[85%] snap-center items-end rounded-2xl bg-gradient-to-br ${gradient} p-6 md:min-w-[70%]`}
          >
            <span className="rounded-full bg-black/30 px-3 py-1 text-sm font-medium text-white backdrop-blur">
              🐕 Dog photo {i + 1}
            </span>
          </div>
        ))}

        {/* Featured item slot */}
        <FeaturedSlide product={featured} />
      </div>
    </section>
  );
}

function FeaturedSlide({ product }: { product?: Product | null }) {
  const off = product ? discountPercent(product.price, product.compareAtPrice) : 0;

  return (
    <div className="relative flex aspect-[16/9] min-w-[85%] snap-center overflow-hidden rounded-2xl border border-black/10 bg-zinc-50 md:min-w-[70%] dark:border-white/10 dark:bg-zinc-800">
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
          {product?.description ??
            "Connect Shopify to feature a product here."}
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
