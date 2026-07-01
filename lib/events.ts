// Auto-pulled events feed. Reads a PUBLIC iCal (.ics) URL — e.g. a Google
// Calendar's "public address in iCal format", or any site's iCal export — and
// parses upcoming events. Zero manual maintenance: the /events page revalidates
// on a timer (ISR), so new calendar entries appear on their own.
//
// Set EVENTS_ICS_URL to the feed. With it unset we return [] and the page shows
// an empty state, so the build/site works without it.

export type CalendarEvent = {
  id: string;
  title: string;
  start: number; // epoch ms (see note on time handling below)
  end: number | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  url: string | null;
};

// Unescape RFC 5545 TEXT values (\n \, \; \\). Single pass over each backslash
// escape so "\\n" (escaped backslash + n) becomes "\n" literally, not a newline.
function unescapeText(v: string): string {
  return v.replace(/\\([\\nN,;])/g, (_, c) =>
    c === "n" || c === "N" ? "\n" : c
  );
}

// Parse an iCal date/date-time into epoch ms. We interpret the written
// wall-clock components directly (built as UTC) so a calendar's local times
// display exactly as authored; the page formats in a fixed timezone. This keeps
// things dependency-free and predictable for typical TZID-based feeds.
function parseICalDate(value: string): { ms: number; allDay: boolean } | null {
  const m = value.match(
    /(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/
  );
  if (!m) return null;
  const [, y, mo, d, h = "12", mi = "00", s = "00"] = m;
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  return { ms, allDay: !value.includes("T") };
}

// Split a raw property line "KEY;PARAMS:VALUE" into its pieces.
function splitLine(line: string): { key: string; value: string } | null {
  const idx = line.indexOf(":");
  if (idx === -1) return null;
  const left = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const key = left.split(";")[0].toUpperCase();
  return { key, value };
}

export function parseIcs(ics: string): CalendarEvent[] {
  // Unfold folded lines (a leading space/tab continues the previous line).
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const events: CalendarEvent[] = [];
  let cur: Record<string, string> | null = null;

  for (const raw of lines) {
    if (raw === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (raw === "END:VEVENT") {
      if (cur) {
        const startRaw = cur.DTSTART;
        const parsedStart = startRaw ? parseICalDate(startRaw) : null;
        if (parsedStart) {
          const parsedEnd = cur.DTEND ? parseICalDate(cur.DTEND) : null;
          events.push({
            id: cur.UID || `${parsedStart.ms}-${cur.SUMMARY ?? ""}`,
            title: cur.SUMMARY ? unescapeText(cur.SUMMARY) : "Untitled event",
            start: parsedStart.ms,
            end: parsedEnd ? parsedEnd.ms : null,
            allDay: parsedStart.allDay,
            location: cur.LOCATION ? unescapeText(cur.LOCATION) : null,
            description: cur.DESCRIPTION ? unescapeText(cur.DESCRIPTION) : null,
            url: cur.URL || null,
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const parsed = splitLine(raw);
    if (parsed) cur[parsed.key] = parsed.value;
  }

  return events;
}

export async function getUpcomingEvents(limit = 20): Promise<CalendarEvent[]> {
  const url = process.env.EVENTS_ICS_URL;
  if (!url) return [];
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const ics = await res.text();
    const now = Date.now() - 12 * 3600 * 1000; // keep events from earlier today
    return parseIcs(ics)
      .filter((e) => (e.end ?? e.start) >= now)
      .sort((a, b) => a.start - b.start)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// Format helpers. We echo the calendar's authored wall-clock time: date-times
// are built from their literal components as UTC (see parseICalDate), so we also
// FORMAT in UTC. That way a Google Calendar event authored as 7:00 PM (via TZID)
// displays as 7:00 PM regardless of the server/visitor timezone. (A rare feed
// using absolute "…Z" times would show UTC; typical single-calendar feeds use
// local TZID times, which is the case this optimises for.)
const TZ = "UTC";

export function formatEventDate(ev: CalendarEvent): string {
  const d = new Date(ev.start);
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  }).format(d);
  if (ev.allDay) return date;
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
  return `${date} · ${time}`;
}
