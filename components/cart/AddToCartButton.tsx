"use client";

import { useCart } from "./CartProvider";

export default function AddToCartButton({
  variantId,
  className = "",
}: {
  variantId: string;
  className?: string;
}) {
  const { add, pending } = useCart();

  return (
    <button
      type="button"
      onClick={() => add(variantId)}
      disabled={pending}
      className={`border-[3px] border-black bg-[var(--lime)] px-3 py-2 text-sm font-extrabold uppercase tracking-tight text-black shadow-hard transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60 ${className}`}
    >
      {pending ? "Adding..." : "Add to cart 🦴"}
    </button>
  );
}
