import type { Metadata } from "next";
import ProductRow from "@/components/ProductRow";
import { getProducts } from "@/lib/shopify";
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
// humans" split) and falls back to the demo catalog so the shop looks alive
// before a real store is connected.
export default async function ShopPage() {
  const live = await getProducts(24);
  const products = live.length ? live : [...DEMO_DOGS, ...DEMO_HUMANS];

  return (
    <div className="flex flex-col gap-12">
      <section className="relative overflow-hidden border-[3px] border-black bg-[var(--gold)] p-8 shadow-hard-lg md:p-12">
        <div className="dots pointer-events-none absolute inset-0" />
        <div className="relative">
          <span className="inline-block -rotate-2 border-[3px] border-black bg-[var(--sand)] px-3 py-1 text-xs font-black uppercase tracking-widest shadow-hard">
            🏴 Scotland of the Sunshine State · est. Dunedin
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

      {products.length > 0 && (
        <ProductRow
          title="The shop 🛍"
          badge="Good gear"
          badgeColor="var(--turq)"
          products={products}
        />
      )}
    </div>
  );
}
