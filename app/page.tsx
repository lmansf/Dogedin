import Link from "next/link";
import DogCarousel from "@/components/DogCarousel";
import ProductRow from "@/components/ProductRow";
import AdSlot from "@/components/ads/AdSlot";
import InstagramFeed from "@/components/social/InstagramFeed";
import ComingSoonLink from "@/components/ComingSoonLink";
import EventsPreview from "@/components/home/EventsPreview";
import FeaturedBusiness from "@/components/home/FeaturedBusiness";
import SpotsPreview from "@/components/home/SpotsPreview";
import TopDogs from "@/components/home/TopDogs";
import { getProducts } from "@/lib/shopify";
import { listRecentDogs, dogPhotoUrl } from "@/lib/dogProfiles";
import { PACK_GRADS, type PackDog } from "@/lib/dogs";
import { HERO_BADGE } from "@/lib/site";
import { DEMO_DOGS } from "@/lib/demoProducts";

// The front door of Dunedin's dog community: pack first, plans second, shop in
// support. ISR keeps the auto-pulled feeds current without a rebuild — the
// root layout's 5-minute revalidate (for the top-rated spot) is the effective
// cadence, since Next uses the lowest value across layout and page. (Ads
// fetch client-side, so they're always live.)
export const revalidate = 3600;

export default async function Home() {
  const [shopTeaser, recentDogs] = await Promise.all([
    getProducts(6),
    listRecentDogs(8),
  ]);
  // Demo products are a dev-only preview — in production an unconfigured or
  // empty Shopify store hides the teaser row rather than showing fake gear.
  const demoFallback = process.env.NODE_ENV !== "production" ? DEMO_DOGS : [];
  const teaserProducts = (shopTeaser.length ? shopTeaser : demoFallback).slice(0, 6);

  // Real registered dogs for the carousel; the component falls back to the
  // mascot cast when the pack is still empty.
  const pack: PackDog[] = recentDogs.map((d, i) => ({
    id: d.slug,
    name: d.dogName,
    breed: d.breed || "Very good dog",
    about:
      d.bio ||
      `${d.dogName} is one of Dunedin's registered good dogs — tap through to say hello.`,
    image: dogPhotoUrl(d.photoPath),
    emoji: "🐶",
    grad: PACK_GRADS[i % PACK_GRADS.length],
    href: `/dog/${d.slug}`,
    dogId: d.id,
    pawCount: d.pawCount,
  }));

  return (
    <div className="flex flex-col gap-12">
      {/* Community hero */}
      <section className="relative overflow-hidden border-[3px] border-black bg-[var(--gold)] p-8 shadow-hard-lg md:p-12">
        <div className="dots pointer-events-none absolute inset-0" />
        <div className="relative">
          <span className="inline-block -rotate-2 border-[3px] border-black bg-[var(--sand)] px-3 py-1 text-xs font-black uppercase tracking-widest shadow-hard">
            {HERO_BADGE}
          </span>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[0.95] md:text-7xl">
            Dunedin&apos;s home for
            <span className="ml-3 inline-block rotate-1 bg-[var(--red)] px-2 text-[var(--sand)]">
              extremely
            </span>{" "}
            good dogs.
          </h1>
          <p className="mt-5 max-w-xl text-lg font-bold text-[var(--ink)]/70">
            Meet the pack, register your own good dog, find a patio that pours
            water bowls, and see what&apos;s on this weekend. The shop&apos;s
            here too — it keeps the treats (and this site) coming.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              Register your dog →
            </Link>
            <Link
              href="/things-to-do"
              className="border-[3px] border-black bg-[var(--sand)] px-4 py-2 text-sm font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              Explore dog-friendly Dunedin
            </Link>
          </div>
        </div>
      </section>

      {/* Ribbon: a full-width top strip. Only renders a live ad when the admin
          has an active ribbon campaign; otherwise it's a quiet invitation. */}
      <AdSlot slot="home_ribbon" placement="ribbon" label="Featured partner" />

      {/* The pack: real registered dogs (mascots until the roster fills). */}
      <DogCarousel pack={pack} />

      {/* Most-pawed dogs — the front page is itself a place to add a paw.
          Hidden until the pack has a registered dog. */}
      <TopDogs />

      <EventsPreview />

      {/* Local business spotlight — the one ad between community sections. */}
      <AdSlot slot="home_feed" label="Local partner" />

      {/* Editorial, not paid: the top-rated spot in the local guide, crowned
          by community reviews. Hidden while the guide has no listings. */}
      <FeaturedBusiness />

      <SpotsPreview />

      {/* Shop teaser: one earning row, honestly framed. Hidden entirely until
          there are real (or dev-preview) products to show. */}
      {teaserProducts.length > 0 && (
        <section>
          <ProductRow
            title="From the shop 🛍"
            badge="Funds the pack"
            badgeColor="var(--gold)"
            products={teaserProducts}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-black/60">
              Every purchase funds Dogedin — profiles, lost-dog tags and
              the local guide.
            </p>
            <Link
              href="/shop"
              className="border-[3px] border-black bg-[var(--gold)] px-4 py-2 text-sm font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              Visit the shop →
            </Link>
          </div>
        </section>
      )}

      {/* Dogedin Club band — teaser only while the Club is pre-launch. No
          perks or price are promised; the tracked link measures interest. */}
      <section className="relative overflow-hidden border-[3px] border-black bg-[var(--green)] p-6 shadow-hard-lg md:p-8">
        <div className="dots pointer-events-none absolute inset-0" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-extrabold text-[var(--sand)]">
              The Dogedin Club 🎟
            </h2>
            <p className="mt-1 max-w-lg font-bold text-[var(--sand)]/90">
              Something for the pack is in the works. That&apos;s all we can say
              for now.
            </p>
          </div>
          <ComingSoonLink
            feature="club"
            source="home"
            href="/membership"
            className="shrink-0 border-[3px] border-black bg-[var(--gold)] px-5 py-2.5 text-sm font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            Coming soon →
          </ComingSoonLink>
        </div>
      </section>

      {/* Auto-pulled Instagram feed (official Graph API; falls back to a
          follow card until configured). */}
      <InstagramFeed />
    </div>
  );
}
