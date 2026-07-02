import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { searchDogs, dogPhotoUrl } from "@/lib/dogProfiles";

export const metadata: Metadata = {
  title: "Find a dog",
  description:
    "Look up any registered Dunedin dog by their name — or their human's.",
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
          Every registered dog in Dunedin gets a page. Search by the dog&apos;s
          name — or their human&apos;s.
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

      {!query && (
        <div className="border-[3px] border-black bg-white p-5 text-sm shadow-hard">
          <p className="font-bold">
            New to the pack?{" "}
            <Link href="/register" className="font-black text-[var(--turq)] underline">
              Register your dog →
            </Link>
          </p>
          <p className="mt-1 font-bold">
            Found a dog with a Dogedin tag?{" "}
            <Link href="/found" className="font-black text-[var(--coral)] underline">
              Look up their tag →
            </Link>
          </p>
        </div>
      )}

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
