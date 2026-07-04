# SEO report — on-page pass (July 2026)

What was implemented in this pass, what still needs owner-side operations, and
what is blocked until the production domain is attached. Scope was on-page SEO
with a Dunedin / Tampa Bay local-search emphasis; everything was additive (no
refactors), and nothing fabricated — empty states stay empty, demo data is
never presented to search engines as real.

## Implemented (before → after)

### Metadata foundation
- **`metadataBase`** (`app/layout.tsx`): before, `NEXT_PUBLIC_SITE_URL` existed
  but was never used for metadata, so any relative OG/canonical URL would have
  been broken. Now every absolute URL derives from it (fallback
  `https://dogedin.com`), via the shared `SITE_URL` constant in `lib/site.ts`.
- **Open Graph + Twitter defaults** (`app/layout.tsx`): site-wide
  `og:type/site_name/locale/title/description` and
  `twitter:card=summary_large_image`. Pages inherit these and only override
  what's page-specific.

### robots.txt and sitemap.xml
- **`app/robots.ts`**: allow all, disallow `/admin/` and `/api/`, references
  the sitemap. (The admin pages additionally keep their per-page
  `robots: { index: false }` metadata.)
- **`app/sitemap.ts`**: all 10 public static routes with priorities, plus every
  public dog profile (`/dog/{slug}`, `lastModified` from registration date)
  read from the `public_dog_profiles` view via `listDogSlugs()` in
  `lib/dogProfiles.ts`. Gracefully lists only the static routes when Supabase
  isn't configured. Revalidates hourly so new dogs appear without a redeploy.
  - Note: businesses have **no detail pages** — the guide lives entirely on
    `/things-to-do`, which is in the sitemap. If per-business pages
    (`/spot/{slug}`) are ever added, add them here and to the JSON-LD.
  - Excluded on purpose: `/account` (personal, sign-in gated), `/card`
    (redirect), `/admin/*`, `/api/*`.

### Social preview images
- **`app/opengraph-image.tsx`**: a generated 1200×630 default OG card in the
  site palette (sand/gold/ink, tartan ribbon, hard-shadow sticker, drawn paw
  mark, "Dogedin · Dunedin, FL dog community"). Deliberately self-contained:
  the paw is drawn with positioned divs rather than the 🐾 emoji because
  `next/og` fetches emoji sprites from a CDN at render time, and the text uses
  the bundled font (Fraunces can't be loaded without an external fetch — see
  "nice-to-have" below). Every page without its own image now gets this card.
- **`app/icon.tsx`**: generated favicon — the paw on highland gold. Before:
  the site had **no favicon at all**.

### Per-dog Open Graph (`app/dog/[slug]/page.tsx`)
- Before: `generateMetadata` returned a title only. Now: a description built
  from the public breed + bio fields, OG/Twitter cards using the dog's public
  photo when one exists, and `robots: noindex` on the not-found variant.

