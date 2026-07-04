# Photo moderation — runbook

Every photo a member shares to a dog's page (the "Share a photo" panel on
`/dog/[slug]`) lands in `dog_posts` with `moderation_status = 'pending'`.
RLS forces this — a client cannot insert a pre-approved post — and a pending
post is visible only to its owner. Something has to flip it to `approved`
before it appears publicly. There are two paths, and they can run together.

## The auto path (Claude vision)

The `moderate-photo` Edge Function fetches the uploaded image, asks Claude
for an APPROVED/REJECTED verdict, and flips the row with the service role.
On reject it also deletes the storage object so nothing inappropriate
lingers in the public bucket. The client invokes it right after upload.

Enable it with:

```sh
supabase functions deploy moderate-photo
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# optional — defaults to claude-haiku-4-5:
supabase secrets set PHOTO_MODERATION_MODEL=...
```

(`MODERATION_MODEL` is also honored as a fallback env var, shared with
`moderate-bio`.)

## Fails closed — what that means

If the function isn't deployed, `ANTHROPIC_API_KEY` isn't set, or the API
call errors, the post is **not** published and **not** rejected — it simply
stays `pending`, visible only to its owner. This is deliberate (photo content
risk is higher than text), but it means that with the auto path unconfigured,
**every photo silently sticks pending forever**. The owner sees a "Your posts
under review" list with a Retry button on the dog's page; the admin sees the
same stuck posts on `/admin/photos`.

## The manual path (/admin/photos)

`/admin/photos` lists all pending posts, newest first, with the photo, dog
name, caption and age. It requires signing in with an email that's in the
`app_admins` table (same gate as the other admin pages). Per photo:

- **Approve** — sets `moderation_status = 'approved'`; the photo appears on
  the dog's public page immediately.
- **Reject** — sets `moderation_status = 'rejected'` **and deletes the
  storage object**, exactly like the auto path's reject. The row stays so the
  owner sees the outcome.
- **Retry auto** — re-invokes `moderate-photo` for that post. If the auto
  path isn't set up, the page says so and you can just decide manually.

The buttons run through admin RLS policies in `supabase/schema.sql`
("admins read all posts", "admins moderate posts", "admins read any dog
photo"). If approving reports "No row updated", re-run the current
`schema.sql` (it's idempotent) — the database predates those policies.

## Pick an operating mode

The code supports all three; this is an owner decision:

1. **Auto** — deploy the function + set the key; photos publish within
   seconds. `/admin/photos` stays empty except for rare API errors.
2. **Manual** — don't configure the auto path; review every photo yourself
   at `/admin/photos`. Nothing publishes until you approve it.
3. **Auto with manual fallback (recommended)** — configure the auto path and
   also check `/admin/photos` occasionally: anything the auto path missed
   (outage, expired key) is waiting there instead of being lost.
