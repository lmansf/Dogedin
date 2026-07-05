# Dogedin — Everything we need from you, in one pass

Each item below blocks a specific piece of work. Everything else is proceeding without you. Items are ordered by impact.

## 1. Fix the domain (this is the "connection is not private" root cause) — ~20 min

**Diagnosis (verified via live DNS + your connected Shopify store):** `dogedin.com`'s DNS points at **Shopify's** servers (A records 23.227.38.65 / 23.227.38.32, www → data-shops.myshopify.com) — but the domain is **not attached to your Shopify store at all** (the store's only domains are `dogedin-store.myshopify.com` and `dropsweatshirt.myshopify.com`). So visitors to dogedin.com hit Shopify's edge, no store answers for that hostname, and Shopify presents a certificate that doesn't cover dogedin.com → every external link from the analytics dashboards (which all point at dogedin.com) throws the browser privacy warning. Meanwhile the actual site lives on Vercel. No code change can fix this.

**Do this:**
1. Vercel → main Dogedin project → Settings → Domains → add `dogedin.com` and `www.dogedin.com`. Vercel shows the DNS records it needs.
2. Wherever the DNS is managed (if the domain was bought through Shopify: Shopify admin → Settings → Domains → dogedin.com → DNS settings; otherwise your registrar): delete the Shopify records (apex A 23.227.38.65 / 23.227.38.32, www CNAME data-shops.myshopify.com) and add what Vercel showed (typically apex A 76.76.21.21, www CNAME cname.vercel-dns.com).
3. Nothing to detach in Shopify — dogedin.com was never attached to the store. The shop integration only needs `dogedin-store.myshopify.com`, which keeps working.
4. After Vercel shows the cert issued: done. Every dashboard link heals with zero code changes.
5. Then set `NEXT_PUBLIC_SITE_URL=https://dogedin.com` in all four Vercel projects (main site, media kit, public analytics, private analytics) and redeploy each.

**Also blocks:** printed QR dog tags (they encode this URL), Stripe checkout redirects, SEO canonical URLs/sitemap.

## 2. Real business list — blocks "replace placeholder businesses"

The businesses system is fully built (table, ratings/reviews, moderation queue at /admin/businesses, self-serve submission form at /list-your-business). It just needs rows. For each real business: **name, category, neighborhood, short description, address, phone/website (optional), opening hours, a photo, dog-friendly features**. Two ways to load them:
- You (or the businesses themselves) submit via `/list-your-business`, then you approve at `/admin/businesses`, or
- Send us the list and we'll prepare a seed SQL you run once.

Note: we changed the fallback logic so production **never shows the fake demo businesses again** — with an empty table the guide now shows an honest empty state until real ones land.

## 3. Real shop inventory — blocks shop population

The shop is a headless Shopify storefront: **inventory, prices, images, discounts and checkout all live in Shopify**, not in the site code. We checked the connected store: it already has **one real active product** ("Dogedin or Dunedin T shirt and hat", $19.95, Black variant) — but its **inventory is 0**, so it can't sell. To go live:
1. In the Shopify admin, set stock for the existing product (or disable inventory tracking / allow overselling for print-on-demand) and add the rest of the catalog.
2. Create a Storefront API token (Shopify admin → Settings → Apps → Develop apps → Storefront API) and set the main site's Vercel env — **note the store domain is `dogedin-store.myshopify.com`**, not `dogedin.myshopify.com` as the env example previously suggested: `SHOPIFY_STORE_DOMAIN=dogedin-store.myshopify.com`, `SHOPIFY_STOREFRONT_TOKEN=...`.
Until then, production now shows a "shop opening soon" state instead of fake items with a broken cart.

## 4. Destination email for business/ad applications + email delivery

Submissions already land safely in the database (nothing is lost), and we added `/admin/inquiries` so you can see every advertise-form lead. But **email notifications are off** until:
1. You set the destination inbox: `supabase secrets set AD_INQUIRY_NOTIFY_EMAIL=you@example.com` (no default — without it the team notification is skipped; inquiries still land in `ad_inquiries`).
2. A (free-tier) **Resend** API key is created and set as a Supabase function secret: `supabase secrets set RESEND_API_KEY=... AD_INQUIRY_NOTIFY_EMAIL=you@example.com`, and the `notify-ad-inquiry` function is deployed (`supabase functions deploy notify-ad-inquiry`).
We can do step 2 if you give us access or run two commands we send you.

## 5. Photo approval: pick a mode

Why photos "never go live": uploads are designed to be auto-moderated by a Claude-vision Supabase Edge Function that **fails closed** — and it appears the function/API key was never deployed in production, so every photo sits "pending" forever. We built the missing manual approval queue at **/admin/photos** (approve / reject / retry-auto per photo). Pick one:
- **(a) Auto** — deploy the function + set the API key (`supabase functions deploy moderate-photo && supabase secrets set ANTHROPIC_API_KEY=...`); photos go live in seconds, /admin/photos becomes the rescue queue. **(Recommended)**
- **(b) Manual** — do nothing ops-wise; you approve each photo at /admin/photos.
- **(c) Auto with manual fallback** — same as (a); anything the AI can't process waits for you in the queue.
Full runbook: `docs/photo-moderation-runbook.md` in the main repo.

## 6. Confirm the new banner line (replaces "free treats")

The fake "FREE TREATS OVER $50" line is gone. In its place the banner now auto-features the **top-rated business**, draft copy: `⭐ TOP OF THE PACK: {BUSINESS NAME}`. Same business is also featured on the home page between the ad slot and the approved-spots section, updating automatically as ratings change. **Confirm or reword the copy/tone.**

## 7. Confirm two smaller product decisions (defaults already shipped, both reversible)

- **Private analytics sign-in:** email/password is removed, replaced with **magic-link** sign-in (same admin allow-list, no passwords to manage). One config step: in Supabase → Auth → URL Configuration, add the dashboard's URL to Redirect URLs. Say the word if you'd rather have Google OAuth or Vercel-level protection.
- **Paws:** the dog-profile Paw button is **one paw per signed-in user per dog** (toggleable). If you want anonymous paws or unlimited paws instead, say so.
- **Friends privacy:** friends lists are now visible **only to the dog's owner** (hidden from everyone else in UI and at the database-policy layer). Community-level counts on the public dashboard still work (anonymized).

## 8. One-time database update

Several fixes above changed database policies/functions. Run the updated `supabase/schema.sql` from the main repo once against the production Supabase project (it's idempotent — validated by running it repeatedly against a scratch Postgres, safe to re-run). This single step activates: friends privacy, profile paws, admin photo-queue permissions, the private dashboard's member/revenue reads (`admins read members` policy), and the three analytics functions the dashboards call (`media_kit_stats` — this one **never existed**, which is why the business dashboard could only ever show placeholder numbers — plus `media_kit_weekly` and `friendship_dates`).

## 9. Analytics dashboards env (5 minutes, fixes "placeholder data")

Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel projects for the **media kit**, **public analytics**, and **private analytics** dashboards, then redeploy each (these vars bake in at build time). Without them the dashboards intentionally show labeled sample data. Two small extras while you're in there: add each dashboard's own URL to Supabase **Auth → URL Configuration → Redirect URLs** (needed by the private dashboard's new magic-link sign-in), and set `NEXT_PUBLIC_DASHBOARD_URL` on the public analytics project (makes its new social-share cards use the right absolute URL). Optionally flip on **Web Analytics** in the media-kit Vercel project — the tracking code is already installed and every "advertise" click is tagged by placement.

## FYI — needs nothing from you

- **Award opportunity (GO recommendation):** Better Cities For Pets city certification — free, open now, a community partner may apply with the Mayor's awareness, Dunedin isn't certified while Tampa/St. Pete are, and it unlocks a $20K annual grant track. Full findings in the report. Waiting on your go-ahead before any outreach.
- Vercel Analytics is now installed on the media kit (one toggle to flip in the Vercel project to activate).
