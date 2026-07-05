# Dogedin — What's on the site and why it matters

**The one-liner:** Dogedin is Dunedin, FL's home for dog people — every local dog gets a
profile and a lost-dog tag, the town's dog-friendly spots and events live in one
place, and the whole thing is paid for by a small shop, a membership club, and tasteful
ads from the same Main Street businesses the community already loves.

---

## 1. For dog owners — the community layer

| Feature | Where | What it achieves |
|---|---|---|
| **Dog profiles** | `/register`, `/dog/{name}` | Every Dunedin dog gets a public page (photo, breed, story). This is the membership roll of the community — and the hook that brings people in. |
| **Lost-dog tags & lookup** | `/found`, tag & QR on `/account` | Each registered dog gets a unique tag code and QR. A finder scans the tag or types the code and instantly reaches the owner — *only* if the owner opted in to sharing contact info. This is the feature with real emotional weight: the site can genuinely bring a lost dog home. |
| **The Pack (search)** | `/dogs` | Look up any registered dog by their name or their human's. Makes the community visible and browsable. |
| **Meet the Pack carousel** | Homepage | The newest registered dogs, front and center on the front page — your dog becomes a minor local celebrity the day you sign up. |
| **Local guide** | `/things-to-do` | The town's dog-friendly spots — breweries, beaches, brunch, parks — reviewed by the community, with upvotes and threaded replies. Answers the #1 question every dog owner has: "where can I take them?" |
| **Events calendar** | `/events` | **Pre-launch.** The page is a promise-free "coming soon" teaser with tracked interest. The auto-pull machinery (public iCal feed → lib/events.ts) is built and waiting; relaunch is a page swap. |
| **Instagram feed** | Homepage | The community's photos, pulled automatically from the official API. |

**Privacy is a feature:** owner names and contact details are never shown publicly unless
the owner turns on "lost dog contact" — and the database itself enforces this (row-level
security + a privilege-gated public view), not just the UI.

## 2. For local businesses — the monetization layer

| Feature | Where | What it achieves |
|---|---|---|
| **Guide listings + offers** | `/things-to-do` | A business in the guide can carry a member deal ("$1 off pints — show your card"), turning reviews into foot traffic. |
| **Ad program** | Homepage, guide, events | Three placements sold flat-monthly: a homepage spotlight, a native card *inside* the local guide (styled like the guide itself, clearly labelled), and an events-week sponsor banner. Placement follows intent — ads appear exactly where people decide where to spend locally. |
| **Honest reporting** | `/admin/ads` | Impressions only count when an ad is actually on screen (≥50% visible for a full second), and every impression/click is tracked per placement per day. At renewal you can show a business precisely what they got, with CTR, per slot. This honesty *is* the sales pitch. |
| **Self-expiring campaigns** | `/admin/ads` | Flight dates mean a paid month ends itself — no awkward overruns. |
| **The ad-free promise** | `/advertise` | Published commitment: no ads ever on the lost-dog flow, dog profiles, or member cards. Protects trust, and gives advertisers a classier product to be part of. |
| **Sign-up funnel** | `/advertise` | The pitch page + inquiry form. A Main Street shop can raise their hand without you lifting a finger; leads collect in an admin-only table. |

## 3. Revenue — three streams, one mission

1. **The Shop** (`/shop`, Shopify) — tartan toys, beach gear, treats. Framed honestly on
   the site: "every order funds the community."
2. **The Dogedin Club** (`/membership`) — **pre-launch.** The page is a promise-free
   "coming soon" teaser; every teaser click is counted in `feature_interest_daily`
   (per feature, per source, per day) to gauge demand before anything is offered —
   the events calendar teaser feeds the same table. The Stripe
   subscription flow, digital discount card (`/card`) and business member deals are
   built and waiting in the codebase, just unlinked until launch.
3. **Local ads** — see above. Priced flat-monthly (rates are yours to set), sold on
   honest, per-placement numbers.

## 4. The flywheel — why the pieces reinforce each other

- Dog owners register **because profiles and lost-dog tags are genuinely useful**.
- Registered owners come back for **the guide and the events calendar** — which makes the
  audience valuable to **local businesses**.
- Businesses buy **ads and honor Club deals** — which makes the **membership** worth
  paying for. *(Deals resume when the Club launches.)*
- Membership and shop revenue **fund the community features** — which brings in more
  dog owners. Around it goes.

Every page cross-links along this loop: registering ends with "get your tag"; the guide
and homepage tease the Club (clicks tracked as launch-demand signal); events point at
the guide; empty states invite registration.

## 5. Operations — what runs itself

- **Events** auto-pull from a public iCal feed (e.g. a Google Calendar you edit) —
  machinery ready, page currently "coming soon".
- **Instagram** auto-pulls from the official API.
- **Ads** are managed at `/admin/ads` — add/pause/expire advertisers, no code or deploys.
- **The guide, reviews, profiles** are all community-generated.
- Every feature degrades gracefully if its backend/keys are missing — the site never
  breaks while something is unconfigured.

## 6. Current status

**Live now** (with Supabase connected + seeded): profiles, tags & lost-dog lookup, pack
search, guide + reviews, ad program + admin + advertise funnel, shop (demo catalog until
Shopify collections fill).

**Needs a key/decision to switch on:**
- Club billing → Stripe keys + webhook + your price
- Events → a public calendar iCal URL
- Instagram → business-account token + handle
- Ad rates → your flat-monthly numbers (the /advertise page deliberately shows none)

---

## Pitch lines to steal

- *"Every dog in Dunedin gets a page — and a tag that can bring them home."*
- *"One place for everything dog in Dunedin: the spots, the events, the pack."*
- *"Ads that act like community content, measured honestly — you'll know exactly how many
  neighbours saw you, and where."*
- *"The shop and the Club don't just sell things — they keep the whole thing running."*
