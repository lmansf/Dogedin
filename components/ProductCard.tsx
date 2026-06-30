import Image from "next/image";
import type { Product } from "@/lib/shopify";
import { formatMoney, discountPercent } from "@/lib/format";
import AddToCartButton from "@/components/cart/AddToCartButton";

// Rotating accent colors so a grid of cards feels lively, not uniform.
const ACCENTS = [
  "var(--gold)",
  "var(--turq)",
  "var(--sky)",
  "var(--coral)",
  "var(--orange)",
];

export default function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const off = discountPercent(product.price, product.compareAtPrice);
  const accent = ACCENTS[index % ACCENTS.length];

  return (
    <article className="group flex flex-col border-[3px] border-black bg-white shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-1 hover:shadow-hard-lg">
      <div className="relative aspect-square border-b-[3px] border-black bg-zinc-100">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 768px) 50vw, 300px"
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

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span
          className="w-fit border-2 border-black px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
          style={{ background: accent }}
        >
          Good gear
        </span>
        <h3 className="font-display text-lg font-extrabold leading-tight">
          {product.title}
        </h3>
        <p className="line-clamp-2 text-sm text-black/60">
          {product.description}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-extrabold">
              {formatMoney(product.price, product.currency)}
            </span>
            {product.compareAtPrice && (
              <span className="text-sm text-black/40 line-through">
                {formatMoney(product.compareAtPrice, product.currency)}
              </span>
            )}
          </div>
        </div>

        <AddToCartButton variantId={product.variantId} className="mt-2 w-full" />
      </div>
    </article>
  );
}
