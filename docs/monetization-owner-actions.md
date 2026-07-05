# Monetization & engagement build — what we need from you

Everything below is built and shipped behind sensible defaults; these are the
five decisions (plus one config step) that turn assumptions into your choices.
Nothing here blocks the rest — it all works today with the defaults noted.

## 1. Which account(s) are admins? `[Workstream A1 — resolved]`

The ad console (and every admin tool) is gated by the existing `app_admins`
allow-list — the **same email + "My Dogs" sign-in** dog owners already use. A
signed-in non-admin sees a clear "not an admin" notice; an admin lands on the
new **/admin** console and sees a gold **⚙️ Admin** chip in the header on every
page. **Seeded (idempotent) in `schema.sql`:** `lmansf96@gmail.com` and
`rosemiller.info@gmail.com`. They take effect when you re-run the schema; to add
either one immediately without waiting, run in the Supabase SQL editor:
`insert into public.app_admins (email) values ('rosemiller.info@gmail.com') on conflict do nothing;`

## 2. Payment model for ads `[Workstream A5 — updated: Stripe auto-activation shipped]`

Two paths now work, and they coexist:

- **Offline-attested (default):** a business applies (with its creative), you
  confirm payment however you like, then flip the toggle: `applied → approve →
  activate`.
- **Stripe auto-activation (new, per your request):** on an **approved** ad the
  console shows a **"💳 Pay link"** field — enter the agreed amount and it mints
  a Stripe Checkout link (the price rides in the session, so there's nothing to
  pre-configure per campaign). Send it to the business; **when they pay, the ad
  flips to `active` automatically** — the same Stripe webhook that already runs
  your memberships now also stamps `paid_at` on the ad and takes it live. No
  manual toggle needed.

**To enable the Stripe path** (offline path needs none of this): the Stripe env
you already use for membership must be set — `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`, and a service-role key
(`SUPABASE_SERVICE_ROLE_KEY`) so the webhook can write. If those are present,
pay links work out of the box. **Action:** none required unless you want to turn
the Stripe path on — then just confirm those env vars are set in Vercel.

## 3. Ad dimension/size specs `[Workstream A3]`

Enforced at upload (exact, ratio-locked) and shown on the form. Current values:

| Placement | Size | Max | Formats |
|-----------|------|-----|---------|
| Banner | 728×90 (+ optional 320×100 mobile) | 150 KB | JPG/PNG/WebP |
| Ribbon | 1200×120 | 120 KB | JPG/PNG/WebP |
| Generic | 300×250 | 120 KB | JPG/PNG/WebP |

**Action:** accept these or give us new numbers — they live in one place
(`lib/ads.ts` `AD_SPECS`) and change everywhere at once.

## 4. Reviews: native vs external `[Workstream B / decision]`

