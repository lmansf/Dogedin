import type { Metadata } from "next";
import Link from "next/link";
import InterestButton from "@/components/InterestButton";
import TrackVisit from "@/components/TrackVisit";

export const metadata: Metadata = {
  title: "Events — coming soon",
  description:
    "A dog-friendly events calendar for Dunedin, FL is in the works.",
};

// The events calendar is paused pre-launch, same treatment as the Club: a
// promise-free teaser whose only job is to register interest. The calendar
// machinery (lib/events.ts ICS pull, EventsPreview, the events_feed ad slot)
// stays in the codebase, just unlinked, so relaunching is a page swap.
export default function EventsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <TrackVisit feature="events" />
      <section className="border-[3px] border-black bg-[var(--green)] p-6 shadow-hard-lg md:p-8">
        <p className="w-fit -rotate-2 border-2 border-black bg-[var(--gold)] px-2 py-0.5 text-xs font-black uppercase tracking-wide text-[var(--ink)]">
          Coming soon
        </p>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight text-[var(--sand)] md:text-6xl">
          What&apos;s on 📅
        </h1>
        <p className="mt-3 max-w-xl font-bold text-[var(--sand)]/90">
          A dog-friendly events calendar for Dunedin is in the works. Nothing
          on the board yet — we&apos;ll open it when there&apos;s something
          worth showing up for.
        </p>
      </section>

      <div className="flex flex-col gap-3 border-[3px] border-black bg-white p-6 shadow-hard">
        <p className="text-sm font-bold text-black/70">
          Want a town calendar of markets, meetups and yappy hours? Give us a
          paw so we know to build it. No email, no sign-up — just a tally.
        </p>
        <InterestButton feature="events" />
      </div>

      <p className="text-center text-sm font-bold text-black/60">
        In the meantime —{" "}
        <Link
          href="/things-to-do"
          className="font-black text-[var(--turq)] underline"
        >
          the pack&apos;s favourite dog-friendly spots →
        </Link>
      </p>
    </div>
  );
}
