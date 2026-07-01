"use client";

import { useState } from "react";
import Link from "next/link";
import CartButton from "@/components/cart/CartButton";

// Primary site navigation. Inline links on desktop; a hamburger-toggled drawer
// on mobile (the drawer positions itself under the header bar, which is
// `relative`). The cart button is always visible.
const LINKS = [
  { href: "/", label: "Shop" },
  { href: "/things-to-do", label: "Things to do" },
  { href: "/dogs", label: "Find a dog" },
  { href: "/found", label: "Found?" },
  { href: "/events", label: "Events" },
  { href: "/register", label: "Register" },
  { href: "/membership", label: "Club" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {/* Desktop links */}
      <nav className="hidden items-center gap-4 text-sm font-extrabold uppercase lg:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>

      <CartButton />

      {/* Hamburger — mobile / tablet only */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-[var(--sand)] text-xl font-black shadow-hard transition-transform active:translate-y-0.5 active:shadow-none lg:hidden"
      >
        {open ? "✕" : "☰"}
      </button>

      {/* Mobile drawer */}
      {open && (
        <>
          {/* click-away backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[var(--header-h,0)] z-40 cursor-default bg-black/10 lg:hidden"
          />
          <nav
            id="mobile-nav"
            className="absolute inset-x-0 top-full z-50 border-b-[3px] border-black bg-[var(--sand)] shadow-hard-lg lg:hidden"
          >
            <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2">
              {LINKS.map((l) => (
                <li key={l.href} className="border-b-2 border-black/10 last:border-0">
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 text-sm font-extrabold uppercase tracking-wide hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
