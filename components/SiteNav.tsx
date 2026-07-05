"use client";

import { useState } from "react";
import Link from "next/link";
import CartButton from "@/components/cart/CartButton";
import { recordFeatureClick } from "@/lib/featureInterest";
import { useIsAdmin } from "@/components/dogs/auth";

// Primary site navigation, community first. Inline links on desktop; a
// hamburger-toggled drawer on mobile (the drawer positions itself under the
// header bar, which is `relative`). Two things stay visible at every size:
// the cart, and the coral "Found a dog?" chip — the lost-dog lookup is an
// emergency utility and must never hide behind a menu.
// `soon` marks pre-launch destinations: the link stays visible, and clicks
// are counted as interest (feature_interest_daily) rather than hidden.
const LINKS: { href: string; label: string; soon?: string }[] = [
  { href: "/things-to-do", label: "Local Guide" },
  { href: "/events", label: "Events", soon: "events" },
  { href: "/dogs", label: "The Pack" },
  { href: "/membership", label: "Club", soon: "club" },
  { href: "/shop", label: "Shop" },
  { href: "/account", label: "My dogs" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  // Only true once an admin is signed in; otherwise the admin chip/link never
  // render, so nothing about the console is exposed to regular visitors.
  // user/loading also drive the top-right "Sign in" chip: shown to signed-out
  // visitors only (dog parents AND businesses both enter through /signin).
  const { user, loading, configured, isAdmin } = useIsAdmin();
  const signedOut = configured && !loading && !user;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Desktop links */}
      <nav className="hidden items-center gap-4 text-sm font-extrabold uppercase lg:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="hover:underline"
            onClick={l.soon ? () => recordFeatureClick(l.soon!, "nav") : undefined}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/* Admin chip — visible only to signed-in admins, at every screen size, so
          the console is one tap away from anywhere on the site. */}
      {isAdmin && (
        <Link
          href="/admin"
          aria-label="Open the admin console"
          className="flex items-center gap-1 border-[3px] border-black bg-[var(--gold)] px-2 py-1.5 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
        >
          <span aria-hidden>⚙️</span>
          <span className="hidden sm:inline">Admin</span>
        </Link>
      )}

      {/* Sign in — one door for dog parents and businesses (shared accounts). */}
      {signedOut && (
        <Link
          href="/signin"
          className="flex items-center gap-1 border-[3px] border-black bg-[var(--turq)] px-2 py-1.5 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
        >
          <span aria-hidden>👋</span>
          <span className="hidden sm:inline">Sign in</span>
        </Link>
      )}

      {/* Emergency chip — always visible, icon-only on the smallest screens. */}
      <Link
        href="/found"
        aria-label="Found a dog? Look up their tag"
        className="flex items-center gap-1 border-[3px] border-black bg-[var(--coral)] px-2 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
      >
        <span aria-hidden>🚨</span>
        <span className="hidden sm:inline">Found a dog?</span>
      </Link>

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
              {[
                ...LINKS,
                { href: "/register", label: "Register your dog" },
                ...(signedOut
                  ? [{ href: "/signin", label: "👋 Sign in (parents & businesses)" }]
                  : []),
                ...(isAdmin ? [{ href: "/admin", label: "⚙️ Admin console" }] : []),
              ].map(
                (l) => (
                  <li
                    key={l.href}
                    className="border-b-2 border-black/10 last:border-0"
                  >
                    <Link
                      href={l.href}
                      onClick={() => {
                        if (l.soon) recordFeatureClick(l.soon, "nav");
                        setOpen(false);
                      }}
                      className="block py-3 text-sm font-extrabold uppercase tracking-wide hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
