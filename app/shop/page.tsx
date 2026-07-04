import type { Metadata } from "next";
import ProductRow from "@/components/ProductRow";
import { getProducts } from "@/lib/shopify";
import { HERO_BADGE } from "@/lib/site";
import { DEMO_DOGS, DEMO_HUMANS } from "@/lib/demoProducts";

export const metadata: Metadata = {
  title: "The Shop",
  description:
    "Tartan toys, beach beds, leashes and treats for extremely good dogs — every order funds the Dogedin community.",
};

export const revalidate = 3600;

// The storefront. It used to be the homepage; it now lives here so the front
// door can serve the community first. Pulls the whole Shopify catalog (not
// specific collections — a small store may not curate a "for dogs"/"for
// humans" split). The demo catalog is a dev-only preview: in production an
// unconfigured or empty store shows an honest "opening soon" state instead
// of fake products.
export default async function ShopPage() {
  const live = await getProducts(24);
  const demoFallback =
    process.env.NODE_ENV !== "production" ? [...DEMO_DOGS, ...DEMO_HUMANS] : [];
  const products = live.length ? live : demoFallback;

  return (
    <div className="flex flex-col gap-12">
      <section className="relative overflow-hidden border-[3px] border-black bg-[var(--gold)] p-8 shadow-hard-lg md:p-12">
        <div className="dots pointer-events-none absolute inset-0" />
        <div className="relative">
          <span className="inline-block -rotate-2 border-[3px] border-black bg-[var(--sand)] px-3 py-1 text-xs font-black uppercase tracking-widest shadow-hard">
            {HERO_BADGE}
          </span>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[0.95] md:text-7xl">
            Good gear for
            <span className="ml-3 inline-block rotate-1 bg-[var(--red)] px-2 text-[var(--sand)]">
              extremely
            </span>{" "}
            good dogs.
          </h1>
          <p className="mt-5 max-w-xl text-lg font-bold text-[var(--ink)]/70">
            Tartan toys, beach beds, leashes and treats - picked by dogs,
            approved by dogs, occasionally chewed by dogs. Shipped fresh from the
            Gulf coast.
          </p>
          <p className="mt-3 max-w-xl text-sm font-bold text-[var(--ink)]/60">
            Every order funds the Dogedin community: free dog profiles, lost-dog
            tags, and the local guide.
          </p>
        </div>
      </section>

      {products.length > 0 ? (
        <ProductRow
          title="The shop 🛍"
          badge="Good gear"
          badgeColor="var(--turq)"
          products={products}
        />
      ) : (
        <section className="border-[3px] border-black bg-white p-8 text-center shadow-hard">
          <h2 className="font-display text-3xl font-extrabold">
            The shop is opening soon 🛍
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-bold text-black/60">
            We&apos;re stocking the shelves. Check back shortly — in the
            meantime, the rest of Dogedin is free and open to every good dog.
          </p>
        </section>
      )}
    </div>
  );
}
