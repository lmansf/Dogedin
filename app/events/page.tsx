import type { Metadata } from "next";
import { getUpcomingEvents, formatEventDate } from "@/lib/events";

export const metadata: Metadata = {
  title: "Dog events in Dunedin · Dogedin",
  description:
    "Upcoming dog-friendly events around Dunedin, FL — auto-pulled from a public calendar feed.",
};

// Auto-refreshing (ISR) — the page is regenerated at most once an hour so new
// calendar entries appear with no manual work.
export const revalidate = 3600;

export default async function EventsPage() {
  const events = await getUpcomingEvents();
  const configured = Boolean(process.env.EVENTS_ICS_URL);

  return (
    <div className="flex flex-col gap-8">
      <section className="border-[3px] border-black bg-[var(--green)] p-6 shadow-hard-lg md:p-8">
        <h1 className="font-display text-4xl font-extrabold leading-tight text-[var(--sand)] md:text-6xl">
          What&apos;s on
        </h1>
        <p className="mt-3 max-w-xl font-bold text-[var(--sand)]/90">
          Dog-friendly happenings around Dunedin — pulled straight from the
          community calendar, updated automatically.
        </p>
      </section>

      {!configured ? (
        <p className="border-[3px] border-black bg-[var(--gold)]/30 px-4 py-3 text-sm font-bold">
          📅 No calendar connected yet — set{" "}
          <code className="border border-black bg-white px-1">EVENTS_ICS_URL</code>{" "}
          to a public iCal feed (e.g. a Google Calendar&apos;s public iCal
          address) and events will appear here automatically.
        </p>
      ) : events.length === 0 ? (
        <p className="border-[3px] border-black bg-white px-4 py-6 text-sm font-bold shadow-hard">
          No upcoming events on the calendar right now — check back soon!
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {events.map((ev) => {
            const body = (
              <>
                <div className="shrink-0 border-[3px] border-black bg-[var(--gold)] px-3 py-2 text-center">
                  <p className="font-display text-sm font-black uppercase leading-tight">
                    {formatEventDate(ev)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-extrabold leading-tight">
                    {ev.title}
                  </p>
                  {ev.location && (
                    <p className="mt-1 text-sm font-bold text-black/50">
                      📍 {ev.location}
                    </p>
                  )}
                  {ev.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-black/60">
                      {ev.description}
                    </p>
                  )}
                </div>
              </>
            );
            return (
              <li key={ev.id}>
                {ev.url ? (
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 border-[3px] border-black bg-white p-4 shadow-hard transition-transform hover:-translate-y-1"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="flex items-center gap-4 border-[3px] border-black bg-white p-4 shadow-hard">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