**Confirmed native** — reviews live in our own database, so ranking data and
the review-for-discount unlock are system-verifiable with no third-party
dependency. Nothing to do unless you *wanted* external-platform reviews (we'd
advise against it — see #5).

## 5. Review-incentive approach `[Workstream B3 — please read]`

We built a **compliance-first** design (full rationale in
`docs/review-incentive-compliance.md`). In short: a business's discount unlocks
for an **honest review of any rating** (never conditioned on a positive one —
FTC), **disclosed up front**, and only on **our own on-site listings** (never
Google/Yelp/TripAdvisor, whose terms forbid incentivized reviews). **Action:**
confirm you're comfortable with this, and that participating businesses know the
deal goes to *all* reviewers. *(Not legal advice — worth a quick check with
counsel before promoting broadly.)* If you'd rather not incentivize at all,
remove the `offer` from a listing and the prompt/unlock simply never appear.

## 6. One-time database update (config, not a decision)

These features added columns/policies/a bucket to Supabase. Re-run the updated
`supabase/schema.sql` once against production (idempotent — validated by running
it twice against a scratch Postgres 16). It adds: the ad state machine
(`placement`/`status` on `advertisers`, the apply-from-form RLS policy, the
`ad-creatives` storage bucket), the `moderation_status`/`refunded_at` columns
for self-serve ads, per-placement daily pricing (app-side), and keeps the public
ad view/RPCs gated on the new `active` status. Everything else (review ranking,
permalinks, the linking engine) is pure app code and needs nothing.

## 7. Self-serve ads: pay-during-application + auto-approval `[new]`

A business can now run an ad end-to-end with no admin step: on `/advertise` they
pick a spot + dates, upload a spec-correct creative, and hit **Pay & go live**.
The creative is checked by **Claude** for appropriateness; if it passes, they go
straight to **Stripe Checkout**, and paying flips the ad live automatically
(within its booked dates). Pricing is the per-placement **daily rate × days**
(see §2 / `lib/ads.ts` — Ribbon $6, Homepage banner $4, Local-guide card $3 per
day; change a number there to reprice everything).

Guardrails, all built in:
- **Moderation is the gate.** Inappropriate creatives are rejected before any
  charge. If Claude is briefly unavailable it **fails closed** — the ad drops to
  the manual `applied` queue and the business is *not* charged (never an
  auto-charge/auto-publish of an unreviewed ad).
- **Admin control is post-hoc**, in `/admin/ads`: **Pause ⏸** (reversible) and
  **Refund 💸** (full Stripe refund + takedown). Paid self-serve ads show a
  `🤖 auto-approved` marker.

**Two owner steps to turn this on:**
1. **Set `ANTHROPIC_API_KEY` in the app env (Vercel).** The creative check runs
   inside the app now (same place as checkout — no Supabase Edge Function or
   gateway auth to get right), so it needs the Anthropic key where the *site*
   runs: add `ANTHROPIC_API_KEY` to Vercel and redeploy. (Until it's set,
   self-serve applications fall back to the manual review queue, no charge. The
   old `moderate-ad` edge function is no longer used by this flow — you can
   ignore it.)
2. Confirm the Stripe **webhook** (already used for paid ads/membership) is live
   and `STRIPE_SECRET_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SITE_URL`
   are set — the same three the existing pay-link flow needs.

## 8. Income avenues from anonymized data `[new — Business Insights + more]`

Four avenues, all aggregate-only (no member PII is ever sold — see the privacy
note below):

**a) Business Insights subscription — the recurring one.** Every listing's
engagement is now counted into `business_stats_daily` (views, website taps,
calls, direction taps, offer unlocks — per business per day, no visitor
identity). Businesses buy their own numbers as a monthly subscription
(**$15/mo** default; `INSIGHTS_MONTHLY_CENTS` on the main site +
`NEXT_PUBLIC_INSIGHTS_PRICE_LABEL` on the media-kit deployment to reprice) and
view them in the **business portal at `<media-kit site>/portal`**:

- A business signs in (or creates an account) with the **contact email on its
  listing** (`businesses.owner_email`) — that's the ownership link.
- Unsubscribed: they see a locked card + "Unlock insights" → Stripe
  subscription checkout (main site `/api/insights/checkout`) → activation is
  webhook-independent (confirmed on checkout return, same as ads).
- Subscribed: 30-day tiles + daily trend + review benchmark ("you're #2 of 6 in
  Coffee") + lifetime totals.
- **Admins (app_admins) see every listing in preview without paying** — that's
  your demo mode.
- Cancel/renewal-failure downgrades automatically via the Stripe webhook;
  counting continues regardless, so history is intact if they re-subscribe.

**b) Advertiser benchmark bundle (price support, already live).** Per-slot CTR
benchmarks (media kit) + per-ad 30-day breakdowns (`/admin/ads`) justify the
daily ad rates at renewal. Nothing to configure.

**c) Public dashboard sponsorship.** The State-of-the-Pack dashboard now has a
sold "Presented by ___" strip: set `NEXT_PUBLIC_SPONSOR_NAME` (+ optional
`NEXT_PUBLIC_SPONSOR_URL`) on the public-analytics deployment and redeploy;
unset = hidden. Suggested $50–100/mo.

**d) Quarterly "Dunedin Dog Economy" report.** All numbers already exist via
the media-kit RPCs + insights aggregates; `docs/dog-economy-report-template.md`
is the outline. Sell as a sponsored PDF ($100–300/quarter) or use as ad-sales
collateral.

**Privacy line to publish** (put on the site's privacy/about page, keeps
practice consistent with the "no tracking, no personal info" promise):

> We count aggregate engagement on business listings (for example, how many
> times a listing was viewed or its website link was tapped each day). These
> counts contain no personal information and are shared only with that
> business. We never sell names, emails, or any member data.

**Owner steps for §8:** re-run `schema.sql`; set `BUSINESS_PORTAL_URL` (the
media-kit URL) + optionally `INSIGHTS_MONTHLY_CENTS` on the main site; redeploy
main site + media-kit. To connect a business to its owner: set the listing's
contact email (`owner_email`) to the owner's login email.

---

### Reminder from the earlier brief (still outstanding)

The **password reset** we just added emails a recovery link to
`/reset-password`. For it to land back on the site, add your site origin to
Supabase **Auth → URL Configuration → Redirect URLs** (the same place the
magic-link redirect for the private dashboard goes). One-time, ~1 minute.
