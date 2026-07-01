/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Shopify product images + a placeholder dog source until real photos land.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "images.dog.ceo" },
      // Supabase Storage (dog profile photos). Any project ref subdomain.
      { protocol: "https", hostname: "*.supabase.co" },
      // Demo catalog images (lib/demoProducts.ts) - drop once live Shopify
      // products replace the demo fallback.
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
