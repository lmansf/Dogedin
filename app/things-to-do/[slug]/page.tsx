import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BusinessCard from "@/components/spots/BusinessCard";
import JsonLd from "@/components/JsonLd";
import {
  getBusinessBySlug,
  persistenceEnabled,
  averageRating,
} from "@/lib/businesses";
import { businessJsonLd } from "@/lib/seo";

// A stable, shareable permalink for a single listing — the page a business
// sends its audience to so they can leave a review (and unlock the deal).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return { title: "Listing not found" };

  const count = business.reviews.length;
  const rating = averageRating(business.reviews);
  const ratingBit = count > 0 ? ` Rated ${rating}★ by ${count} local reviews.` : "";
  const description =
    (business.description ||
      `${business.name} — a dog-friendly spot in Dunedin, Florida.`).slice(0, 155) +
    ratingBit;

  return {
    title: `${business.name} · Dunedin`,
    description,
    alternates: { canonical: `/things-to-do/${slug}` },
    openGraph: {
      title: `${business.name} · dog-friendly Dunedin`,
      description,
      images: business.image ? [{ url: business.image }] : undefined,
    },
  };
}

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const canPersist = persistenceEnabled();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link
        href="/things-to-do"
        className="w-fit text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
      >
        ← All things to do
      </Link>

      {/* Structured data only for real, persisted listings. */}
      {canPersist && <JsonLd data={businessJsonLd(business)} />}

      {/* Reuse the guide card, opened to reviews — this page's whole purpose is
          reading and leaving reviews for this one spot. */}
      <BusinessCard
        business={business}
        canPersist={canPersist}
        defaultOpen
        isPermalink
      />

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
