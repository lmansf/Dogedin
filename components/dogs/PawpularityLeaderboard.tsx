import Link from "next/link";
import { getPawpularityLeaderboard } from "@/lib/dogPosts";

const MEDALS = ["🥇", "🥈", "🥉"];

// Top dogs by total paws across their approved photos — a fun ranked list
// (not a bar chart, since the entities themselves — photo + name — are the
// point) sitting alongside the breed leaderboard on /dogs.
export default async function PawpularityLeaderboard() {
  const entries = await getPawpularityLeaderboard(10);
  if (entries.length === 0) return null;

  return (
    <section className="border-[3px] border-black bg-white p-5 shadow-hard-lg">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold">Pawpularity contest</h2>
        <span className="hidden -rotate-2 border-2 border-black bg-[var(--coral)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-hard sm:inline-block">
          🐾 Top dogs
        </span>
      </div>
      <p className="mt-1 text-sm font-bold text-black/50">
        Ranked by paws given to their photos on the pack&apos;s feed.
      </p>

      <ol className="mt-4 flex flex-col gap-2">
        {entries.map((dog, i) => (
          <li key={dog.slug}>
            <Link
              href={`/dog/${dog.slug}`}
              className="flex items-center gap-3 border-2 border-black bg-white p-2 transition-transform hover:-translate-y-0.5 hover:shadow-hard"
            >
              <span className="w-8 shrink-0 text-center text-lg font-black">
                {MEDALS[i] ?? `#${i + 1}`}
              </span>
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-black bg-zinc-100">
                {dog.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dog.photoUrl} alt={dog.dogName} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-xl">🐶</span>
                )}
              </div>
              <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold">
                {dog.dogName}
              </span>
              <span className="shrink-0 text-sm font-black text-[var(--coral)]">
                🐾 {dog.pawCount}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
