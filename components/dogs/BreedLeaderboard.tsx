import { getBreedCounts, type BreedCount } from "@/lib/dogProfiles";

// Bars are arranged tallest-in-the-middle, tapering symmetrically outward —
// a "leaderboard shaped like a bell curve" rather than a strict ranked sort.
// Purely a visual arrangement; the data itself isn't a real normal
// distribution.
function bellOrder<T>(sortedDesc: T[]): T[] {
  const n = sortedDesc.length;
  const center = Math.floor((n - 1) / 2);
  const positions: number[] = [center];
  for (let offset = 1; positions.length < n; offset++) {
    const right = center + offset;
    const left = center - offset;
    if (right < n) positions.push(right);
    if (positions.length < n && left >= 0) positions.push(left);
  }
  const result: T[] = new Array(n);
  positions.forEach((pos, i) => {
    result[pos] = sortedDesc[i];
  });
  return result;
}

const ACCENTS = ["var(--gold)", "var(--turq)", "var(--sky)", "var(--coral)", "var(--orange)"];
const MAX_BAR_PX = 180;
const MIN_BAR_PX = 16;

export default async function BreedLeaderboard() {
  const counts = await getBreedCounts();
  if (counts.length === 0) return null;

  const ordered = bellOrder<BreedCount>(counts);
  const max = Math.max(...counts.map((c) => c.count));

  return (
    <section className="border-[3px] border-black bg-white p-5 shadow-hard-lg">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold">Breed leaderboard</h2>
        <span className="hidden -rotate-2 border-2 border-black bg-[var(--gold)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide shadow-hard sm:inline-block">
          {counts.reduce((sum, c) => sum + c.count, 0)} dogs
        </span>
      </div>
      <p className="mt-1 text-sm font-bold text-black/50">
        Every breed represented in the Dogedin pack, most common in the middle.
      </p>

      <div className="mt-6 overflow-x-auto">
        <div className="flex min-w-max items-end gap-3 px-1">
          {ordered.map((c) => {
            const height = Math.max(MIN_BAR_PX, Math.round((c.count / max) * MAX_BAR_PX));
            const accent = ACCENTS[counts.indexOf(c) % ACCENTS.length];
            return (
              <div
                key={c.breed}
                title={`${c.breed}: ${c.count} dog${c.count === 1 ? "" : "s"}`}
                className="flex w-16 shrink-0 flex-col items-center gap-1"
              >
                <span className="text-xs font-black">{c.count}</span>
                <div
                  style={{ height, background: accent }}
                  className="w-full rounded-t-md border-[3px] border-b-0 border-black shadow-hard transition-transform hover:-translate-y-0.5"
                />
                <span className="mt-1 line-clamp-2 h-8 w-full text-center text-[10px] font-bold leading-tight text-black/60">
                  {c.breed}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
