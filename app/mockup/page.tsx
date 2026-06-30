import DogCarousel from "@/components/DogCarousel";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/shopify";

// TEMPORARY sample data so we can build/lay out the storefront before Shopify is
// connected. Delete this whole route, its nav link (app/layout.tsx), and the
// picsum.photos entry in next.config.mjs before launch.
// Note: variantIds are fake, so "Add to cart" here will error - that's expected
// until a real Shopify store is wired up.
const SAMPLE: Product[] = [
  {
    id: "1",
    handle: "fleece-hoodie",
    title: "Cozy Fleece Dog Hoodie",
    description: "Warm, soft fleece pullover for chilly walks. Machine washable.",
    image: "https://picsum.photos/seed/fleece-hoodie/600/600",
    imageAlt: "Cozy fleece dog hoodie",
    variantId: "gid://shopify/ProductVariant/mock-1",
    price: 34,
    compareAtPrice: 48,
    currency: "USD",
  },
  {
    id: "2",
    handle: "chew-bone",
    title: "Indestructible Chew Bone",
    description: "Tough natural-rubber bone for aggressive chewers. Vet recommended.",
    image: "https://picsum.photos/seed/chew-bone/600/600",
    imageAlt: "Rubber chew bone",
    variantId: "gid://shopify/ProductVariant/mock-2",
    price: 16,
    compareAtPrice: null,
    currency: "USD",
  },
  {
    id: "3",
    handle: "rope-leash",
    title: "Hand-Braided Rope Leash",
    description: "6ft climbing-grade rope leash with a brass clasp.",
    image: "https://picsum.photos/seed/rope-leash/600/600",
    imageAlt: "Braided rope leash",
    variantId: "gid://shopify/ProductVariant/mock-3",
    price: 28,
    compareAtPrice: null,
    currency: "USD",
  },
  {
    id: "4",
    handle: "orthopedic-bed",
    title: "Orthopedic Memory-Foam Bed",
    description: "Joint-support foam base with a removable washable cover.",
    image: "https://picsum.photos/seed/orthopedic-bed/600/600",
    imageAlt: "Orthopedic dog bed",
    variantId: "gid://shopify/ProductVariant/mock-4",
    price: 89,
    compareAtPrice: 120,
    currency: "USD",
  },
  {
    id: "5",
    handle: "travel-bowl",
    title: "Collapsible Travel Bowl",
    description: "Silicone bowl that folds flat. Clips to any bag or belt.",
    image: "https://picsum.photos/seed/travel-bowl/600/600",
    imageAlt: "Collapsible travel bowl",
    variantId: "gid://shopify/ProductVariant/mock-5",
    price: 12,
    compareAtPrice: null,
    currency: "USD",
  },
  {
    id: "6",
    handle: "reflective-collar",
    title: "Reflective Adventure Collar",
    description: "Weatherproof collar with reflective stitching for night walks.",
    image: "https://picsum.photos/seed/reflective-collar/600/600",
    imageAlt: "Reflective collar",
    variantId: "gid://shopify/ProductVariant/mock-6",
    price: 22,
    compareAtPrice: 30,
    currency: "USD",
  },
  {
    id: "7",
    handle: "puzzle-feeder",
    title: "Slow-Feeder Puzzle Bowl",
    description: "Maze-pattern bowl that slows fast eaters and beats boredom.",
    image: "https://picsum.photos/seed/puzzle-feeder/600/600",
    imageAlt: "Puzzle feeder bowl",
    variantId: "gid://shopify/ProductVariant/mock-7",
    price: 19,
    compareAtPrice: null,
    currency: "USD",
  },
  {
    id: "8",
    handle: "rain-jacket",
    title: "Packable Rain Jacket",
    description: "Lightweight waterproof shell with a high collar and leash port.",
    image: "https://picsum.photos/seed/rain-jacket/600/600",
    imageAlt: "Dog rain jacket",
    variantId: "gid://shopify/ProductVariant/mock-8",
    price: 39,
    compareAtPrice: 52,
    currency: "USD",
  },
];

export default function MockupPage() {
  return (
    <div className="flex flex-col gap-12">
      <div className="-rotate-1 border-[3px] border-black bg-[var(--coral)] px-5 py-3 font-extrabold text-white shadow-hard">
        🚧 Mockup - temporary sample data for development. &ldquo;Add to cart&rdquo;
        will error until Shopify is connected (expected). Remove this tab before
        launch.
      </div>

      <DogCarousel featured={SAMPLE[0]} />

      <section>
        <h2 className="mb-6 font-display text-3xl font-extrabold tracking-tight">
          Sample products 🦴
        </h2>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {SAMPLE.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
