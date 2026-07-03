"use client";

import { useCart } from "./CartProvider";

export default function AddToCartButton({
  variantId,
  available = true,
  className = "",
}: {
  variantId: string;
  available?: boolean;
  className?: string;
}) {
  const { add, pending } = useCart();

  if (!available) {
    return (
      <button
        type="button"
        disabled
        className={`cursor-not-allowed border-[3px] border-black bg-zinc-200 px-3 py-2 text-sm font-extrabold uppercase tracking-tight text-black/40 shadow-hard ${className}`}
      >
        Sold out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => add(variantId)}
      disabled={pending}
      className={`border-[3px] border-black bg-[var(--turq)] px-3 py-2 text-sm font-extrabold uppercase tracking-tight text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60 ${className}`}
    >
      {pending ? "Adding..." : "Add to cart 🦴"}
    </button>
  );
}
