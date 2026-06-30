import Image from "next/image";
import type { Product } from "@/lib/shopify";
import { formatMoney, discountPercent } from "@/lib/format";

export default function ProductCard({ product }: { product: Product }) {
  const off = discountPercent(product.price, product.compareAtPrice);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-zinc-900">
      <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 768px) 50vw, 300px"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🦴</div>
        )}
        {off > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2 py-1 text-xs font-semibold text-white">
            -{off}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-semibold leading-tight">{product.title}</h3>
        <p className="line-clamp-2 text-sm text-zinc-500">{product.description}</p>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="font-semibold">
            {formatMoney(product.price, product.currency)}
          </span>
          {product.compareAtPrice && (
            <span className="text-sm text-zinc-400 line-through">
              {formatMoney(product.compareAtPrice, product.currency)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
