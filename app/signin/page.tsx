import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "One Dogedin account for everything — dog parents manage their pups, businesses see how their listing performs.",
};

// The front door for both audiences. It's ONE shared account system (same
// Supabase project everywhere) — this page just routes each person to the
// surface where their sign-in form lives: dog parents to /account (My Dogs),
// businesses to the insights portal on the media-kit site (via /portal).
export default function SignInPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="border-[3px] border-black bg-[var(--sky)] p-6 shadow-hard-lg">
        <h1 className="font-display text-4xl font-extrabold leading-tight">
          Sign in to Dogedin
        </h1>
        <p className="mt-2 font-bold text-[var(--ink)]/70">
          One account works everywhere — pick your door.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/account"
          className="flex flex-col gap-2 border-[3px] border-black bg-white p-6 shadow-hard transition-transform hover:-translate-y-1"
        >
          <span className="text-5xl" aria-hidden>
            🐶
          </span>
          <span className="font-display text-2xl font-extrabold">
            Dog parents
          </span>
          <span className="text-sm font-bold text-black/60">
            Manage your dogs, their profiles, photos, friends and tags.
          </span>
          <span className="mt-auto pt-2 text-sm font-black uppercase tracking-wide text-[var(--turq)]">
            Sign in / register →
          </span>
        </Link>

        <a
          href="/portal"
          className="flex flex-col gap-2 border-[3px] border-black bg-white p-6 shadow-hard transition-transform hover:-translate-y-1"
        >
          <span className="text-5xl" aria-hidden>
            🏪
          </span>
          <span className="font-display text-2xl font-extrabold">
            Businesses
          </span>
          <span className="text-sm font-bold text-black/60">
            See how your listing performs — views, taps, calls, reviews — and
            manage your team.
          </span>
          <span className="mt-auto pt-2 text-sm font-black uppercase tracking-wide text-[var(--coral)]">
            Business portal →
          </span>
        </a>
      </div>

      <p className="text-center text-sm font-bold text-black/50">
        Same email and password on both — a business account is just a Dogedin
        account whose email is on a listing.
      </p>

      <p className="text-center text-sm font-bold text-black/60">
        New business, not listed yet?{" "}
        <Link href="/list-your-business" className="font-black underline">
          List your business first →
        </Link>
      </p>
    </div>
  );
}
