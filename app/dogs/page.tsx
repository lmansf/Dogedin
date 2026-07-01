import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { searchDogs, dogPhotoUrl } from "@/lib/dogProfiles";

export const metadata: Metadata = {
  title: "Find a dog · Dogedin",
  description: "Search registered dogs by dog name or owner name.",
};

// Search page. Uses a plain GET form (name=q) so it works with no JS —
// mobile-first and shareable. Results come from the search_dogs RPC, which
// matches on dog OR owner name but never returns owner names or private
// contact info.
export default async function DogSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query ? await searchDogs(query) : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="border-[3px] border-black bg-[var(--sky)] p-6 shadow-hard-lg">
        <h1 className="font-display text-4xl font-extrabold leading-tight md:text-5xl">
          Find a dog
        </h1>
        <p className="mt-2 font-bold text-[var(--ink)]/70">
          Search by a dog&apos;s name or their owner&apos;s name.
        </p>

        <form method="get" className="mt-4 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="e.g. Angus"
            aria-label="Search dogs"
            className="w-full border-[3px] border-black bg-white px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-[var(--turq)]"
          />
          <button
            type="submit"
            className="shrink-0 border-[3px] border-black bg-[var(--gold)] px-5 py-2 text-sm font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            Search
          </button>
        </form>
      </section>

      {query && (
        <p className="text-sm font-bold text-black/50">
          {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
        </p>
      )}

      {query && results.length === 0 && (
        <div className="border-[3px] border-black bg-white p-6 text-sm shadow-hard">
          No dogs matched.{" "}
          <Link href="/register" className="font-black underline">
            Register one →
          </Link>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {results.map((dog) => {
          const img = dogPhotoUrl(dog.photoPath);
          return (
            <li key={dog.slug}>
              <Link
                href={`/dog/${dog.slug}`}
                className="flex items-center gap-4 border-[3px] border-black bg-white p-3 shadow-hard transition-transform hover:-translate-y-1"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden border-2 border-black bg-zinc-100">
                  {img ? (
                    <Image
                      src={img}
                      alt={dog.dogName}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-2xl">🐶</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg font-extrabold">{dog.dogName}</p>
                  <p className="text-xs font-bold text-black/50">
                    {dog.breed || "Unknown breed"}
                    {dog.hasContact && " · 🚨 lost-dog contact on"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
