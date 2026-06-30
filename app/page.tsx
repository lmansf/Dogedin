import DogCarousel from "@/components/DogCarousel";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/shopify";

export default async function Home() {
  const products = await getProducts();
  const featured = products[0] ?? null;

  return (
    <div className="flex flex-col gap-12">
      {/* Eccentric hero */}
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
        </div>
      </section>

      {/* First card: dog photo carousel with a featured item slot. */}
      <DogCarousel featured={featured} />

      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">
            Shop all 🛍️
          </h2>
          <span className="hidden -rotate-2 border-2 border-black bg-[var(--turq)] px-3 py-1 text-xs font-black uppercase text-[var(--sand)] shadow-hard sm:inline-block">
            Fresh drops
          </span>
        </div>

        {products.length === 0 ? (
          <div className="border-[3px] border-dashed border-black bg-white p-10 text-center">
            <div className="text-5xl">🐾</div>
            <p className="mt-3 font-display text-xl font-extrabold">
              The shelves are empty (for now)
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-black/60">
              Add{" "}
              <code className="bg-black/5 px-1 font-mono">
                SHOPIFY_STORE_DOMAIN
              </code>{" "}
              and{" "}
              <code className="bg-black/5 px-1 font-mono">
                SHOPIFY_STOREFRONT_TOKEN
              </code>{" "}
              to pull live products - or peek at the{" "}
              <a href="/mockup" className="font-bold underline">
                Mockup tab
              </a>{" "}
              to see the layout with sample items.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
