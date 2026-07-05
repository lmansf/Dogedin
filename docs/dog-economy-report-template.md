# The Dunedin Dog Economy — quarterly report template

A sellable/sponsorable quarterly snapshot built ONLY from data the platform
actually collects (real numbers, aggregate-only, no member PII). Every figure
below names its source so the report can be assembled in an afternoon.

**Sponsor line:** "Presented by ___" — one sponsor per issue ($100–300), or use
the report free as ad-sales collateral.

## 1. The pack (community scale + growth)
- Registered dogs, total + new this quarter — `media_kit_stats()`,
  `media_kit_weekly()`
- Breed mix — `breed_counts()` (suppress breeds with <5 dogs)
- Engagement: photos shared, paws given, friendships — `media_kit_stats()`

## 2. The local guide (where dog people go)
- Listings by category; reviews written this quarter; average rating by
  category (suppress categories with <3 businesses) — `businesses`, `reviews`
- Most-engaged categories: listing views + website/phone/direction taps by
  category — `business_stats_daily` joined to `businesses.category`
- Offer economy: offers live, unlocks this quarter — `business_stats_daily`
  (`offer_unlock`)

## 3. Attention & advertising
- Ad impressions/clicks + CTR by placement — `ad_stats_daily` (already
  aggregated by `media_kit_stats()`)
- Coming-soon demand: Club/events interest clicks — `feature_interest_daily`

## 4. What it means for a local business (1 paragraph)
Plain-English takeaways + the two CTAs: advertise (`/advertise`) and claim your
insights (`<media-kit>/portal`).

## Ground rules
- Aggregates only; apply small-cell suppression (<5) everywhere.
- No individual dog, owner, or member data — ever.
- Numbers come from the queries above as-is; if a number doesn't exist yet,
  leave it out rather than estimate.
