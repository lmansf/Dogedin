"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { relatedFor } from "@/lib/related";

// "Keep exploring" module, injected once in the root layout so every content
// page ends with relevant onward links instead of a dead end (Workstream C).
// Commerce destinations are visually distinct and, from non-commerce pages,
// tend to lead — but only ever when they're topically relevant.
//
// Deliberately absent on flows where onward promo would be wrong: the admin
// console, password recovery, the member card, and the lost-dog lookup (a
// worried owner or finder should stay focused, not be nudged to shop).
const SKIP = /^\/(admin|reset-password|card|found)(\/|$)/;

export default function ContinueExploring() {
  const pathname = usePathname() || "/";
  if (SKIP.test(pathname)) return null;

  const links = relatedFor(pathname);
  if (links.length === 0) return null;

  return (
    <section
      aria-label="Keep exploring"
      className="mx-auto mt-4 max-w-6xl px-4"
    >
      <div className="border-[3px] border-black bg-[var(--sand)] p-5 shadow-hard">
        <h2 className="font-display text-xl font-extrabold">Keep exploring 🐾</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`flex h-full min-h-[44px] flex-col justify-center border-[3px] border-black px-4 py-3 shadow-hard transition-transform hover:-translate-y-1 active:translate-y-0 active:shadow-none ${
                  l.commerce
                    ? "bg-[var(--gold)]"
                    : "bg-white"
                }`}
              >
                <span className="font-display text-base font-extrabold leading-tight">
                  {l.label} →
                </span>
                <span className="mt-0.5 text-xs font-bold text-black/60">
                  {l.blurb}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
