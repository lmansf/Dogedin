import type { Product } from "@/lib/shopify";

// Demo catalog. Used as a fallback so the storefront looks alive before a real
// Shopify store is connected; the moment getProducts() returns anything, live
// data takes over (see app/page.tsx and app/shop/page.tsx).
// Images come from picsum (see next.config.mjs); variantIds are placeholders,
// so "Add to cart" on demo items errors until Shopify is wired up.
function demo(
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
    variantId: `gid://shopify/ProductVariant/demo-${id}`,
    available: true,
    price,
    compareAtPrice,
    currency: "USD",
  };
}

export const DEMO_DOGS: Product[] = [
  demo("d1", "fleece-hoodie", "Cozy Fleece Dog Hoodie", "Warm fleece pullover for chilly Gulf mornings. Machine washable.", 34, 48),
  demo("d2", "chew-bone", "Indestructible Chew Bone", "Tough natural-rubber bone for aggressive chewers.", 16, null),
  demo("d3", "rope-leash", "Hand-Braided Rope Leash", "6ft climbing-grade rope leash with a brass clasp.", 28, null),
  demo("d4", "ortho-bed", "Orthopedic Memory-Foam Bed", "Joint-support foam base with a washable cover.", 89, 120),
  demo("d5", "travel-bowl", "Collapsible Travel Bowl", "Silicone bowl that folds flat. Clips to any bag.", 12, null),
  demo("d6", "reflective-collar", "Reflective Adventure Collar", "Weatherproof collar with reflective stitching.", 22, 30),
  demo("d7", "puzzle-feeder", "Slow-Feeder Puzzle Bowl", "Maze-pattern bowl that slows fast eaters.", 19, null),
  demo("d8", "rain-jacket", "Packable Rain Jacket", "Lightweight waterproof shell with a leash port.", 39, 52),
  demo("d9", "tartan-bandana", "Dunedin Tartan Bandana", "Highland-plaid bandana for the very best boy.", 14, null),
  demo("d10", "beach-ball", "Floating Beach Fetch Ball", "Bright, buoyant fetch ball for Honeymoon Island.", 11, 15),
];

export const DEMO_HUMANS: Product[] = [
  demo("p1", "dad-cap", "Dunedin Tartan Dad Cap", "Six-panel cap with a woven tartan patch.", 28, null),
  demo("p2", "gulf-tote", "Gulf Coast Canvas Tote", "Heavy-canvas tote for the farmers market & the beach.", 24, 32),
  demo("p3", "brews-tee", "“Good Dogs, Good Brews” Tee", "Soft ringspun tee, printed in downtown Dunedin.", 30, null),
  demo("p4", "koozie", "Craft Beer Can Koozie", "Neoprene koozie for the brewery crawl.", 9, null),
  demo("p5", "highland-hoodie", "Highland Games Hoodie", "Heavyweight hoodie with a caber-toss crest.", 54, 72),
  demo("p6", "beach-towel", "Honeymoon Island Beach Towel", "Oversized sand-resistant towel in sunset stripes.", 34, null),
  demo("p7", "citrus-candle", "Citrus Crate Soy Candle", "Hand-poured candle that smells like an orange grove.", 22, null),
  demo("p8", "matching-bandana", "Owner + Pup Matching Bandana", "Because you both deserve the tartan.", 18, 24),
  demo("p9", "enamel-mug", "Pinellas Trail Enamel Mug", "Campfire-style enamel mug for trail coffee.", 16, null),
  demo("p10", "sticker-pack", "Dunedin Sticker Pack", "Six die-cut stickers: paws, palms & pints.", 8, null),
];