### Structured data (JSON-LD)
- **Root layout**: `Organization` (with `areaServed` Dunedin, FL) and
  `WebSite`, cross-referenced by `@id`. Builders live in `lib/seo.ts`,
  rendered by `components/JsonLd.tsx` (escapes `<` so user-sourced strings
  can't break out of the script tag).
- **`/things-to-do`**: an `ItemList` of `LocalBusiness` built at render from
  the live listings — name, description, address, telephone, website, image,
  `openingHoursSpecification` (only days actually open) and `aggregateRating`
  (only when a listing has reviews; values are the same community reviews the
  page renders). **Demo-mode guard**: emitted only when `persistenceEnabled()`
  (Supabase configured) and at least one approved listing exists, so the demo
  seed can never reach search engines as real businesses.

### Local-search copy pass
Every page already exported metadata; descriptions were tightened to carry
truthful geo intent (no keyword stuffing, no invented claims):
- `/things-to-do`: "…in Dunedin, Florida, on Tampa Bay's Gulf coast…"
- `/shop`, `/dogs`, `/found`, `/register`, `/list-your-business`,
  `/advertise`: now name Dunedin, Florida naturally.
- `/account`: gained a description (it had none).
- `/events` and `/membership` were left as promise-free teasers on purpose.
- The retired "Scotland of the Sunshine State" tagline was already gone from
  all copy before this pass (hero badge is "Dunedin, Florida · dog-first
  community"); nothing here reintroduced it.

### Accessibility / semantics (cheap wins only)
- `components/dogs/DogSocial.tsx`: post photos had `alt=""` when uncaptioned —
  now fall back to `Photo of {dog name}`. The social panels' headings were
  `h3` directly under the page `h1` (skipped level) — now `h2` (identical
  classes, no visual change). Every page has exactly one `h1`.
- Remaining known `alt=""`: the owner-only pending-post thumbnail in
  DogSocial (decorative, sits beside its visible status/caption) and one
  admin-only queue image — both acceptable.
- `app/globals.css`: the marquee animation now stops under
  `prefers-reduced-motion: reduce` (the first copy of the line list stays
  readable as a static strip).

### Verified in the build output
`npm run build` green; `/robots.txt`, `/sitemap.xml`, `/icon`,
`/opengraph-image` all present as routes. Spot-checked built HTML:
OG/Twitter/icon tags and both site-wide JSON-LD blocks render; demo-mode
`/things-to-do` correctly contains **no** LocalBusiness JSON-LD; the
LocalBusiness builder was exercised against listing-shaped data and emits
only present fields.

## Needs owner ops (no code)

1. **Google Business Profile** — Dogedin itself is a community/site, not a
   storefront, so a GBP may not apply; but the *directory* value is in
   getting listed businesses to reference their Dogedin reviews. Decide if a
   GBP for Dogedin (as an organization) is wanted.
2. **Google Search Console**: verify the domain (DNS TXT is easiest once the
   domain is attached), then submit `https://<domain>/sitemap.xml`. Bing
   Webmaster Tools accepts the same sitemap.
3. **Local citations / backlinks** (suggestions to pursue, not yet done):
   - Dunedin Chamber of Commerce member/community listings.
   - City of Dunedin community-resources pages (the city is famously
     dog-friendly and maintains related pages).
   - Dog-friendly directories: BringFido, Rover community pages, Sniffspot
     blog, Visit St. Pete/Clearwater (the regional DMO covers Dunedin).
   - Local press: Tampa Bay Times / TBNweekly community desks for a launch
     story.
4. **Instagram → site**: set `NEXT_PUBLIC_INSTAGRAM_HANDLE` and put the site
   URL in the IG bio for the reciprocal signal.
5. **Approve real business listings** (or run `supabase/seed.sql` if those
   four spots should be live) — the LocalBusiness JSON-LD only exists once
   approved listings exist.

## Blocked on the domain being attached

- **Canonical URLs**: everything absolute (metadataBase, sitemap, robots
  sitemap pointer, JSON-LD `@id`s/urls, OG urls) derives from
  `NEXT_PUBLIC_SITE_URL`, which is currently **unset** — builds fall back to
  `https://dogedin.com`. Once the production domain is final, set
  `NEXT_PUBLIC_SITE_URL` in Vercel env and redeploy; every URL updates in one
  place. (This also fixes printed QR tag URLs — `components/dogs/TagQr.tsx`
  uses the same variable.)
- **Search Console verification + sitemap submission** (above) can't happen
  until the domain resolves.

## Nice-to-haves for a later pass (not done, on purpose)

- Fraunces in the OG card: `next/og` can use a local font file; committing a
  Fraunces subset `.ttf` to the repo would let the card match the site's
  display face without runtime fetches.
- Per-business pages (`/spot/{slug}`) would give each listing its own
  indexable URL, OG card and standalone `LocalBusiness` JSON-LD — the
  strongest local-SEO upgrade available to this codebase.
- `BreadcrumbList` JSON-LD once deeper routes exist.
- An `og:image` per business photo on `/things-to-do` (currently the default
  card, which is correct while the page is a single list).
