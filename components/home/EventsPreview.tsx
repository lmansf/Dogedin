import Link from "next/link";
import { getUpcomingEvents, formatEventDate } from "@/lib/events";

// Homepage digest of the next few calendar events. Renders nothing when the
// feed isn't configured or is empty — the homepage shouldn't nag visitors
// about setup (the /events page carries that state).
export default async function EventsPreview() {
  const events = await getUpcomingEvents(3);
  if (events.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-extrabold tracking-tight">
          What&apos;s on this week 📅
        </h2>
        <Link
          href="/events"
          className="shrink-0 text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
        >
          Full calendar →
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="flex items-center gap-4 border-[3px] border-black bg-white p-3 shadow-hard"
          >
            <div className="shrink-0 border-2 border-black bg-[var(--gold)] px-2 py-1">
              <p className="font-display text-xs font-black uppercase leading-tight">
                {formatEventDate(ev)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-extrabold leading-tight">
                {ev.title}
              </p>
              {ev.location && (
                <p className="truncate text-xs font-bold text-black/50">
                  📍 {ev.location}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
