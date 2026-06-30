import DogCarousel from "@/components/DogCarousel";
import ProductRow from "@/components/ProductRow";
import type { Product } from "@/lib/shopify";

// TEMPORARY sample data so we can build/lay out the storefront before Shopify is
// connected. Delete this whole route, its nav link (app/layout.tsx), and the
// picsum.photos entry in next.config.mjs before launch.
// Note: variantIds are fake, so "Add to cart" here will error - that's expected
// until a real Shopify store is wired up.
function sample(
  id: string,
  handle: string,
  title: string,
  description: string,
  price: number,
  compareAtPrice: number | null
): Product {
  return {
    id,
    handle,
    title,
    description,
    image: `https://picsum.photos/seed/${handle}/600/600`,
    imageAlt: title,
    variantId: `gid://shopify/ProductVariant/mock-${id}`,
    price,
    compareAtPrice,
    currency: "USD",
  };
}

// Category 1: for the dog.
const DOG_STUFF: Product[] = [
  sample("d1", "fleece-hoodie", "Cozy Fleece Dog Hoodie", "Warm fleece pullover for chilly Gulf mornings. Machine washable.", 34, 48),
  sample("d2", "chew-bone", "Indestructible Chew Bone", "Tough natural-rubber bone for aggressive chewers.", 16, null),
  sample("d3", "rope-leash", "Hand-Braided Rope Leash", "6ft climbing-grade rope leash with a brass clasp.", 28, null),
  sample("d4", "ortho-bed", "Orthopedic Memory-Foam Bed", "Joint-support foam base with a washable cover.", 89, 120),
  sample("d5", "travel-bowl", "Collapsible Travel Bowl", "Silicone bowl that folds flat. Clips to any bag.", 12, null),
  sample("d6", "reflective-collar", "Reflective Adventure Collar", "Weatherproof collar with reflective stitching.", 22, 30),
  sample("d7", "puzzle-feeder", "Slow-Feeder Puzzle Bowl", "Maze-pattern bowl that slows fast eaters.", 19, null),
  sample("d8", "rain-jacket", "Packable Rain Jacket", "Lightweight waterproof shell with a leash port.", 39, 52),
  sample("d9", "tartan-bandana", "Dunedin Tartan Bandana", "Highland-plaid bandana for the very best boy.", 14, null),
  sample("d10", "beach-ball", "Floating Beach Fetch Ball", "Bright, buoyant fetch ball for Honeymoon Island.", 11, 15),
];

// Category 2: for the people.
const PEOPLE_STUFF: Product[] = [
  sample("p1", "dad-cap", "Dunedin Tartan Dad Cap", "Six-panel cap with a woven tartan patch.", 28, null),
  sample("p2", "gulf-tote", "Gulf Coast Canvas Tote", "Heavy-canvas tote for the farmers market & the beach.", 24, 32),
  sample("p3", "brews-tee", "“Good Dogs, Good Brews” Tee", "Soft ringspun tee, printed in downtown Dunedin.", 30, null),
  sample("p4", "koozie", "Craft Beer Can Koozie", "Neoprene koozie for the brewery crawl.", 9, null),
  sample("p5", "highland-hoodie", "Highland Games Hoodie", "Heavyweight hoodie with a caber-toss crest.", 54, 72),
  sample("p6", "beach-towel", "Honeymoon Island Beach Towel", "Oversized sand-resistant towel in sunset stripes.", 34, null),
  sample("p7", "citrus-candle", "Citrus Crate Soy Candle", "Hand-poured candle that smells like an orange grove.", 22, null),
  sample("p8", "matching-bandana", "Owner + Pup Matching Bandana", "Because you both deserve the tartan.", 18, 24),
  sample("p9", "enamel-mug", "Pinellas Trail Enamel Mug", "Campfire-style enamel mug for trail coffee.", 16, null),
  sample("p10", "sticker-pack", "Dunedin Sticker Pack", "Six die-cut stickers: paws, palms & pints.", 8, null),
];

export default function MockupPage() {
  return (
    <div className="flex flex-col gap-12">
      <div className="-rotate-1 border-[3px] border-black bg-[var(--coral)] px-5 py-3 font-extrabold text-white shadow-hard">
        🚧 Mockup - temporary sample data for development. &ldquo;Add to cart&rdquo;
        will error until Shopify is connected (expected). Remove this tab before
        launch.
      </div>

      <DogCarousel featured={DOG_STUFF[0]} />

      <ProductRow
        title="For the dog 🐕"
        badge="Good boys"
        badgeColor="var(--turq)"
        products={DOG_STUFF}
      />

      <ProductRow
        title="For the human 🧑"
        badge="Good owners"
        badgeColor="var(--red)"
        products={PEOPLE_STUFF}
      />
    </div>
  );
}
