import Link from "next/link";
import Image from "next/image";
import { getBusinesses, averageRating } from "@/lib/businesses";

// Homepage digest of the local guide: the three best-loved dog-friendly spots
// (by rating, then review count).
export default async function SpotsPreview() {
  const businesses = await getBusinesses();
  if (businesses.length === 0) return null;

  const top = [...businesses]
    .sort(
      (a, b) =>
        averageRating(b.reviews) - averageRating(a.reviews) ||
        b.reviews.length - a.reviews.length
    )
    .slice(0, 3);

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-extrabold tracking-tight">
          Pack-approved spots 🗺
        </h2>
        <Link
          href="/things-to-do"
          className="shrink-0 text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
        >
          See the local guide →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {top.map((b) => {
          const avg = averageRating(b.reviews);
          return (
            <Link
              key={b.id}
              href="/things-to-do"
              className="flex flex-col border-[3px] border-black bg-white shadow-hard transition-transform hover:-translate-y-1"
            >
              <div className="relative aspect-[16/9] border-b-[3px] border-black bg-zinc-100">
                <Image
                  src={b.image}
                  alt={b.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 340px"
                  className="object-cover"
                />
                {/* "🎟 Deal" badge hidden while the Club is pre-launch —
                    deals are member perks and there are no members yet. */}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <span className="w-fit border-2 border-black bg-[var(--turq)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--sand)]">
                  {b.category}
                </span>
                <h3 className="font-display text-lg font-extrabold leading-tight">
                  {b.name}
                </h3>
                <p className="text-xs font-bold text-black/50">
                  <span aria-hidden className="text-[var(--gold)]">
                    {"★★★★★".slice(0, Math.round(avg))}
                  </span>{" "}
                  {avg > 0 ? avg.toFixed(1) : "New"} · {b.reviews.length} review
                  {b.reviews.length === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
