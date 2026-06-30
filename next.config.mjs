/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Shopify product images + a placeholder dog source until real photos land.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "images.dog.ceo" },
    ],
  },
};

export default nextConfig;
