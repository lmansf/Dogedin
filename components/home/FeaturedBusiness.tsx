import Link from "next/link";
import Image from "next/image";
import { averageRating } from "@/lib/businesses";
import { getTopBusinessCached } from "@/lib/topBusiness";

// The single best-loved spot in the local guide: highest average rating, ties
// broken by review count. Reads the same cached lookup as the layout marquee's
// "TOP OF THE PACK" line, so the banner and this card always agree and both
// update together as ratings change. Renders nothing while the guide is empty.
export default async function FeaturedBusiness() {
  const business = await getTopBusinessCached();
  if (!business) return null;

  const avg = averageRating(business.reviews);
  return (
    <section>
      <Link
        href="/things-to-do"
        className="flex flex-col border-[3px] border-black bg-white shadow-hard-lg transition-transform hover:-translate-y-1 sm:flex-row"
      >
        {business.image && (
          <div className="relative aspect-[16/9] border-b-[3px] border-black bg-zinc-100 sm:aspect-auto sm:w-2/5 sm:border-b-0 sm:border-r-[3px]">
            <Image
              src={business.image}
              alt={business.name}
              fill
              sizes="(max-width: 640px) 100vw, 460px"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-5 md:p-6">
          <span className="w-fit -rotate-2 border-[3px] border-black bg-[var(--gold)] px-3 py-1 text-xs font-black uppercase tracking-widest shadow-hard">
            ⭐ Top of the pack
          </span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight">
            {business.name}
          </h2>
          <p className="flex flex-wrap items-center gap-2">
            <span className="border-2 border-black bg-[var(--turq)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--sand)]">
              {business.category}
            </span>
            {business.neighborhood && (
              <span className="text-xs font-bold uppercase tracking-wide text-black/50">
                {business.neighborhood}
              </span>
            )}
          </p>
          <p className="text-sm font-bold text-black/50">
            <span aria-hidden className="text-[var(--gold)]">
              {"★★★★★".slice(0, Math.round(avg))}
            </span>{" "}
            {avg > 0 ? avg.toFixed(1) : "New"} · {business.reviews.length} review
            {business.reviews.length === 1 ? "" : "s"}
          </p>
          <p className="line-clamp-3 text-sm font-bold text-black/70">
            {business.description}
          </p>
          <span className="mt-2 w-fit text-xs font-black uppercase tracking-wide text-[var(--turq)]">
            See it in the local guide →
          </span>
        </div>
      </Link>
    </section>
  );
}
