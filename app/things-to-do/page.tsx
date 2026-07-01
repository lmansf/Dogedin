import type { Metadata } from "next";
import BusinessCard from "@/components/spots/BusinessCard";
import { getBusinesses, persistenceEnabled } from "@/lib/businesses";

export const metadata: Metadata = {
  title: "Things to do in Dunedin · Dogedin",
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
          <code className="border border-black bg-white px-1">supabase/spots.sql</code>{" "}
          to set up the tables.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {businesses.map((b) => (
          <BusinessCard key={b.id} business={b} canPersist={canPersist} />
        ))}
      </div>
    </div>
  );
}
