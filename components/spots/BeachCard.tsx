// Beach-day card for the local guide: today's tides and the latest water
// temperature from NOAA CO-OPS station 8726724 (Clearwater Beach — the
// nearest tide station to Honeymoon Island Dog Beach). Key-free public API,
// fetched server-side and cached for an hour; renders nothing if NOAA is
// unreachable so the guide never shows a broken widget.
const STATION = "8726724";
const BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

type Tide = { time: string; type: "H" | "L" };

// "2026-07-05 14:36" -> "2:36 pm"
function clock(t: string): string {
  const hhmm = t.split(" ")[1] ?? "";
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

async function noaa(params: string): Promise<any | null> {
  try {
    const res = await fetch(
      `${BASE}?station=${STATION}&time_zone=lst_ldt&units=english&format=json&application=dogedin&${params}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function BeachCard() {
  const [tidesJson, tempJson] = await Promise.all([
    noaa("product=predictions&datum=MLLW&interval=hilo&date=today"),
    noaa("product=water_temperature&date=latest"),
  ]);

  const tides: Tide[] = (tidesJson?.predictions ?? [])
    .map((p: any) => ({ time: p.t as string, type: p.type as "H" | "L" }))
    .slice(0, 4);
  const waterTemp: number | null = tempJson?.data?.[0]?.v
    ? Math.round(parseFloat(tempJson.data[0].v))
    : null;

  // NOAA down or empty -> no widget at all, never a broken one.
  if (tides.length === 0 && waterTemp === null) return null;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border-[3px] border-black bg-[var(--sky)]/40 p-4 shadow-hard">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="border-2 border-black bg-[var(--sand)] px-2 py-0.5 text-xs font-black uppercase tracking-widest shadow-hard">
          🌊 Beach day?
        </span>
        {tides.length > 0 && (
          <p className="text-sm font-bold text-black/80">
            Tides today:{" "}
            {tides.map((t, i) => (
              <span key={t.time}>
                {i > 0 && " · "}
                <span className="font-black">{t.type === "H" ? "High" : "Low"}</span>{" "}
                {clock(t.time)}
              </span>
            ))}
          </p>
        )}
        {waterTemp !== null && (
          <p className="text-sm font-bold text-black/80">
            Water <span className="font-black">{waterTemp}°F</span>
          </p>
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-black/45">
        NOAA · Clearwater Beach, by Honeymoon Island
      </p>
    </section>
  );
}
