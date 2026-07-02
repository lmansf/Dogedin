# Dog of the Day — Instagram pipeline

Once a day, Dogedin publishes the **oldest registered dog that hasn't been
featured yet** to Instagram, with an AI-written caption that an admin approves
first. The website shows the account's recent posts from a cache table — no
Instagram API calls at page load.

## How it flows

```
registration (dog_profiles, oldest first, must have a photo)
        │
        ▼   daily pg_cron tick → Edge Function `daily-post`
1. PUBLISH the oldest APPROVED post_queue row (if nothing posted in ~20h)
2. DRAFT the next dog: Claude writes the caption (fixed hashtags appended
   in code) → post_queue row status 'pending' → notifyAdmin()
        │
        ▼
admin reviews at /admin/posts — edits caption, Approve / Reject
  · Approve → posts on the next daily tick (or "Publish now")
  · Reject  → that dog is never drafted again
        │
        ▼
`sync-ig-feed` (pg_cron, every 30 min) → ig_feed_cache → website feed
```

- A dog is "in the running" if it has a photo and has **never** had a
  `post_queue` row (any status). Rejected = deliberate skip.
- One pending draft at a time — the queue never piles up ahead of the admin.
- Failures set `status='failed'` with the error on the row; retry from
  `/admin/posts`. Rows are never lost.
- IG's ~25-posts/24h API cap is checked before every publish; at the cap the
  post stays `approved` and goes out later.

## Setup

### 1. Database

Run `supabase/schema.sql` (idempotent — re-run the current version). It adds
`post_queue`, `ig_feed_cache`, the `bio` column, and admin RLS policies.

### 2. Instagram / Facebook prerequisites (the likeliest blocker — do early)

1. The Instagram account must be a **Business or Creator** account, connected
   to a **Facebook Page**.
2. Create a Meta app (developers.facebook.com) → add *Instagram Graph API*.
3. Get a **long-lived Page access token** with `instagram_basic`,
   `instagram_content_publish`, `pages_read_engagement`.
4. Find the IG business account id: `GET /{page-id}?fields=instagram_business_account`.
5. **Token refresh:** long-lived tokens expire (~60 days). Refresh with
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=CURRENT_TOKEN`
   and update the secret (calendar reminder, or automate later). A Page token
   obtained via a System User in Meta Business Suite does not expire — the
   better long-term option.

### 3. Edge Function secrets

```sh
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  IG_USER_ID=1784... \
  IG_ACCESS_TOKEN=EAAG... \
  ADMIN_NOTIFY_WEBHOOK=https://hooks.slack.com/...   # optional (Slack/Discord)
# Optional: ANTHROPIC_MODEL (defaults to claude-sonnet-4-5)
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 4. Deploy the functions

```sh
supabase functions deploy daily-post
supabase functions deploy publish-post
supabase functions deploy sync-ig-feed
```

Default JWT verification stays ON: the cron jobs call with the service-role
key; the admin UI calls with the admin's session JWT, and every function
re-checks `app_admins` server-side.

### 5. Schedule with pg_cron

Enable the `pg_cron` and `pg_net` extensions (Dashboard → Database →
Extensions), then run the two `cron.schedule` statements at the bottom of
`supabase/schema.sql` with your project ref + service-role key filled in
(daily post at 14:00 UTC ≈ morning in Dunedin; feed sync every 30 min).

### 6. Smoke test

1. Register a dog with a photo (and a fun fact — it feeds the caption).
2. `/admin/posts` → "Draft next dog now" → a pending draft with an AI caption
   appears within seconds.
3. Edit the caption, Approve, then "Publish now" → the post appears on the
   real IG account and the row flips to `published` with a permalink.
4. After the next `sync-ig-feed` run (or invoke it manually), the post shows
   in the homepage "From the pack" feed.

## Security model

- `post_queue` RLS: only `app_admins` can read/update; inserts and publish
  updates happen via the service role inside Edge Functions.
- `ig_feed_cache`: public read, service-role write.
- All tokens (Anthropic, IG, service role) live in Edge Function secrets —
  nothing reaches the browser.
- Functions authenticate callers as service-role **or** an `app_admins` JWT.

## Notes & future work

- **Owner consent:** every registered dog with a photo is eligible for the
  feature. The admin gate covers moderation, but an explicit "OK to feature on
  Instagram" checkbox at registration would be the courteous upgrade.
- The old direct-Graph-API homepage feed still works as a fallback while
  `ig_feed_cache` is empty, so nothing breaks mid-setup.
- If approval flow later needs multi-step retries or long human-wait windows,
  the function bodies map cleanly onto Inngest / Trigger.dev `step.run` /
  `waitForEvent` primitives — don't add that dependency for v1.
