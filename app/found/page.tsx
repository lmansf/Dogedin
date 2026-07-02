import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveTag } from "@/lib/dogProfiles";

export const metadata: Metadata = {
  title: "Found a dog?",
  description:
    "Found a lost dog? Enter the code from its Dogedin tag to reach the owner.",
};

// Lost-dog lookup. A physical tag / QR points here as /found?tag=CODE (or the
// finder types the code). We resolve the code to a profile and forward to it,
// where the owner's contact shows if they opted in. QR codes may instead point
// straight at /dog/{slug}; this page is the type-it-in fallback.
export default async function FoundPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag = "" } = await searchParams;
  const code = tag.trim();

  if (code) {
    const slug = await resolveTag(code);
    if (slug) redirect(`/dog/${slug}`);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <section className="border-[3px] border-black bg-[var(--coral)] p-6 shadow-hard-lg">
        <h1 className="font-display text-4xl font-extrabold leading-tight text-white md:text-5xl">
          Found a dog?
        </h1>
        <p className="mt-2 font-bold text-white/90">
          Enter the code printed on the dog&apos;s Dogedin tag to reach their
          human.
        </p>
        <form method="get" className="mt-4 flex gap-2">
          <input
            type="text"
            name="tag"
            defaultValue={code}
            placeholder="e.g. K7M2QP4A"
            aria-label="Tag code"
            autoCapitalize="characters"
            className="w-full border-[3px] border-black bg-white px-3 py-2 font-mono text-lg font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-[var(--turq)]"
          />
          <button
            type="submit"
            className="shrink-0 border-[3px] border-black bg-[var(--gold)] px-5 py-2 text-sm font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            Look up
          </button>
        </form>
      </section>

      {code && (
        <div className="border-[3px] border-black bg-white p-5 text-sm shadow-hard">
          <p className="font-bold">
            No dog found for code “{code}”.
          </p>
          <p className="mt-1 text-black/60">
            Double-check the code, or{" "}
            <Link href="/dogs" className="font-black underline">
              search by name
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
