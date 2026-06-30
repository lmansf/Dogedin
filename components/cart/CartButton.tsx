"use client";

import { useCart } from "./CartProvider";

export default function CartButton() {
  const { cart, setOpen } = useCart();
  const count = cart?.totalQuantity ?? 0;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="relative border-[3px] border-black bg-[var(--amber)] px-4 py-2 text-sm font-extrabold uppercase text-black shadow-hard transition-transform hover:-translate-y-0.5"
      aria-label={`Open cart, ${count} items`}
    >
      Cart 🛒
      {count > 0 && (
        <span className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-black bg-[var(--pink)] text-xs font-black text-white">
          {count}
        </span>
      )}
    </button>
  );
}
