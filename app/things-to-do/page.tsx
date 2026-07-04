import type { Metadata } from "next";
import Link from "next/link";
import BusinessCard from "@/components/spots/BusinessCard";
import ComingSoonLink from "@/components/ComingSoonLink";
import AdSlot from "@/components/ads/AdSlot";
import { getBusinesses, persistenceEnabled } from "@/lib/businesses";

export const metadata: Metadata = {
  title: "Things to do in Dunedin",
  description:
    "Dog-friendly restaurants, breweries, beaches and parks around Dunedin, FL — reviewed by the pack.",
};

// Community "things to do" board. Curated Dunedin businesses (from Supabase, or
// the demo seed as a fallback) that customers can review, upvote, and reply to.
export default async function ThingsToDoPage() {
  const businesses = await getBusinesses();
  const canPersist = persistenceEnabled();

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden border-[3px] border-black bg-[var(--turq)] p-8 shadow-hard-lg">
        <div className="dots pointer-events-none absolute inset-0" />
        <div className="relative">
          <span className="inline-block -rotate-2 border-[3px] border-black bg-[var(--sand)] px-3 py-1 text-xs font-black uppercase tracking-widest shadow-hard">
            🌴 Local guide
          </span>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[0.95] text-[var(--sand)] md:text-6xl">
            Things to do in Dunedin
          </h1>
          <p className="mt-4 max-w-xl text-lg font-bold text-[var(--sand)]/90">
            The pack's favourite dog-friendly spots — breweries, beaches, brunch
            and boardwalks. Read the reviews, upvote the good calls, and add your
            own.
          </p>
        </div>
      </section>

      {!canPersist && (
        <p className="border-[3px] border-black bg-[var(--gold)]/30 px-4 py-3 text-sm font-bold">
          👋 Preview mode: Supabase isn't connected yet, so new reviews, upvotes
          and replies show for this session but aren't saved. See{" "}
          <code className="border border-black bg-white px-1">supabase/schema.sql</code>{" "}
          to set up the tables.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {businesses.slice(0, 2).map((b) => (
          <BusinessCard key={b.id} business={b} canPersist={canPersist} />
        ))}
        {/* Native local-partner card: same anatomy as the guide's own cards,
            clearly labelled, placed where readers are choosing where to go. */}
        <AdSlot slot="ttd_grid" variant="card" label="Local guide partner" />
        {businesses.slice(2).map((b) => (
          <BusinessCard key={b.id} business={b} canPersist={canPersist} />
        ))}
      </div>

      {/* Club teaser — pre-launch, so no deals are promised here. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-[3px] border-black bg-[var(--gold)]/25 p-4">
        <p className="text-sm font-bold">
          🎟 The Dogedin Club is in the works — that&apos;s all we can say for
          now.
        </p>
        <ComingSoonLink
          feature="club"
          source="guide"
          href="/membership"
          className="shrink-0 border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5"
        >
          Coming soon →
        </ComingSoonLink>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-[3px] border-black bg-white p-4 shadow-hard">
        <p className="text-sm font-bold text-black/70">
          🌴 Run a dog-friendly spot in Dunedin? Get listed here — free.
        </p>
        <Link
          href="/list-your-business"
          className="shrink-0 border-[3px] border-black bg-[var(--gold)] px-4 py-2 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5"
        >
          List your business →
        </Link>
      </div>
    </div>
  );
}
