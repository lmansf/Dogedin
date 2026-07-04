import type { Metadata } from "next";
import Link from "next/link";
import InterestButton from "@/components/InterestButton";
import TrackVisit from "@/components/TrackVisit";

export const metadata: Metadata = {
  title: "Dogedin Club — coming soon",
  description: "The Dogedin Club isn't open yet. Something for the pack is in the works.",
};

// The Club is paused pre-launch: no perks list, no price, no checkout, no
// sign-in — nothing promised until there's something real to promise. The
// page's only job is to register interest (see InterestButton). The old
// membership flow (MembershipCta, Stripe checkout, /card) stays in the
// codebase, just unlinked, so relaunching is a page swap.
export default function MembershipPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <TrackVisit feature="club" />
      <section className="border-[3px] border-black bg-[var(--red)] p-6 shadow-hard-lg md:p-8">
        <p className="w-fit -rotate-2 border-2 border-black bg-[var(--gold)] px-2 py-0.5 text-xs font-black uppercase tracking-wide text-[var(--ink)]">
          Coming soon
        </p>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight text-[var(--sand)] md:text-6xl">
          The Dogedin Club
        </h1>
        <p className="mt-3 max-w-xl font-bold text-[var(--sand)]/90">
          We&apos;re cooking up something for the pack. No details to share yet
          — and we&apos;d rather say nothing than promise something that isn&apos;t
          ready.
        </p>
      </section>

      <div className="flex flex-col gap-3 border-[3px] border-black bg-white p-6 shadow-hard">
        <p className="text-sm font-bold text-black/70">
          Curious? Give us a paw and we&apos;ll know you&apos;re out there. No
          email, no sign-up — just a tally.
        </p>
        <InterestButton feature="club" />
      </div>

      <p className="text-center text-sm font-bold text-black/60">
        In the meantime —{" "}
        <Link
          href="/register"
          className="font-black text-[var(--turq)] underline"
        >
          register your dog free →
        </Link>{" "}
        or{" "}
        <Link
          href="/things-to-do"
          className="font-black text-[var(--turq)] underline"
        >
          explore the local guide →
        </Link>
      </p>
    </div>
  );
}
