# Review-for-discount: compliance design

**Status:** recommendation, implemented behind a compliant design. **Not legal
advice — confirm with counsel before promoting broadly.**

Workstream B3 lets a business offer a discount to people who leave a review.
Incentivized reviews are legally sensitive, so the design below is deliberately
narrow. Two rules drive everything:

## 1. Never condition the reward on sentiment (FTC)

The FTC's rules on reviews and testimonials prohibit offering an incentive in
exchange for a review *expressing a particular sentiment* (i.e. "leave us a
5-star review and get 10% off"). What's permissible is rewarding an **honest
review of any rating**, positive or negative, with **clear disclosure** that an
incentive was offered.

**How the build honours this:**
- The unlock fires for a review of **any** star rating (`ReviewForm` sets
  `unlocked` on any successful review — it never checks the rating).
- The offer is **disclosed up front**, before the review is written ("Leave an
  honest review — any rating — … No positive review required.").
- The thank-you panel repeats the disclosure ("reviews of any rating qualify").

## 2. First-party listings only — never external platforms

Google, Yelp and TripAdvisor prohibit incentivized reviews **on their
platforms**, and gating a discount on an off-site review would violate their
terms (and can get a business's listing penalised). So the incentive applies
**only to reviews on Dogedin's own listings**, which we control and which are
native to our database (`reviews` table). We never ask anyone to review a
business on Google/Yelp/etc. in exchange for anything.

Because our reviews are native, completion is **system-verifiable**: the review
row is persisted server-side before the discount unlocks (`res.persisted`), so
there's no user-supplied "proof of review" to trust — the review itself is the
proof. (In preview mode, where nothing persists, the unlock is intentionally
suppressed.)

## What the owner still controls

- **Whether a business offers a deal at all** — the unlock only appears when the
  listing has an `offer` (`{label, detail, code}`). No offer → normal reviews.
- **The offer copy and any code** — set per business in the `businesses.offer`
  column / admin.

## What we deliberately did **not** build

- No incentive tied to a specific rating or to leaving a review elsewhere.
- No "upload a screenshot of your Google review" verification (that's the
  external-platform pattern we're avoiding).
- No auto-redemption/payment — redemption is "show this at the business", which
  keeps Dogedin out of the transaction.

## One open item for the owner

Confirm you're comfortable with the disclosure wording and that participating
businesses know the deal is offered to **all** reviewers, not just happy ones.
If you'd rather not incentivize reviews at all, remove the `offer` from listings
and the prompt/unlock simply never render.
