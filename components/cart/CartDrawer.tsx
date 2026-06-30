"use client";

import Image from "next/image";
import { useCart } from "./CartProvider";
import { formatMoney } from "@/lib/format";

export default function CartDrawer() {
  const { cart, open, setOpen, error, remove, changeQty, pending } = useCart();
  const lines = cart?.lines ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l-[3px] border-black bg-[var(--cream)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b-[3px] border-black bg-[var(--amber)] px-5 py-4">
          <h2 className="font-display text-2xl font-extrabold">Your pack 🛒</h2>
          <button
            onClick={() => setOpen(false)}
            className="border-[3px] border-black bg-white px-3 py-1 text-sm font-extrabold shadow-hard transition-transform hover:-translate-y-0.5"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 border-[3px] border-black bg-[var(--coral)] px-4 py-3 text-sm font-bold text-white shadow-hard">
              🚧 Cart isn&apos;t hooked up to Shopify yet - so this errored, as
              expected:
              <span className="mt-1 block break-words font-mono text-xs font-normal">
                {error}
              </span>
            </div>
          )}

          {lines.length === 0 && !error && (
            <div className="mt-16 text-center">
              <div className="text-6xl">🐶</div>
              <p className="mt-4 font-display text-xl font-extrabold">
                No treats yet
              </p>
              <p className="mt-1 text-sm text-black/60">
                Add something good for a good dog.
              </p>
            </div>
          )}

          <ul className="flex flex-col gap-4">
            {lines.map((line) => (
              <li
                key={line.id}
                className="flex gap-3 border-[3px] border-black bg-white p-3 shadow-hard"
              >
                <div className="relative h-20 w-20 shrink-0 border-[3px] border-black bg-zinc-100">
                  {line.image ? (
                    <Image
                      src={line.image}
                      alt={line.productTitle}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">
                      🦴
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <p className="font-bold leading-tight">{line.productTitle}</p>
                  <p className="text-sm text-black/60">{line.title}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQty(line.id, line.quantity - 1)}
                        className="h-7 w-7 border-2 border-black font-black leading-none"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-bold">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() => changeQty(line.id, line.quantity + 1)}
                        className="h-7 w-7 border-2 border-black font-black leading-none"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-extrabold">
                      {formatMoney(line.price * line.quantity, line.currency)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => remove(line.id)}
                  aria-label="Remove"
                  className="self-start text-lg leading-none text-black/40 hover:text-black"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        <footer className="border-t-[3px] border-black bg-white px-5 py-4">
          <div className="mb-3 flex items-center justify-between font-display text-lg font-extrabold">
            <span>Subtotal</span>
            <span>
              {formatMoney(cart?.subtotal ?? 0, cart?.currency ?? "USD")}
            </span>
          </div>
          <a
            href={cart?.checkoutUrl ?? "#"}
            aria-disabled={!cart?.checkoutUrl}
            className={`block border-[3px] border-black bg-[var(--grape)] py-3 text-center font-display text-lg font-extrabold uppercase text-white shadow-hard transition-transform hover:-translate-y-0.5 ${
              !cart?.checkoutUrl ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {pending ? "Working..." : "Checkout →"}
          </a>
        </footer>
      </aside>
    </>
  );
}
