# Dogedin

Shopify-style ecommerce storefront for dogs.
Next.js (App Router) + Tailwind 4, deployed on Vercel.

## Architecture

- **Shopify Storefront API** owns commerce: catalog, pricing, discounts, cart, checkout.
  Products render as cards (name, image, description, price, discount badge).
- **Supabase** is wired for custom content Shopify doesn't own (carousel CMS, signups).
  Currently idle - no tables yet.
- **Carousel**: native CSS scroll-snap (no carousel library). The first card on the
  home page is a dog-photo carousel whose last slide is a **featured item slot**.
- **Category rows**: each product carousel is driven by a Shopify **collection** the
  merchant curates in admin (no code). The home page expects collections with handles
  `for-dogs` and `for-humans`; create them in Shopify to fill the two rows. Add more
  rows by calling `getCollection("<handle>")` and rendering another `<ProductRow>`.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in creds (optional - builds without them)
npm run dev
```

With no env set, the site builds and renders with placeholder dog photos and an
empty product grid. Add the Shopify vars to pull live products.

## Environment

| Var | Purpose |
| --- | --- |
| `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com` |
| `SHOPIFY_STOREFRONT_TOKEN` | Storefront API access token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (optional) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (optional) |

## Deploy

Push to a Git repo and import into Vercel. Set the env vars in the Vercel project
settings. Framework preset auto-detects as Next.js.
