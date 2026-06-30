import DogCarousel from "@/components/DogCarousel";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/shopify";

// ponytail: TEMPORARY sample data so we can build/lay out the storefront before
// Shopify is connected. Delete this whole route, its nav link (app/layout.tsx),
// and the picsum.photos entry in next.config.mjs before launch.
const SAMPLE: Product[] = [
  {
    id: "1",
    handle: "fleece-hoodie",
    title: "Cozy Fleece Dog Hoodie",
    description: "Warm, soft fleece pullover for chilly walks. Machine washable.",
    image: "https://picsum.photos/seed/fleece-hoodie/600/600",
    imageAlt: "Cozy fleece dog hoodie",
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
    price: 39,
    compareAtPrice: 52,
    currency: "USD",
  },
];

export default function MockupPage() {
  return (
    <div className="flex flex-col gap-10">
      <div
        role="alert"
        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      >
        🚧 <strong>Mockup</strong> - temporary sample data for development. Remove
        this tab before launch.
      </div>

      <DogCarousel featured={SAMPLE[0]} />

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Sample products</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {SAMPLE.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
