"use client";

import { useMemo, useState } from "react";
import BusinessCard from "./BusinessCard";
import AdSlot from "@/components/ads/AdSlot";
import type { Business } from "@/lib/businesses";

// The /things-to-do grid, grouped into town sections (the server hands us the
// list already in ring order — Dunedin first, then Clearwater, Palm Harbor,
// Tarpon Springs, then anywhere else) with instant category chips on top.
// Client-side so filtering doesn't refetch and the AdSlot (also a client
// component) keeps its native place inside the first section's grid.
export default function DirectoryGrid({
  businesses,
  canPersist,
}: {
  businesses: Business[];
  canPersist: boolean;
}) {
  const [category, setCategory] = useState<string | null>(null);

  // Chips for the categories actually present, alphabetical so the row is
  // stable as listings come and go. Hidden entirely when there's just one.
  const categories = useMemo(
    () => [...new Set(businesses.map((b) => b.category))].sort(),
    [businesses]
  );

  const filtered = category
    ? businesses.filter((b) => b.category === category)
    : businesses;

  // Consecutive-city grouping preserves the server's ring order without
  // re-deriving it here (and without pulling the data layer into the bundle).
  const sections: { city: string; items: Business[] }[] = [];
  for (const b of filtered) {
    const last = sections[sections.length - 1];
    if (last && last.city === b.city) last.items.push(b);
    else sections.push({ city: b.city, items: [b] });
  }

  const chip = (active: boolean) =>
    `border-[3px] border-black px-3 py-1 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 ${
      active ? "bg-[var(--turq)] text-[var(--sand)]" : "bg-white"
    }`;

  return (
    <div className="flex flex-col gap-8">
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={chip(category === null)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory((cur) => (cur === c ? null : c))}
              className={chip(category === c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="border-[3px] border-black bg-white p-8 text-center shadow-hard">
          <p className="font-bold text-black/60">
            No {category ?? ""} spots listed yet — know one?{" "}
            <a href="/list-your-business" className="font-black text-[var(--turq)] underline">
              Add it to the guide →
            </a>
          </p>
        </div>
      ) : (
        sections.map((section, si) => (
          <section key={section.city} className="flex flex-col gap-4">
            {/* Town headers only earn their space once the guide spans towns. */}
            {sections.length > 1 && (
              <h2 className="flex items-baseline gap-3 font-display text-3xl font-extrabold">
                📍 {section.city}
                <span className="border-2 border-black bg-[var(--sand)] px-2 py-0.5 text-xs font-black uppercase tracking-wide">
                  {section.items.length} spot{section.items.length === 1 ? "" : "s"}
                </span>
              </h2>
            )}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {section.items.slice(0, si === 0 ? 2 : undefined).map((b) => (
                <BusinessCard key={b.id} business={b} canPersist={canPersist} />
              ))}
              {/* Native local-partner card: same anatomy as the guide's own
                  cards, clearly labelled, kept where readers start choosing
                  where to go — inside the first (Dunedin) section. */}
              {si === 0 && (
                <AdSlot slot="ttd_grid" variant="card" label="Local guide partner" />
              )}
              {si === 0 &&
                section.items
                  .slice(2)
                  .map((b) => (
                    <BusinessCard key={b.id} business={b} canPersist={canPersist} />
                  ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
