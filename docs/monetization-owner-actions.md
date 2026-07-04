# Monetization & engagement build — what we need from you

Everything below is built and shipped behind sensible defaults; these are the
five decisions (plus one config step) that turn assumptions into your choices.
Nothing here blocks the rest — it all works today with the defaults noted.

## 1. Which account(s) are admins? `[Workstream A1]`

The ad console (and every admin tool) is gated by the existing `app_admins`
allow-list — the **same email + "My Dogs" sign-in** dog owners already use. A
signed-in non-admin sees a clear "not an admin" notice; an admin lands on the
new **/admin** console. **Action:** tell us which email(s) should be admin (or
add them to `app_admins` yourself). This is the same table the private
analytics dashboard already uses, so if you set that up, you may be done.

## 2. Payment model for ads `[Workstream A5]`

**Default shipped: offline-attested.** A business applies (with its creative),
you confirm payment however you like, then flip the ad's toggle in the console:
`applied → approve/paid → activate`. No payment integration was built. **Action:**
confirm offline is right, or tell us you want an integrated payment flow (we'd
scope that separately).

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
`ad-creatives` storage bucket) and keeps the public ad view/RPCs gated on the
new `active` status. Everything else (review ranking, permalinks, the linking
engine) is pure app code and needs nothing.

---

### Reminder from the earlier brief (still outstanding)

The **password reset** we just added emails a recovery link to
`/reset-password`. For it to land back on the site, add your site origin to
Supabase **Auth → URL Configuration → Redirect URLs** (the same place the
magic-link redirect for the private dashboard goes). One-time, ~1 minute.
