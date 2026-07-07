# The multi-town directory — what it is and how it runs itself

The local guide (`/things-to-do`) now spans the town ring: **Dunedin first,
then Clearwater, Palm Harbor and Tarpon Springs**, each with its own section
header and Dunedin always on top. Category chips (Vet, Groomer, Restaurant,
Park / Trail, …) filter the whole guide instantly.

## One-time setup

1. Run `supabase/schema.sql` (adds the `city` column — safe to re-run as
   always).
2. Run `supabase/seed-directory.sql` — imports ~60 real, verified businesses
   and dog-friendly places across the four towns: vets, groomers, pet stores,
   dog-friendly restaurants/breweries, parks and dog parks. Safe to re-run;
   it never duplicates or overwrites your edits.

That's it. The guide is live with real listings.

## What runs itself after that

- **Ordering** — Dunedin leads; within a town, the most-reviewed/best-rated
  listings rise. No curation needed.
- **New listings** — businesses self-submit at `/list-your-business` (now with
  a town picker) and you approve with one click at `/admin/businesses`.
- **Corrections** — every listing is editable/removable at `/admin/businesses`
  like any other. If a place closes, remove it there; done.
- **Photos** — imported listings use house-style category placeholder cards
  (`/assets/spots/cat-*.svg`). When a business claims its listing, a real
  photo replaces the placeholder.

## The seed is also your sales list

Every imported row carries the business's public phone and website —
`/admin/businesses` is effectively the outreach list for ads, Business
Insights, and Club member deals, town by town. `owner_email` stays empty
until an owner claims their listing, which is your signal they're engaged.

## Freshness verification (optional, later)

Listings are static facts (name/address/phone) that change rarely; community
reviews and the admin queue catch most drift. If you later want automated
closure-detection, the `place_id` column is the ready hook: match listings to
Google Place IDs and a scheduled job can re-check business status via the
Places API. That needs a Google Maps Platform API key (owner action) — the
schema needs no changes.

## What was deliberately NOT done

- **No seeded reviews** — reviews are the community's. Fake ones would poison
  the review-driven ranking and the site's trust.
- **No scraped text or photos** — descriptions are original copy written for
  Dogedin; facts (addresses, phones, dog policies) were verified against
  official websites and county parks pages at import time (July 2026).
