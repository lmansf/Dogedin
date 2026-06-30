import DogCarousel from "@/components/DogCarousel";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/shopify";

export default async function Home() {
  const products = await getProducts();
  const featured = products[0] ?? null;

  return (
    <div className="flex flex-col gap-10">
      {/* First card: dog photo carousel with a featured item slot. */}
      <DogCarousel featured={featured} />

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Shop all</h2>
        {products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm text-zinc-500 dark:border-white/15">
            No products yet. Add{" "}
            <code className="rounded bg-black/5 px-1 dark:bg-white/10">
              SHOPIFY_STORE_DOMAIN
            </code>{" "}
            and{" "}
            <code className="rounded bg-black/5 px-1 dark:bg-white/10">
              SHOPIFY_STOREFRONT_TOKEN
            </code>{" "}
            to <code>.env.local</code> to pull products from Shopify.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
