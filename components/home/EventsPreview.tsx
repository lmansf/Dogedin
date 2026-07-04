import ComingSoonLink from "@/components/ComingSoonLink";

// Homepage slot for the events calendar — pre-launch, so it's a promise-free
// teaser whose clicks are counted as interest. The old digest (ICS pull via
// lib/events.ts) is in git history; restore it when the calendar launches.
export default function EventsPreview() {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border-[3px] border-black bg-white p-6 shadow-hard-lg">
      <div>
        <h2 className="font-display text-3xl font-extrabold tracking-tight">
          What&apos;s on 📅
        </h2>
        <p className="mt-1 max-w-lg text-sm font-bold text-black/60">
          A dog-friendly events calendar for Dunedin is in the works.
        </p>
      </div>
      <ComingSoonLink
        feature="events"
        source="home"
        href="/events"
        className="shrink-0 border-[3px] border-black bg-[var(--gold)] px-5 py-2.5 text-sm font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
      >
        Coming soon →
      </ComingSoonLink>
    </section>
  );
}
