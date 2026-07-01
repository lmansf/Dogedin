import DogCarousel from "@/components/DogCarousel";
import ProductRow from "@/components/ProductRow";
import { getCollection } from "@/lib/shopify";
import { DEMO_DOGS, DEMO_HUMANS } from "@/lib/demoProducts";

// Each carousel row is driven by a Shopify collection the merchant curates in
// admin. Until those collections return products, we fall back to the demo
// catalog so the storefront looks alive.
const FOR_DOGS = "for-dogs";
const FOR_HUMANS = "for-humans";

export default async function Home() {
  const [dogsLive, humansLive] = await Promise.all([
    getCollection(FOR_DOGS),
    getCollection(FOR_HUMANS),
  ]);
  const forDogs = dogsLive.length ? dogsLive : DEMO_DOGS;
  const forHumans = humansLive.length ? humansLive : DEMO_HUMANS;

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

      {/* Meet-the-pack: dog profile cards, Netflix-style. */}
      <DogCarousel />

      {forDogs.length > 0 && (
        <ProductRow
          title="For the dog 🐕"
          badge="Good boys"
          badgeColor="var(--turq)"
          products={forDogs}
        />
      )}
      {forHumans.length > 0 && (
        <ProductRow
          title="For the human 🧑"
          badge="Good owners"
          badgeColor="var(--red)"
          products={forHumans}
        />
      )}
    </div>
  );
}
