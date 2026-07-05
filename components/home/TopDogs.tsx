import Link from "next/link";
import Image from "next/image";
import { listTopPawedDogs, dogPhotoUrl } from "@/lib/dogProfiles";
import PawButton from "@/components/dogs/PawButton";

const MEDALS = ["🥇", "🥈", "🥉"];

// "Top of the pack": the community's most-pawed dogs, front and centre on the
// home page. Ranked by profile paws (dog_paws) — a real, one-per-person tally,
// so the leaderboard can't be gamed. Each card carries a live paw button, so
// the front page is itself a place to add your paw. Hidden entirely until the
// pack has at least one registered dog; when nobody's been pawed yet it still
// shows the roster with an invitation to start.
export default async function TopDogs() {
  const dogs = await listTopPawedDogs(8);
  if (dogs.length === 0) return null;
  const anyPaws = dogs.some((d) => d.pawCount > 0);

  return (
    <section className="border-[3px] border-black bg-white p-4 shadow-hard-lg sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight">
            Top of the pack 🏆
          </h2>
          <p className="mt-1 text-sm font-bold text-black/50">
            {anyPaws
              ? "Dunedin's most-pawed dogs — tap a 🐾 to add yours."
              : "Give your favourites a 🐾 — the most-loved dogs rise to the top here."}
          </p>
        </div>
        <Link
          href="/dogs"
          className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
        >
          Find a dog →
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {dogs.map((dog, i) => {
          const img = dogPhotoUrl(dog.photoPath);
          return (
            <li
              key={dog.slug}
              className="flex flex-col overflow-hidden border-[3px] border-black bg-[var(--sand)] shadow-hard"
            >
              <Link
                href={`/dog/${dog.slug}`}
                className="relative block aspect-square border-b-[3px] border-black bg-zinc-100"
              >
                {img ? (
                  <Image
                    src={img}
                    alt={dog.dogName}
                    fill
                    sizes="(max-width: 640px) 45vw, 220px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-4xl">🐶</span>
                )}
                {anyPaws && i < 3 && (
                  <span className="absolute left-1.5 top-1.5 text-xl drop-shadow">
                    {MEDALS[i]}
                  </span>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/dog/${dog.slug}`}
                    className="block truncate font-display text-lg font-extrabold leading-tight hover:underline"
                  >
                    {dog.dogName}
                  </Link>
                  <p className="truncate text-[11px] font-bold uppercase tracking-wide text-black/40">
                    {dog.breed || "Very good dog"}
                  </p>
                </div>
                <div className="mt-auto">
                  <PawButton
                    dogId={dog.id}
                    slug={dog.slug}
                    dogName={dog.dogName}
                    initialCount={dog.pawCount}
                    size="sm"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
