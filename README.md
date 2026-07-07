# Dogedin

Dunedin, FL's home for extremely good dogs — a dog-community site: dog profiles
and lost-dog tags, a review-driven local guide to dog-friendly spots, a photo
feed, events, a supporting shop, and self-serve advertising for local
businesses.

Next.js (App Router) + React + TypeScript, Tailwind CSS v4 (a neo-brutalist
theme), deployed on Vercel. Supabase (Postgres + RLS + Auth + Storage + Edge
Functions) is the backend; Shopify is a headless commerce source for the shop.

## What's in here

- **Dog profiles & the pack** — register a dog (`/register`), get a public
  profile (`/dog/{slug}`) and a printable QR tag for lost-dog lookup
  (`/found`). Owners manage their dogs at `/account`. Signed-in owners can give
  other dogs a "paw", send friend requests, and post photos (auto-moderated).
- **Local guide** — community-reviewed dog-friendly businesses at
  `/things-to-do`, with ratings, reviews, and a self-serve listing form at
  `/list-your-business`. Admins moderate at `/admin/businesses`. The guide
  spans the town ring — Dunedin first, then Clearwater, Palm Harbor and
  Tarpon Springs — with category filters; `supabase/seed-directory.sql`
  imports ~60 real researched listings (see `docs/directory-expansion.md`).
- **Advertising** — tasteful, clearly-labelled ad slots sold self-serve at
  `/advertise`: businesses upload a creative, pick dates, and pay; the creative
  clears an automated content check and goes live on payment. Admins manage
  campaigns at `/admin/ads`.
- **Business Insights** — a paid stats subscription for listed businesses,
  surfaced on the media-kit deployment's `/portal`.
- **Shop** — a headless Shopify storefront (`/shop`) that funds the site.
- **Events & Instagram** — auto-pulled feeds (currently a pre-launch teaser for
  events; a "follow us" card for Instagram until the Graph API is configured).
- **Admin** — moderation queues for photos, businesses, ads, posts, reports and
  ad inquiries under `/admin/*`, gated by an `app_admins` email allow-list.

The three analytics dashboards live in sibling repos: `dogedin-media-kit`
(business-facing + the insights portal), `dogedin-public-analytics` (public
community stats), and `dogedin-private-analytics` (admin-only).

## Data & backend

`supabase/schema.sql` is the single, idempotent source of truth for tables,
RLS policies, storage buckets, and the `SECURITY DEFINER` RPCs the app and
dashboards call. Run it once against the Supabase project (safe to re-run).
`supabase/seed.sql` loads a few starter businesses/reviews for a fresh install.

Content that isn't wired up degrades gracefully rather than breaking: an empty
businesses table shows a friendly empty state, a missing Shopify store shows
"opening soon", and missing Stripe/Supabase keys surface readable errors
instead of failing silently.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in creds (the app builds without them)
npm run dev
```

With no env set the site still builds and renders, using labelled sample/demo
content in development. See `.env.local.example` for the full, commented list of
environment variables (Supabase, Shopify, Stripe, Instagram, Resend, and the
Business Insights + advertising settings).

## Deploy

Push to a Git repo and import into Vercel (framework auto-detects as Next.js).
Set the environment variables in the Vercel project, run `supabase/schema.sql`
against the Supabase project, and point `NEXT_PUBLIC_SITE_URL` at the canonical
domain.

## Operating docs

- `docs/site-overview.md` — architecture and current status
- `docs/owner-actions.md` — what a launch still needs from the owner
- `docs/monetization-owner-actions.md` — ads/insights/membership config
- `docs/photo-moderation-runbook.md` — photo moderation modes
- `docs/instagram-pipeline.md` — the dog-of-the-day Instagram pipeline
