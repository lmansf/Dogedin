-- ============================================================================
-- Dogedin — consolidated Supabase schema (all community features)
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor after setting the project env vars.
-- It is idempotent (safe to re-run). Covers:
--   1. Things to do  — businesses, reviews, upvotes, replies
--   2. Dog profiles  — registration, public lookup, tag/QR lookup, photos
--   3. Advertisers   — ad rotation + impression/click tracking + admin
--   4. Members       — paid membership status (written by the Stripe webhook)
--
-- Nothing here touches Shopify/commerce — that stays in the storefront.
-- ============================================================================

create extension if not exists pgcrypto;

-- Emails allowed to manage admin surfaces (/admin/*). Seed your own address
-- here (or in the dashboard) to use them. Created first, before anything else
-- in this file, because several policies below (businesses, dog photos,
-- advertisers, post_queue, dog_posts, storage) reference it in an `exists`
-- check — a policy fails to create if the table it queries doesn't exist yet.
create table if not exists public.app_admins (
  email       text primary key,
  created_at  timestamptz not null default now()
);
-- Example: insert into public.app_admins (email) values ('you@example.com');
-- Seed the initial admins so a fresh deploy always has someone who can sign in
-- and manage the site. Idempotent — safe to re-run.
insert into public.app_admins (email) values
    ('lmansf96@gmail.com'),
    ('rosemiller.info@gmail.com')
  on conflict (email) do nothing;
alter table public.app_admins enable row level security;
drop policy if exists "admins read admin list" on public.app_admins;
create policy "admins read admin list" on public.app_admins
  for select to authenticated
  using (email = (auth.jwt() ->> 'email'));

-- ============================================================================
-- 1. THINGS TO DO — local business reviews + self-service listing submissions
-- ============================================================================
create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  category      text not null,
  neighborhood  text,
  description   text,
  image         text,            -- self-hosted asset path or business-photos public URL
  dog_friendly  boolean not null default true,
  place_id      text,            -- future: real-world place / partner id
  offer         jsonb,           -- { label, detail, code } partner discount
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Additive columns for the self-service submission form (owner contact stays
-- admin-only; the rest is what a visitor needs to actually visit the place).
alter table public.businesses add column if not exists owner_name  text;
alter table public.businesses add column if not exists owner_email text;
alter table public.businesses add column if not exists phone      text;
alter table public.businesses add column if not exists website    text;
alter table public.businesses add column if not exists address    text;
-- { monday: {open, close, closed}, ..., sunday: {...} } — 24h "HH:MM" strings,
-- open/close null when closed. Built from an actual per-day form, not a
-- single "hours" free-text field, so /things-to-do can show real hours today.
alter table public.businesses add column if not exists hours      jsonb;
-- Town for the multi-city directory (Dunedin → Clearwater → Palm Harbor →
-- Tarpon Springs, growing outward — see DIRECTORY_CITIES in lib/businesses.ts).
-- Free text on purpose: the app supplies a dropdown but the ring isn't a
-- closed set. Every pre-existing row was a Dunedin listing, so the default
-- backfills them correctly.
alter table public.businesses add column if not exists city text not null default 'Dunedin';
-- Stamped by the welcome-business Edge Function after it emails the submitter
-- their portal link, so retries/duplicate invocations can never double-send.
alter table public.businesses add column if not exists welcome_sent_at timestamptz;

-- Moderation gate: submissions land 'pending' and only show on the site once
-- an admin flips them to 'approved' ('denied' keeps them hidden for good).
-- Backfill from the old `active` flag BEFORE the column gets a default, so
-- adding it doesn't hide every already-live listing behind a fresh
-- 'pending' status; only then do we enforce not-null and drop `active`,
-- which this fully supersedes.
do $$ begin
  create type public.business_status as enum ('pending', 'approved', 'denied');
exception when duplicate_object then null; end $$;
alter table public.businesses add column if not exists status public.business_status;
-- Only backfill from `active` while that column still exists — on a second
-- run of this file (active already dropped below), this would otherwise
-- fail with "column businesses.active does not exist" and abort the script.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'businesses' and column_name = 'active'
  ) then
    update public.businesses
      set status = (case when active then 'approved' else 'denied' end)::public.business_status
      where status is null;
  end if;
end $$;
alter table public.businesses alter column status set default 'pending';
alter table public.businesses alter column status set not null;
alter table public.businesses drop column if exists active;

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  author        text not null,
  rating        int  not null check (rating between 1 and 5),
  body          text not null,
  upvotes       int  not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists reviews_business_id_idx on public.reviews(business_id);
-- Newest-first review listings per business (order by created_at desc) are the
-- hot path; the composite lets Postgres seek+scan instead of sorting.
create index if not exists reviews_business_created_idx on public.reviews(business_id, created_at);

create table if not exists public.review_replies (
  id            uuid primary key default gen_random_uuid(),
  review_id     uuid not null references public.reviews(id) on delete cascade,
  author        text not null,
  body          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists review_replies_review_id_idx on public.review_replies(review_id);

create or replace function public.increment_review_upvotes(p_review_id uuid)
returns int language sql security definer set search_path = public as $$
  update public.reviews set upvotes = upvotes + 1
   where id = p_review_id returning upvotes;
$$;
grant execute on function public.increment_review_upvotes(uuid) to anon, authenticated;

alter table public.businesses      enable row level security;
alter table public.reviews         enable row level security;
alter table public.review_replies  enable row level security;

-- The base table is no longer publicly readable — it carries owner_name /
-- owner_email (submitter contact) and pending/denied rows that shouldn't be
-- visible. Public reads go through public_businesses (below) instead.
drop policy if exists "businesses are public" on public.businesses;

-- Self-service submissions: anyone can insert, but only ever as 'pending' —
-- RLS (not just the form) blocks a direct API call from inserting a
-- pre-approved listing, same reasoning as the dog_posts moderation gate.
drop policy if exists "anyone can submit a business" on public.businesses;
create policy "anyone can submit a business" on public.businesses
  for insert with check (status = 'pending');

-- Admins see and manage everything: the review queue (pending/denied rows)
-- plus approve/deny/edit on any listing.
drop policy if exists "admins manage businesses" on public.businesses;
create policy "admins manage businesses" on public.businesses
  for all to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

-- Public read surface: approved listings only, and never the submitter's
-- contact info. Definer view bypasses the base table's now-locked-down RLS.
drop view if exists public.public_businesses;
create view public.public_businesses
with (security_invoker = false) as
  select id, slug, name, category, city, neighborhood, description, image, dog_friendly,
         phone, website, address, hours, place_id, offer, created_at
  from public.businesses
  where status = 'approved';
grant select on public.public_businesses to anon, authenticated;

-- Now that businesses can be pending/denied, reviews/replies must check
-- approval too — otherwise anyone who knows/guesses a business_id could
-- pre-load reviews onto a not-yet-approved listing, which then appear the
-- instant it's approved without ever being part of what the admin reviewed.
-- A SECURITY DEFINER function (not a direct businesses/public_businesses
-- reference) because base `businesses` is admin-only now — an anon caller
-- can't read it even inside a subquery, and the function needs to answer
-- correctly for anon too.
create or replace function public.business_is_approved(p_business_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.businesses where id = p_business_id and status = 'approved'
  );
$$;
grant execute on function public.business_is_approved(uuid) to anon, authenticated;

drop policy if exists "reviews are public" on public.reviews;
create policy "reviews are public" on public.reviews
  for select using (public.business_is_approved(business_id));
drop policy if exists "reviews are insertable" on public.reviews;
create policy "reviews are insertable" on public.reviews
  for insert with check (public.business_is_approved(business_id));
drop policy if exists "replies are public" on public.review_replies;
create policy "replies are public" on public.review_replies
  for select using (
    exists (select 1 from public.reviews r where r.id = review_id and public.business_is_approved(r.business_id))
  );
drop policy if exists "replies are insertable" on public.review_replies;
create policy "replies are insertable" on public.review_replies
  for insert with check (
    exists (select 1 from public.reviews r where r.id = review_id and public.business_is_approved(r.business_id))
  );

-- Storage bucket for business card photos, uploaded via the public
-- /list-your-business form. Anonymous insert (no login system for
-- businesses) is acceptable here the same way ad_inquiries accepts anonymous
-- text: the photo only ever becomes visible once an admin approves the
-- listing it belongs to, same trust model as the rest of the submission.
-- file_size_limit / allowed_mime_types enforce at the bucket level what
-- validateBusinessPhoto() only checks client-side — a direct Storage API
-- call has no other barrier here, since inserts aren't scoped to a caller.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('business-photos', 'business-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "business photos are public read" on storage.objects;
create policy "business photos are public read" on storage.objects
  for select using (bucket_id = 'business-photos');
drop policy if exists "anyone can upload a business photo" on storage.objects;
create policy "anyone can upload a business photo" on storage.objects
  for insert with check (bucket_id = 'business-photos');
drop policy if exists "admins delete any business photo" on storage.objects;
create policy "admins delete any business photo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-photos'
    and exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email'))
  );

-- Storage bucket for ad creatives, uploaded via the public /advertise form when
-- a business applies for a slot (same anonymous-insert trust model as
-- business-photos: the creative only renders once an admin approves + activates
-- the ad). The bucket size cap is the largest per-placement spec (150 KB);
-- validateAdCreative() enforces the exact per-placement dimensions/size/format
-- client-side, and this is the server-side backstop.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ad-creatives', 'ad-creatives', true, 153600, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "ad creatives are public read" on storage.objects;
create policy "ad creatives are public read" on storage.objects
  for select using (bucket_id = 'ad-creatives');
drop policy if exists "anyone can upload an ad creative" on storage.objects;
create policy "anyone can upload an ad creative" on storage.objects
  for insert with check (bucket_id = 'ad-creatives');
drop policy if exists "admins delete any ad creative" on storage.objects;
create policy "admins delete any ad creative" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ad-creatives'
    and exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email'))
  );

-- ============================================================================
-- 2. DOG PROFILES — registration, public lookup, physical tag / QR lookup
-- ============================================================================
create table if not exists public.dog_profiles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  slug                 text unique not null,
  tag_code             text unique not null,   -- short code printed on a physical tag
  owner_name           text not null check (char_length(owner_name) between 1 and 80),
  owner_phone          text not null check (char_length(owner_phone) between 3 and 40),
  owner_email          text not null check (char_length(owner_email) between 3 and 120),
  dog_name             text not null check (char_length(dog_name) between 1 and 60),
  breed                text check (char_length(breed) <= 60),
  bio                  text check (char_length(bio) <= 300),  -- optional fun fact
  photo_path           text,
  lost_contact_opt_in  boolean not null default false,
  created_at           timestamptz not null default now()
);
-- Additive column for databases created from an earlier schema version.
alter table public.dog_profiles add column if not exists bio text;
create index if not exists dog_profiles_user_id_idx    on public.dog_profiles (user_id);
create index if not exists dog_profiles_dog_name_idx   on public.dog_profiles (lower(dog_name));
create index if not exists dog_profiles_owner_name_idx on public.dog_profiles (lower(owner_name));

alter table public.dog_profiles enable row level security;
drop policy if exists "owners manage own dogs" on public.dog_profiles;
create policy "owners manage own dogs" on public.dog_profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public, privilege-gated view. Definer (security_invoker=false) so it bypasses
-- base RLS and exposes only safe columns; contact is nulled unless opted in.
-- Note: tag_code is deliberately NOT exposed here. It's a semi-secret pointer
-- for the physical tag/QR; the owner sees it on /account (base table, owner
-- RLS), and finders resolve it via resolve_tag(). Exposing it in a public,
-- unfiltered view would let anyone enumerate every dog's tag.
-- Dropped first (not just CREATE OR REPLACE) so re-running after an earlier
-- version that exposed tag_code succeeds — you can't drop a view column via
-- CREATE OR REPLACE.
drop view if exists public.public_dog_profiles;
create view public.public_dog_profiles
with (security_invoker = false) as
  select
    id, slug, dog_name, breed, bio, photo_path, lost_contact_opt_in, created_at,
    case when lost_contact_opt_in then owner_phone end as owner_phone,
    case when lost_contact_opt_in then owner_email end as owner_email
  from public.dog_profiles;
grant select on public.public_dog_profiles to anon, authenticated;

-- Search by dog OR owner name OR tag code; returns only public columns.
create or replace function public.search_dogs(q text)
returns table (slug text, dog_name text, breed text, photo_path text, has_contact boolean)
language sql security definer stable set search_path = public as $$
  -- raw = the trimmed query (exact tag match); esc = the same with LIKE
  -- metacharacters (\ % _) escaped so a query of "%" can't match every row.
  with e as (
    select btrim(q) as raw,
           replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') as esc
  )
  select d.slug, d.dog_name, d.breed, d.photo_path, d.lost_contact_opt_in
  from public.dog_profiles d, e
  where length(e.raw) >= 2
    and (d.dog_name ilike '%' || e.esc || '%' escape '\'
      or d.owner_name ilike '%' || e.esc || '%' escape '\'
      or upper(d.tag_code) = upper(e.raw))
  order by d.dog_name
  limit 50;
$$;
grant execute on function public.search_dogs(text) to anon, authenticated;

-- Exact tag-code resolver for the physical-tag / QR lookup flow (Phase 2).
create or replace function public.resolve_tag(code text)
returns text language sql security definer stable set search_path = public as $$
  select slug from public.dog_profiles where upper(tag_code) = upper(btrim(code)) limit 1;
$$;
grant execute on function public.resolve_tag(text) to anon, authenticated;

-- Breed counts for the community "breed leaderboard" bar chart. initcap()
-- both groups and labels, so casing variants (LABRADOR / labrador) collapse
-- into one bucket; blank/missing breed rolls up into "Mixed / Unknown".
create or replace function public.breed_counts()
returns table (breed text, dog_count bigint)
language sql security definer stable set search_path = public as $$
  select
    initcap(coalesce(nullif(trim(breed), ''), 'mixed / unknown')) as breed,
    count(*)::bigint as dog_count
  from public.dog_profiles
  group by 1
  order by dog_count desc;
$$;
grant execute on function public.breed_counts() to anon, authenticated;

-- Storage bucket for dog photos. Matches the client-side 3MB/image-type
-- checks in RegisterFlow.tsx and lib/dogPosts.ts at the bucket level too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('dog-photos', 'dog-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "dog photos are public read" on storage.objects;
create policy "dog photos are public read" on storage.objects
  for select using (bucket_id = 'dog-photos');
drop policy if exists "owners upload own dog photos" on storage.objects;
create policy "owners upload own dog photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dog-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owners delete own dog photos" on storage.objects;
create policy "owners delete own dog photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dog-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Admins can also delete any dog photo (moderation: pulling a reported post's
-- image, which otherwise lives outside the uploading owner's own folder check).
drop policy if exists "admins delete any dog photo" on storage.objects;
create policy "admins delete any dog photo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'dog-photos'
    and exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email'))
  );

-- ============================================================================
-- 3. ADVERTISERS — local business ads with rotation + tracking
-- ============================================================================
-- (app_admins, used by the "admins manage ads" policy below, is created at
-- the very top of this file.)
create table if not exists public.advertisers (
  id             uuid primary key default gen_random_uuid(),
  business_name  text not null,
  tagline        text,             -- one-liner shown on the native "card" ad format
  image_url      text not null,   -- /assets/ads/foo.svg (self-hosted) or external
  link_url       text not null,
  weight         int  not null default 1 check (weight between 0 and 100),
  active         boolean not null default true,
  -- Flight window: campaigns expire themselves instead of running until an
  -- admin remembers to untick `active`. Null = evergreen.
  starts_at      date,
  ends_at        date,
  impressions    bigint not null default 0,   -- lifetime totals
  clicks         bigint not null default 0,
  created_at     timestamptz not null default now()
);
-- Additive columns for databases created from an earlier schema version.
alter table public.advertisers add column if not exists tagline  text;
alter table public.advertisers add column if not exists starts_at date;
alter table public.advertisers add column if not exists ends_at   date;

-- Placement type + lifecycle state (added for the ad-management console).
--   placement: which kind of slot a creative fits — banner (primary paid unit),
--     ribbon (top strip) or generic (300x250 rectangle). A slot only serves ads
--     of its own placement type.
--   status:   applied  → a business submitted a creative via /advertise
--             approved → an admin attests it's approved/paid (not yet live)
--             active   → renders live in its slot (this is what public_ads sees)
--             disabled → toggled off. Only 'active' rows in flight ever serve.
-- The legacy `active` boolean is kept in sync by the app writers, but `status`
-- is the single source of truth for what renders.
do $$ begin
  create type public.ad_placement as enum ('banner', 'ribbon', 'generic');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ad_status as enum ('applied', 'approved', 'active', 'disabled');
exception when duplicate_object then null; end $$;

alter table public.advertisers add column if not exists placement public.ad_placement not null default 'banner';
alter table public.advertisers add column if not exists mobile_image_url text;   -- optional banner mobile variant (320x100)
alter table public.advertisers add column if not exists contact_email text;      -- applicant email for form-submitted ads
alter table public.advertisers add column if not exists paid_at timestamptz;     -- set by the Stripe webhook when an ad is paid
alter table public.advertisers add column if not exists stripe_payment_ref text; -- Stripe payment_intent / session id for the payment
alter table public.advertisers add column if not exists moderation_status text;  -- 'approved' when a self-serve creative passed Claude auto-moderation (/advertise)
alter table public.advertisers add column if not exists refunded_at timestamptz; -- set when an admin refunds a paid ad from /admin/ads
alter table public.advertisers add column if not exists status public.ad_status;
-- Backfill legacy rows created before the state machine: whatever was live
-- becomes 'active', the rest 'disabled'. Idempotent — only null-status rows are
-- touched, so form-submitted 'applied' rows and any set status survive re-runs.
update public.advertisers
  set status = case when active then 'active'::public.ad_status else 'disabled'::public.ad_status end
  where status is null;
alter table public.advertisers alter column status set default 'applied';
alter table public.advertisers alter column status set not null;

alter table public.advertisers enable row level security;

-- The public reads ads through the public_ads view below (display columns
-- only), NOT the base table — so impressions/clicks stay admin-only. There is
-- deliberately no anon/public SELECT policy on the base advertisers table.
-- Explicitly drop the earlier public policy in case a prior version created it.
drop policy if exists "active ads are public" on public.advertisers;

-- Admins (see app_admins) get full control of advertisers.
drop policy if exists "admins manage ads" on public.advertisers;
create policy "admins manage ads" on public.advertisers
  for all to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

-- A business may APPLY for an ad from the public /advertise form (same trust
-- model as submitting a business listing or an ad inquiry): the insert is
-- forced to the 'applied' state, so nothing a stranger uploads can ever render
-- until an admin approves and activates it. Admins still go through the policy
-- above for everything else.
drop policy if exists "anyone can apply for an ad" on public.advertisers;
create policy "anyone can apply for an ad" on public.advertisers
  for insert to anon, authenticated
  with check (status = 'applied');

-- Public read surface for ads: in-flight active rows, display columns only (no
-- counters). Definer view bypasses the base-table RLS; AdSlot reads this.
-- Dropped first: the column set changed (tagline added) and CREATE OR REPLACE
-- can't alter a view's columns.
drop view if exists public.public_ads;
create view public.public_ads
with (security_invoker = false) as
  select id, business_name, tagline, image_url, mobile_image_url, link_url, weight, placement
  from public.advertisers
  where status = 'active'
    and (starts_at is null or starts_at <= current_date)
    and (ends_at   is null or ends_at   >= current_date);
grant select on public.public_ads to anon, authenticated;

-- Per-slot, per-day stats so the admin can tell an advertiser exactly which
-- placement performed and price slots honestly. Lifetime counters stay on the
-- advertisers row; this table answers "what did I get last month, and where?".
create table if not exists public.ad_stats_daily (
  ad_id        uuid not null references public.advertisers(id) on delete cascade,
  slot         text not null,
  day          date not null default current_date,
  impressions  bigint not null default 0,
  clicks       bigint not null default 0,
  primary key (ad_id, slot, day)
);
alter table public.ad_stats_daily enable row level security;
-- Date-range rollups ("last 30 days across all ads") scan by day; without this
-- the composite PK (ad_id, slot, day) can't serve a day-only range efficiently.
create index if not exists ad_stats_daily_day_idx on public.ad_stats_daily(day);
drop policy if exists "admins read ad stats" on public.ad_stats_daily;
create policy "admins read ad stats" on public.ad_stats_daily
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

-- Counters bumped by SECURITY DEFINER functions so anon never updates tables
-- directly. Slot-aware replacements for the old increment_* functions (dropped
-- below so re-runs converge). Slot names are sanitised server-side.
drop function if exists public.increment_ad_impression(uuid);
drop function if exists public.increment_ad_click(uuid);

create or replace function public.record_ad_impression(p_ad_id uuid, p_slot text default 'unknown')
returns void language plpgsql security definer set search_path = public as $$
declare
  s text := coalesce(nullif(left(regexp_replace(lower(coalesce(p_slot, '')), '[^a-z0-9_-]', '', 'g'), 32), ''), 'unknown');
begin
  update public.advertisers set impressions = impressions + 1
   where id = p_ad_id and status = 'active';
  if found then
    insert into public.ad_stats_daily (ad_id, slot, impressions)
      values (p_ad_id, s, 1)
      on conflict (ad_id, slot, day)
      do update set impressions = public.ad_stats_daily.impressions + 1;
  end if;
end $$;
grant execute on function public.record_ad_impression(uuid, text) to anon, authenticated;

create or replace function public.record_ad_click(p_ad_id uuid, p_slot text default 'unknown')
returns text language plpgsql security definer set search_path = public as $$
declare
  s text := coalesce(nullif(left(regexp_replace(lower(coalesce(p_slot, '')), '[^a-z0-9_-]', '', 'g'), 32), ''), 'unknown');
  target text;
begin
  update public.advertisers set clicks = clicks + 1
   where id = p_ad_id and status = 'active'
   returning link_url into target;
  if target is not null then
    insert into public.ad_stats_daily (ad_id, slot, clicks)
      values (p_ad_id, s, 1)
      on conflict (ad_id, slot, day)
      do update set clicks = public.ad_stats_daily.clicks + 1;
  end if;
  return target;
end $$;
grant execute on function public.record_ad_click(uuid, text) to anon, authenticated;

-- Advertiser inquiries from the /advertise page: anyone may submit, only
-- admins may read. The acquisition funnel for Main Street businesses.
create table if not exists public.ad_inquiries (
  id             uuid primary key default gen_random_uuid(),
  business_name  text not null check (char_length(business_name) between 1 and 120),
  contact_name   text not null check (char_length(contact_name) between 1 and 80),
  email          text not null check (char_length(email) between 3 and 120),
  message        text check (char_length(message) <= 2000),
  created_at     timestamptz not null default now(),
  notified_at    timestamptz
);
alter table public.ad_inquiries add column if not exists notified_at timestamptz;
alter table public.ad_inquiries enable row level security;
drop policy if exists "anyone can submit an ad inquiry" on public.ad_inquiries;
create policy "anyone can submit an ad inquiry" on public.ad_inquiries
  for insert with check (true);
drop policy if exists "admins read ad inquiries" on public.ad_inquiries;
create policy "admins read ad inquiries" on public.ad_inquiries
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));
-- No update policy: the notify-ad-inquiry Edge Function stamps notified_at
-- using the service role, which bypasses RLS entirely.

-- ============================================================================
-- 4. MEMBERS — paid membership (rows written by the Stripe webhook)
-- ============================================================================
create table if not exists public.members (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  member_name             text,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  status                  text not null default 'inactive',  -- active|past_due|canceled|inactive
  -- Generated once at row creation and never rewritten, so a member's card code
  -- stays stable across webhook retries / re-subscribes.
  card_code               text unique default
                            ('DOG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
-- Ensure the default is applied even if the table pre-existed without it.
alter table public.members
  alter column card_code set default
    ('DOG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

alter table public.members enable row level security;
-- A member may read their OWN row. All writes happen server-side in the Stripe
-- webhook via the service-role key (bypasses RLS) — never from the browser.
drop policy if exists "members read own row" on public.members;
create policy "members read own row" on public.members
  for select to authenticated using (auth.uid() = user_id);

-- The private analytics dashboard reads members (status mix, MRR, new-member
-- trend) with an admin JWT — same app_admins email check as every other
-- admins-* policy in this file. Without this, its Revenue page has no path to
-- the table: the queries still succeed but return zero rows, so member
-- counts and MRR silently read as 0 there until this policy exists.
drop policy if exists "admins read members" on public.members;
create policy "admins read members" on public.members
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

-- Coming-soon interest: pre-launch features (the Club, the events calendar)
-- are hidden behind promise-free teasers, and every teaser click lands here so
-- demand is measurable before anything is offered. No PII — a per-feature,
-- per-source, per-day counter, same shape as ad_stats_daily. Features and
-- sources are short slugs ('club'/'events', 'nav'/'home'/'footer'/'visit'…).
-- Read by the private analytics dashboard (admin RLS) to decide what to build.
create table if not exists public.feature_interest_daily (
  feature  text not null,
  source   text not null,
  day      date not null default current_date,
  clicks   bigint not null default 0,
  primary key (feature, source, day)
);
alter table public.feature_interest_daily enable row level security;
drop policy if exists "admins read feature interest" on public.feature_interest_daily;
create policy "admins read feature interest" on public.feature_interest_daily
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

create or replace function public.record_feature_click(p_feature text, p_source text default 'unknown')
returns void language plpgsql security definer set search_path = public as $$
declare
  f text := coalesce(nullif(left(regexp_replace(lower(coalesce(p_feature, '')), '[^a-z0-9_-]', '', 'g'), 32), ''), 'unknown');
  s text := coalesce(nullif(left(regexp_replace(lower(coalesce(p_source, '')), '[^a-z0-9_-]', '', 'g'), 32), ''), 'unknown');
begin
  insert into public.feature_interest_daily (feature, source, clicks)
    values (f, s, 1)
    on conflict (feature, source, day)
    do update set clicks = public.feature_interest_daily.clicks + 1;
end $$;
grant execute on function public.record_feature_click(text, text) to anon, authenticated;

-- ============================================================================
-- 5. DOG OF THE DAY — Instagram pipeline (see docs/instagram-pipeline.md)
-- ----------------------------------------------------------------------------
-- Once a day an Edge Function (`daily-post`) publishes the oldest APPROVED
-- post to Instagram, then drafts the next one: the oldest registered dog (by
-- created_at) with a photo that has never been queued. Drafts get an
-- AI-generated caption and sit in post_queue as 'pending' until an admin
-- approves (optionally editing the caption) or rejects on /admin/posts.
-- The website reads recent IG posts from ig_feed_cache (synced by another
-- Edge Function on a schedule) — never from the IG API at page load.
-- ============================================================================

do $$ begin
  create type public.post_status as enum
    ('pending', 'approved', 'rejected', 'published', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.post_queue (
  id            uuid primary key default gen_random_uuid(),
  dog_id        uuid not null references public.dog_profiles(id) on delete cascade,
  caption       text not null,           -- LLM prose + fixed hashtags
  photo_url     text not null,           -- public URL, copied at draft time
  status        public.post_status not null default 'pending',
  ig_media_id   text,                    -- returned by IG after publish
  ig_permalink  text,
  error         text,                    -- populated on 'failed' (retryable)
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id),
  published_at  timestamptz              -- drives the once-a-day guard
);
create index if not exists post_queue_status_idx on public.post_queue (status);
alter table public.post_queue add column if not exists published_at timestamptz;

-- RLS: normal users never touch the queue. Admins (app_admins) review it —
-- read everything, and update caption/status to approve or reject. Inserts and
-- publish-side updates happen in Edge Functions via the service role.
alter table public.post_queue enable row level security;
drop policy if exists "admins read post queue" on public.post_queue;
create policy "admins read post queue" on public.post_queue
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));
drop policy if exists "admins review post queue" on public.post_queue;
create policy "admins review post queue" on public.post_queue
  for update to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

-- Cache of the account's recent IG media, refreshed on a schedule by the
-- sync-ig-feed Edge Function. The website reads this table (public read),
-- so page loads never hit the Instagram API.
create table if not exists public.ig_feed_cache (
  media_id    text primary key,
  permalink   text not null,
  media_url   text,
  caption     text,
  media_type  text,
  posted_at   timestamptz,
  fetched_at  timestamptz not null default now()
);
alter table public.ig_feed_cache enable row level security;
drop policy if exists "ig feed is public" on public.ig_feed_cache;
create policy "ig feed is public" on public.ig_feed_cache
  for select using (true);

-- ---------------------------------------------------------------------------
-- Scheduling (run these AFTER deploying the Edge Functions — see
-- docs/instagram-pipeline.md). Requires the pg_cron + pg_net extensions
-- (Database → Extensions in the dashboard). Replace PROJECT_REF and
-- SERVICE_ROLE_KEY, then uncomment:
--
-- select cron.schedule(
--   'dogedin-daily-post', '0 14 * * *',   -- 14:00 UTC = 9/10am Dunedin
--   $cron$ select net.http_post(
--     url     := 'https://PROJECT_REF.supabase.co/functions/v1/daily-post',
--     headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--     body    := '{}'::jsonb
--   ) $cron$);
--
-- select cron.schedule(
--   'dogedin-sync-ig-feed', '*/30 * * * *',
--   $cron$ select net.http_post(
--     url     := 'https://PROJECT_REF.supabase.co/functions/v1/sync-ig-feed',
--     headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--     body    := '{}'::jsonb
--   ) $cron$);
-- ---------------------------------------------------------------------------

-- ============================================================================
-- 6. DOG SOCIAL — friends & photo feed (v1: no messaging/DMs)
-- ----------------------------------------------------------------------------
-- Dogs (acting through their owner's authenticated session) can friend other
-- dogs and post photos to their own feed. Every photo goes through the
-- `moderate-photo` Edge Function (Claude vision) before it's public — posts
-- sit as 'pending' (visible only to the owner) until approved or rejected. A
-- rejected post's storage object is deleted by that function.
-- ============================================================================

create table if not exists public.dog_friendships (
  id                uuid primary key default gen_random_uuid(),
  requester_dog_id  uuid not null references public.dog_profiles(id) on delete cascade,
  recipient_dog_id  uuid not null references public.dog_profiles(id) on delete cascade,
  status            text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,
  check (requester_dog_id <> recipient_dog_id)
);
create index if not exists dog_friendships_requester_idx on public.dog_friendships (requester_dog_id);
create index if not exists dog_friendships_recipient_idx on public.dog_friendships (recipient_dog_id);

alter table public.dog_friendships enable row level security;

-- A dog's friendships are PRIVATE to the two owners involved — who a dog
-- (and by extension its human) hangs out with is not part of the public
-- profile. An earlier schema version exposed accepted rows to everyone
-- ("accepted friendships are public"); the drop below converges databases
-- created from it. Anonymized analytics keep a data path via
-- friendship_dates() (§ 7) instead of reading the table directly.
drop policy if exists "accepted friendships are public" on public.dog_friendships;

-- Both owners see every friendship row involving one of their dogs — pending
-- requests (to respond to) and accepted rows (their own dog's friends list).
drop policy if exists "owners see their own requests" on public.dog_friendships;
create policy "owners see their own requests" on public.dog_friendships
  for select to authenticated
  using (
    exists (select 1 from public.dog_profiles d where d.id = requester_dog_id and d.user_id = auth.uid())
    or exists (select 1 from public.dog_profiles d where d.id = recipient_dog_id and d.user_id = auth.uid())
  );

-- The private analytics dashboard reads dog_friendships with an admin JWT.
drop policy if exists "admins read friendships" on public.dog_friendships;
create policy "admins read friendships" on public.dog_friendships
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "owners send friend requests" on public.dog_friendships;
create policy "owners send friend requests" on public.dog_friendships
  for insert to authenticated
  with check (exists (select 1 from public.dog_profiles d where d.id = requester_dog_id and d.user_id = auth.uid()));

drop policy if exists "recipient responds to request" on public.dog_friendships;
create policy "recipient responds to request" on public.dog_friendships
  for update to authenticated
  using (exists (select 1 from public.dog_profiles d where d.id = recipient_dog_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.dog_profiles d where d.id = recipient_dog_id and d.user_id = auth.uid()));

-- RLS alone can't compare an UPDATE's new value to its old one, so a
-- recipient-scoped policy can't stop a caller from also rewriting
-- requester_dog_id/recipient_dog_id on the same request (retargeting a
-- friendship at someone who never asked for it). A trigger closes that.
create or replace function public.lock_friendship_participants()
returns trigger language plpgsql as $$
begin
  if new.requester_dog_id <> old.requester_dog_id
     or new.recipient_dog_id <> old.recipient_dog_id then
    raise exception 'Cannot change friendship participants';
  end if;
  return new;
end $$;

drop trigger if exists lock_friendship_participants on public.dog_friendships;
create trigger lock_friendship_participants
  before update on public.dog_friendships
  for each row execute function public.lock_friendship_participants();

drop policy if exists "either owner unfriends" on public.dog_friendships;
create policy "either owner unfriends" on public.dog_friendships
  for delete to authenticated
  using (
    exists (select 1 from public.dog_profiles d where d.id = requester_dog_id and d.user_id = auth.uid())
    or exists (select 1 from public.dog_profiles d where d.id = recipient_dog_id and d.user_id = auth.uid())
  );

do $$ begin
  create type public.post_moderation_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.dog_posts (
  id                 uuid primary key default gen_random_uuid(),
  dog_id             uuid not null references public.dog_profiles(id) on delete cascade,
  photo_path         text not null,
  caption            text check (char_length(caption) <= 300),
  moderation_status  public.post_moderation_status not null default 'pending',
  created_at         timestamptz not null default now()
);
create index if not exists dog_posts_dog_id_idx on public.dog_posts (dog_id);
create index if not exists dog_posts_status_idx on public.dog_posts (moderation_status);

alter table public.dog_posts enable row level security;

drop policy if exists "approved posts are public" on public.dog_posts;
create policy "approved posts are public" on public.dog_posts
  for select using (moderation_status = 'approved');

drop policy if exists "owners see their own posts" on public.dog_posts;
create policy "owners see their own posts" on public.dog_posts
  for select to authenticated
  using (exists (select 1 from public.dog_profiles d where d.id = dog_id and d.user_id = auth.uid()));

-- moderation_status must start 'pending' — a client can't insert a
-- pre-approved post and skip moderate-photo (only the service role, which
-- bypasses RLS, flips status to approved/rejected).
drop policy if exists "owners create posts" on public.dog_posts;
create policy "owners create posts" on public.dog_posts
  for insert to authenticated
  with check (
    exists (select 1 from public.dog_profiles d where d.id = dog_id and d.user_id = auth.uid())
    and moderation_status = 'pending'
  );

drop policy if exists "owners delete own posts" on public.dog_posts;
create policy "owners delete own posts" on public.dog_posts
  for delete to authenticated
  using (exists (select 1 from public.dog_profiles d where d.id = dog_id and d.user_id = auth.uid()));

-- Admins can act on any post too (e.g. pull a reported photo).
drop policy if exists "admins moderate posts" on public.dog_posts;
create policy "admins moderate posts" on public.dog_posts
  for update to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "admins delete posts" on public.dog_posts;
create policy "admins delete posts" on public.dog_posts
  for delete to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

-- Admins can also SEE every post regardless of status. The /admin/photos
-- queue lists pending posts, and Postgres applies SELECT policies to the
-- rows an UPDATE/DELETE reads via its WHERE clause — without this, the two
-- admin policies above couldn't reach anyone else's pending post at all.
drop policy if exists "admins read all posts" on public.dog_posts;
create policy "admins read all posts" on public.dog_posts
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

create table if not exists public.post_likes (
  post_id     uuid not null references public.dog_posts(id) on delete cascade,
  dog_id      uuid not null references public.dog_profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, dog_id)
);
alter table public.post_likes enable row level security;

drop policy if exists "likes are public" on public.post_likes;
create policy "likes are public" on public.post_likes for select using (true);

drop policy if exists "owners like posts" on public.post_likes;
create policy "owners like posts" on public.post_likes
  for insert to authenticated
  with check (
    exists (select 1 from public.dog_profiles d where d.id = dog_id and d.user_id = auth.uid())
    and exists (select 1 from public.dog_posts p where p.id = post_id and p.moderation_status = 'approved')
  );

drop policy if exists "owners unlike posts" on public.post_likes;
create policy "owners unlike posts" on public.post_likes
  for delete to authenticated
  using (exists (select 1 from public.dog_profiles d where d.id = dog_id and d.user_id = auth.uid()));

-- Profile-level paws: a signed-in USER paws a dog's PROFILE (one per user per
-- dog) — separate from post_likes, which paw individual photos and are keyed
-- by acting dog. user_id defaults to auth.uid() so the client only ever sends
-- dog_id. SELECT is limited to the giver's own rows (who pawed whom is never
-- publicly enumerable); the public tally goes through dog_paw_count() below.
create table if not exists public.dog_paws (
  dog_id      uuid not null references public.dog_profiles(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (dog_id, user_id)
);
alter table public.dog_paws enable row level security;

drop policy if exists "users see own paws" on public.dog_paws;
create policy "users see own paws" on public.dog_paws
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users paw dogs" on public.dog_paws;
create policy "users paw dogs" on public.dog_paws
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users unpaw dogs" on public.dog_paws;
create policy "users unpaw dogs" on public.dog_paws
  for delete to authenticated
  using (auth.uid() = user_id);

-- Public per-dog tally without exposing who gave the paws.
create or replace function public.dog_paw_count(p_dog_id uuid)
returns bigint
language sql security definer stable set search_path = public as $$
  select count(*)::bigint from public.dog_paws where dog_id = p_dog_id;
$$;
grant execute on function public.dog_paw_count(uuid) to anon, authenticated;

-- Public pack roster with profile-paw tallies, for the homepage "Meet the
-- pack" carousel and the "Top of the pack" (most-pawed) rail. Reads the
-- privilege-gated public view (never contact data) and left-joins the paw
-- tally so a dog with zero paws still appears. p_sort = 'paws' ranks by paw
-- count (ties broken by recency); anything else ('recent') is newest-first.
-- No giver identity is ever exposed — only aggregate counts, same privacy bar
-- as dog_paw_count(). id is returned so the client can give/remove a paw.
create or replace function public.pack_dogs(p_sort text default 'recent', p_limit int default 12)
returns table (
  id uuid, slug text, dog_name text, breed text, bio text,
  photo_path text, has_contact boolean, paw_count bigint
)
language sql security definer stable set search_path = public as $$
  select
    d.id, d.slug, d.dog_name, d.breed, d.bio, d.photo_path,
    d.lost_contact_opt_in as has_contact,
    coalesce(p.cnt, 0)::bigint as paw_count
  from public.public_dog_profiles d
  left join (
    select dog_id, count(*) as cnt from public.dog_paws group by dog_id
  ) p on p.dog_id = d.id
  order by
    case when p_sort = 'paws' then coalesce(p.cnt, 0) else 0 end desc,
    d.created_at desc
  limit greatest(p_limit, 0);
$$;
grant execute on function public.pack_dogs(text, int) to anon, authenticated;

-- Comments (owner-to-owner communication on posts) were removed from v1 scope
-- — friends + likes only for now. Drops any table from an earlier schema
-- version so re-running this file converges even on a database that already
-- had it.
drop table if exists public.post_comments cascade;

-- Reports feed the admin moderation queue; reporting requires owning a dog
-- (keeps it tied to a real member, not anonymous).
create table if not exists public.post_reports (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid not null references public.dog_posts(id) on delete cascade,
  reporter_dog_id  uuid not null references public.dog_profiles(id) on delete cascade,
  reason           text check (char_length(reason) <= 500),
  created_at       timestamptz not null default now(),
  resolved         boolean not null default false
);
alter table public.post_reports enable row level security;

drop policy if exists "owners report posts" on public.post_reports;
create policy "owners report posts" on public.post_reports
  for insert to authenticated
  with check (exists (select 1 from public.dog_profiles d where d.id = reporter_dog_id and d.user_id = auth.uid()));

drop policy if exists "admins read reports" on public.post_reports;
create policy "admins read reports" on public.post_reports
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "admins resolve reports" on public.post_reports;
create policy "admins resolve reports" on public.post_reports
  for update to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

-- Tighten dog-photos public read now that dog_posts exists (must run after
-- section 2, which created the original bucket-wide policy of the same
-- name — this drop+recreate wins). Profile photos (path: {userId}/{uuid}.ext)
-- stay fully public. Post photos (path: {userId}/posts/{uuid}.ext) are only
-- publicly *listable* once approved — otherwise anyone could enumerate the
-- bucket via the Storage API and pull pending/rejected photos before
-- moderation (or its deletion-on-reject) has run. Direct fetches by a
-- *known* URL still bypass RLS on a public bucket regardless (same as
-- profile photos), but post paths are random UUIDs, so listing was the
-- only practical way to discover one.
drop policy if exists "dog photos are public read" on storage.objects;
create policy "dog photos are public read" on storage.objects
  for select using (
    bucket_id = 'dog-photos'
    and (
      (storage.foldername(name))[2] is distinct from 'posts'
      or exists (
        select 1 from public.dog_posts p
        where p.photo_path = name and p.moderation_status = 'approved'
      )
    )
  );

-- Admins can read pending/rejected post objects through the Storage API too.
-- The /admin/photos queue shows the photo being approved (the public bucket
-- already serves any *known* URL, so viewing works regardless — this makes it
-- explicit), and rejecting from that queue calls storage remove(), which
-- returns the deleted rows — Postgres applies SELECT policies to that, so
-- "admins delete any dog photo" (section 2) can't remove a pending object
-- without this.
drop policy if exists "admins read any dog photo" on storage.objects;
create policy "admins read any dog photo" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dog-photos'
    and exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email'))
  );

-- "Pawpularity contest" leaderboard: total paws (post_likes) across each
-- dog's approved posts. Only ever counts likes on posts that are actually
-- public, so a pending/rejected post's likes (there shouldn't be any, since
-- liking requires an approved post — see "owners like posts" above) can't
-- inflate a dog's count.
create or replace function public.pawpularity_leaderboard(p_limit int default 10)
returns table (slug text, dog_name text, photo_path text, paw_count bigint)
language sql security definer stable set search_path = public as $$
  select d.slug, d.dog_name, d.photo_path, count(pl.*)::bigint as paw_count
  from public.post_likes pl
  join public.dog_posts p on p.id = pl.post_id and p.moderation_status = 'approved'
  join public.dog_profiles d on d.id = p.dog_id
  group by d.id, d.slug, d.dog_name, d.photo_path
  order by paw_count desc, d.dog_name
  limit greatest(p_limit, 0);
$$;
grant execute on function public.pawpularity_leaderboard(int) to anon, authenticated;

-- ============================================================================
-- 7. ANALYTICS HELPERS — anonymized aggregates for the public dashboards
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER functions exposing counts and dates ONLY — no ids, no
-- names, no who-knows-whom — so the public analytics dashboard and the media
-- kit keep a data path after the friendship privacy lockdown in § 6. The
-- function names and column names below are contracts with those repos —
-- do not rename them.
-- ============================================================================

-- created_at of ACCEPTED friendships, nothing else. Feeds the public
-- dashboard's friendship counts/trends now that dog_friendships rows are
-- readable only by the owners involved (and admins).
create or replace function public.friendship_dates()
returns table (created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select f.created_at
  from public.dog_friendships f
  where f.status = 'accepted';
$$;
grant execute on function public.friendship_dates() to anon, authenticated;

-- Last 12 ISO weeks (Monday-start, oldest first, current week included) of
-- new dog profiles, newly created APPROVED posts, and new paws (post_likes).
-- Weeks with no activity still appear, as zero rows.
create or replace function public.media_kit_weekly()
returns table (week_start date, new_dogs bigint, new_posts bigint, new_paws bigint)
language sql security definer stable set search_path = public as $$
  with weeks as (
    select gs::date as week_start
    from generate_series(
      date_trunc('week', now()) - interval '11 weeks',
      date_trunc('week', now()),
      interval '1 week'
    ) as gs
  ),
  dogs as (
    select date_trunc('week', created_at)::date as wk, count(*)::bigint as n
    from public.dog_profiles group by 1
  ),
  posts as (
    select date_trunc('week', created_at)::date as wk, count(*)::bigint as n
    from public.dog_posts where moderation_status = 'approved' group by 1
  ),
  paws as (
    select date_trunc('week', created_at)::date as wk, count(*)::bigint as n
    from public.post_likes group by 1
  )
  select
    w.week_start,
    coalesce(dogs.n, 0)  as new_dogs,
    coalesce(posts.n, 0) as new_posts,
    coalesce(paws.n, 0)  as new_paws
  from weeks w
  left join dogs  on dogs.wk  = w.week_start
  left join posts on posts.wk = w.week_start
  left join paws  on paws.wk  = w.week_start
  order by w.week_start;
$$;
grant execute on function public.media_kit_weekly() to anon, authenticated;

-- One-call snapshot for the media kit's headline numbers: community-scale
-- totals plus per-slot ad delivery for the last 30 days. Counts and slot
-- totals ONLY — no advertiser identities, no per-campaign numbers, no member
-- or revenue data. The key names are a contract with the media-kit repo's
-- lib/stats.ts — do not rename them. avg_rating is null (not 0) when there
-- are no reviews, and slots is [] when ad_stats_daily has no rows in the
-- window; ctr_30d is a percentage rounded to 2 decimals, 0 when a slot had
-- no impressions.
create or replace function public.media_kit_stats()
returns jsonb
language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'dogs_total',          (select count(*) from public.dog_profiles),
    'dogs_new_90d',        (select count(*) from public.dog_profiles
                            where created_at >= now() - interval '90 days'),
    'posts_30d',           (select count(*) from public.dog_posts
                            where moderation_status = 'approved'
                              and created_at >= now() - interval '30 days'),
    'paws_30d',            (select count(*) from public.post_likes
                            where created_at >= now() - interval '30 days'),
    'friendships_total',   (select count(*) from public.dog_friendships
                            where status = 'accepted'),
    'businesses_approved', (select count(*) from public.businesses
                            where status = 'approved'),
    'reviews_total',       (select count(*) from public.reviews),
    'avg_rating',          (select round(avg(rating)::numeric, 2) from public.reviews),
    'slots', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'slot',            s.slot,
                'impressions_30d', s.impressions_30d,
                'clicks_30d',      s.clicks_30d,
                'ctr_30d',         case when s.impressions_30d > 0
                                     then round(100.0 * s.clicks_30d / s.impressions_30d, 2)
                                     else 0 end
              ) order by s.impressions_30d desc, s.slot)
       from (
         select slot,
                sum(impressions)::bigint as impressions_30d,
                sum(clicks)::bigint      as clicks_30d
         from public.ad_stats_daily
         where day > current_date - 30
         group by slot
       ) s),
      '[]'::jsonb)
  );
$$;
grant execute on function public.media_kit_stats() to anon, authenticated;

-- ============================================================================
-- 8. BUSINESS INSIGHTS — engagement counters + the paid owner portal
-- ----------------------------------------------------------------------------
-- Per-business engagement is counted into business_stats_daily (same shape as
-- ad_stats_daily) by the public site, and sold back to each business as a
-- monthly "Business Insights" subscription, viewed in the business portal on
-- the media-kit site. Privacy stance: these are content-engagement counters on
-- the business's OWN public listing (never visitor identity), each business
-- sees only its own numbers plus category-level aggregates, and community
-- member data is never exposed here.
-- ============================================================================

-- stat is a fixed vocabulary enforced by record_business_stat below:
--   view         — a visitor opened the listing (expanded card / permalink page)
--   website      — tapped the website link
--   phone        — tapped the phone number
--   directions   — tapped a maps link
--   offer_unlock — unlocked the business's thank-you offer by leaving a review
create table if not exists public.business_stats_daily (
  business_id uuid not null references public.businesses(id) on delete cascade,
  stat        text not null,
  day         date not null default current_date,
  count       bigint not null default 0,
  primary key (business_id, stat, day)
);
alter table public.business_stats_daily enable row level security;
-- Date-range rollups ("this business, last 30 days") scan by day; the composite
-- PK (business_id, stat, day) can't serve a day-only range on its own.
create index if not exists business_stats_daily_day_idx on public.business_stats_daily(day);

drop policy if exists "admins read business stats" on public.business_stats_daily;
create policy "admins read business stats" on public.business_stats_daily
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));
-- Owners read via business_insights() below (SECURITY DEFINER), never directly,
-- so one business can never browse another's counters.

-- Counter bump, callable by anon from the public site. Whitelisted stat names
-- and approved businesses only, so junk rows can't be minted.
create or replace function public.record_business_stat(p_business_id uuid, p_stat text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_stat not in ('view', 'website', 'phone', 'directions', 'offer_unlock') then
    return;
  end if;
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.status = 'approved'
  ) then
    return;
  end if;
  insert into public.business_stats_daily (business_id, stat, count)
    values (p_business_id, p_stat, 1)
    on conflict (business_id, stat, day)
    do update set count = public.business_stats_daily.count + 1;
end $$;
grant execute on function public.record_business_stat(uuid, text) to anon, authenticated;

-- One paid insights subscription per business. Rows are written ONLY by the
-- Stripe webhook / checkout-return confirm via the service role (RLS bypass);
-- the browser never writes status.
create table if not exists public.business_insights_subs (
  business_id             uuid primary key references public.businesses(id) on delete cascade,
  status                  text not null default 'inactive',  -- active|past_due|canceled|inactive
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
alter table public.business_insights_subs enable row level security;

drop policy if exists "admins read insights subs" on public.business_insights_subs;
create policy "admins read insights subs" on public.business_insights_subs
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

-- Team seats: a premium (subscribed) business gets up to 5 logins — the
-- owner_email plus up to 4 members added by invite code. Members see the same
-- portal data as the owner; only the owner manages the team. Both tables are
-- written exclusively through the SECURITY DEFINER RPCs below (RLS allows
-- admin reads only), so seat caps and ownership checks can't be bypassed.
create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  email       text not null,
  added_at    timestamptz not null default now(),
  primary key (business_id, email)
);
alter table public.business_members enable row level security;
drop policy if exists "admins read business members" on public.business_members;
create policy "admins read business members" on public.business_members
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

create table if not exists public.business_invite_codes (
  code         text primary key,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  created_at   timestamptz not null default now(),
  redeemed_by  text,
  redeemed_at  timestamptz
);
alter table public.business_invite_codes enable row level security;
drop policy if exists "admins read invite codes" on public.business_invite_codes;
create policy "admins read invite codes" on public.business_invite_codes
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

-- True when p_email is the listing's owner_email or a redeemed team member.
create or replace function public.is_business_user(p_business_id uuid, p_email text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.status = 'approved'
      and lower(coalesce(b.owner_email, '')) = lower(p_email)
  ) or exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.email = lower(p_email)
  );
$$;

-- Owner-only, premium-only: mint one invite code (5 seats total incl. the
-- owner, so at most 4 members + outstanding codes). Returns the code, or null
-- when the caller may not mint one (not owner, no active sub, or cap reached).
create or replace function public.generate_business_invite(p_business_id uuid)
returns text language plpgsql security definer as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_code  text;
  v_used  int;
begin
  if v_email = '' then return null; end if;
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.status = 'approved'
      and lower(coalesce(b.owner_email, '')) = v_email
  ) then return null; end if;
  if not exists (
    select 1 from public.business_insights_subs s
    where s.business_id = p_business_id and s.status = 'active'
  ) then return null; end if;

  select (select count(*) from public.business_members m where m.business_id = p_business_id)
       + (select count(*) from public.business_invite_codes c
          where c.business_id = p_business_id and c.redeemed_at is null)
    into v_used;
  if v_used >= 4 then return null; end if;

  v_code := 'PACK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.business_invite_codes (code, business_id) values (v_code, p_business_id);
  return v_code;
end $$;
grant execute on function public.generate_business_invite(uuid) to authenticated;

-- Any signed-in account can redeem a code once; their email becomes a team
-- member of that code's business. Returns the business id on success.
create or replace function public.redeem_business_invite(p_code text)
returns uuid language plpgsql security definer as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_biz   uuid;
begin
  if v_email = '' then return null; end if;
  update public.business_invite_codes
     set redeemed_by = v_email, redeemed_at = now()
   where code = upper(btrim(p_code)) and redeemed_at is null
   returning business_id into v_biz;
  if v_biz is null then return null; end if;
  insert into public.business_members (business_id, email)
    values (v_biz, v_email)
    on conflict (business_id, email) do nothing;
  return v_biz;
end $$;
grant execute on function public.redeem_business_invite(text) to authenticated;

-- Owner-only team view: current members + outstanding/redeemed codes, plus the
-- seat math the portal shows ("3 of 5 seats used").
create or replace function public.business_team(p_business_id uuid)
returns jsonb language plpgsql security definer stable as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email = '' then return null; end if;
  if not (
    exists (select 1 from public.businesses b
            where b.id = p_business_id and b.status = 'approved'
              and lower(coalesce(b.owner_email, '')) = v_email)
    or exists (select 1 from public.app_admins a where lower(a.email) = v_email)
  ) then return null; end if;

  return jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('email', m.email, 'added_at', m.added_at) order by m.added_at)
      from public.business_members m where m.business_id = p_business_id
    ), '[]'::jsonb),
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object('code', c.code, 'redeemed', c.redeemed_at is not null) order by c.created_at)
      from public.business_invite_codes c where c.business_id = p_business_id
    ), '[]'::jsonb),
    'seats_total', 5,
    'seats_used', 1 + (select count(*) from public.business_members m where m.business_id = p_business_id)
  );
end $$;
grant execute on function public.business_team(uuid) to authenticated;

-- The businesses the signed-in caller may see in the portal: listings where
-- they are the owner (owner_email) or a redeemed team member. Owners also see
-- their own PENDING submission (the welcome email links here immediately, so
-- the portal must have something to show pre-approval); members and admins see
-- approved listings only. status is returned so the portal can render the
-- "under review" state. Dropped first: the return signature has changed, and
-- CREATE OR REPLACE can't change a function's OUT columns.
drop function if exists public.my_portal_businesses();
create function public.my_portal_businesses()
returns table (
  id uuid, slug text, name text, category text, neighborhood text,
  status text, insights_active boolean, is_owner boolean, is_admin boolean
)
language sql security definer stable set search_path = public as $$
  with me as (
    select lower(coalesce(auth.jwt() ->> 'email', '')) as email
  ), adm as (
    select exists (
      select 1 from public.app_admins a, me where lower(a.email) = me.email and me.email <> ''
    ) as is_admin
  )
  select b.id, b.slug, b.name, b.category, b.neighborhood,
         b.status::text,
         (coalesce(s.status, '') = 'active') as insights_active,
         (me.email <> '' and lower(coalesce(b.owner_email, '')) = me.email) as is_owner,
         adm.is_admin
  from public.businesses b
  cross join me
  cross join adm
  left join public.business_insights_subs s on s.business_id = b.id
  where
    (adm.is_admin and b.status = 'approved')
    or (
      me.email <> '' and lower(coalesce(b.owner_email, '')) = me.email
      and b.status in ('pending', 'approved')
    )
    or (
      b.status = 'approved'
      and exists (select 1 from public.business_members m
                  where m.business_id = b.id and m.email = me.email)
    )
  order by b.name;
$$;
grant execute on function public.my_portal_businesses() to authenticated;

-- Insights payload for one business, TIERED. Access requires being an admin,
-- the listing's owner_email, or a redeemed team member — anyone else gets
-- null. The tier then decides the payload:
--   free  — owner/member without an active subscription: the vanity layer only
--           (30-day views + review count/avg). Enough to prove counting is
--           real; the lead metrics stay locked behind the upgrade.
--   active / admin_preview — the full payload: per-stat totals, daily series,
--           lifetime, and the category benchmark (avg, rank).
-- Aggregate counters + review benchmark only — never visitor-level data.
create or replace function public.business_insights(p_business_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  v_email  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_admin  boolean := false;
  v_rel    boolean := false;
  v_active boolean := false;
  v_category text;
begin
  if v_email = '' then return null; end if;

  select exists (select 1 from public.app_admins a where lower(a.email) = v_email)
    into v_admin;
  v_rel := public.is_business_user(p_business_id, v_email);
  select coalesce(s.status, '') = 'active'
    into v_active
    from public.business_insights_subs s where s.business_id = p_business_id;
  v_active := coalesce(v_active, false);

  if not (v_admin or v_rel) then return null; end if;

  select category into v_category from public.businesses where id = p_business_id;

  -- Free tier: connected to the business, no active subscription.
  if not (v_admin or v_active) then
    return jsonb_build_object(
      'business', (
        select jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'category', b.category)
        from public.businesses b where b.id = p_business_id
      ),
      'access', 'free',
      'views_30d', (
        select coalesce(sum(count), 0)::bigint from public.business_stats_daily
        where business_id = p_business_id and stat = 'view' and day >= current_date - 29
      ),
      'reviews', jsonb_build_object(
        'count', (select count(*) from public.reviews r where r.business_id = p_business_id),
        'avg', (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.business_id = p_business_id),
        'recent_90d', (
          select count(*) from public.reviews r
          where r.business_id = p_business_id and r.created_at >= now() - interval '90 days'
        ),
        'category', v_category
      )
    );
  end if;

  return jsonb_build_object(
    'business', (
      select jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'category', b.category)
      from public.businesses b where b.id = p_business_id
    ),
    'access', case when v_active then 'active' else 'admin_preview' end,
    'totals_30d', (
      select coalesce(jsonb_object_agg(t.stat, t.n), '{}'::jsonb)
      from (
        select stat, sum(count)::bigint as n
        from public.business_stats_daily
        where business_id = p_business_id and day >= current_date - 29
        group by stat
      ) t
    ),
    'totals_lifetime', (
      select coalesce(jsonb_object_agg(t.stat, t.n), '{}'::jsonb)
      from (
        select stat, sum(count)::bigint as n
        from public.business_stats_daily
        where business_id = p_business_id
        group by stat
      ) t
    ),
    'daily_30d', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day',          to_char(gs.d, 'YYYY-MM-DD'),
               'view',         coalesce(s.n_view, 0),
               'website',      coalesce(s.n_website, 0),
               'phone',        coalesce(s.n_phone, 0),
               'directions',   coalesce(s.n_directions, 0),
               'offer_unlock', coalesce(s.n_offer, 0)
             ) order by gs.d), '[]'::jsonb)
      from generate_series(current_date - 29, current_date, '1 day'::interval) gs(d)
      left join (
        select day,
               sum(count) filter (where stat = 'view')         as n_view,
               sum(count) filter (where stat = 'website')      as n_website,
               sum(count) filter (where stat = 'phone')        as n_phone,
               sum(count) filter (where stat = 'directions')   as n_directions,
               sum(count) filter (where stat = 'offer_unlock') as n_offer
        from public.business_stats_daily
        where business_id = p_business_id and day >= current_date - 29
        group by day
      ) s on s.day = gs.d::date
    ),
    'reviews', jsonb_build_object(
      'count', (select count(*) from public.reviews r where r.business_id = p_business_id),
      'avg', (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.business_id = p_business_id),
      'recent_90d', (
        select count(*) from public.reviews r
        where r.business_id = p_business_id and r.created_at >= now() - interval '90 days'
      ),
      'category', v_category,
      'category_avg', (
        select round(avg(r.rating)::numeric, 2)
        from public.reviews r
        join public.businesses b2 on b2.id = r.business_id
        where b2.status = 'approved' and b2.category = v_category
      ),
      'category_businesses', (
        select count(*) from public.businesses b3
        where b3.status = 'approved' and b3.category = v_category
      ),
      'rank_in_category', (
        select x.rnk from (
          select b4.id, rank() over (order by avg(r.rating) desc, count(r.*) desc) as rnk
          from public.businesses b4
          join public.reviews r on r.business_id = b4.id
          where b4.status = 'approved' and b4.category = v_category
          group by b4.id
        ) x where x.id = p_business_id
      )
    )
  );
end $$;
grant execute on function public.business_insights(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. BUSINESS CLAIMS — "claim this business" lead capture + verification
-- ---------------------------------------------------------------------------
-- A rep claims their guide listing with contact info (no account needed); an
-- admin verifies by phone / in person and links the listing to their email
-- (businesses.owner_email) so they get portal access. Anyone may insert (forced
-- to 'new'); only admins read/manage. Standalone copy: supabase/business_claims.sql.
create table if not exists public.business_claims (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references public.businesses(id) on delete set null,
  business_name text not null check (char_length(business_name) between 1 and 120),
  contact_name  text not null check (char_length(contact_name) between 1 and 80),
  email         text not null check (char_length(email) between 3 and 120),
  phone         text not null check (char_length(phone) between 3 and 40),
  role          text check (char_length(role) <= 80),
  message       text check (char_length(message) <= 2000),
  status        text not null default 'new',
  created_at    timestamptz not null default now(),
  contacted_at  timestamptz,
  verified_at   timestamptz
);
create index if not exists business_claims_status_idx
  on public.business_claims(status, created_at desc);
alter table public.business_claims enable row level security;

drop policy if exists "anyone can submit a claim" on public.business_claims;
create policy "anyone can submit a claim" on public.business_claims
  for insert to anon, authenticated
  with check (status = 'new');

drop policy if exists "admins read claims" on public.business_claims;
create policy "admins read claims" on public.business_claims
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "admins manage claims" on public.business_claims;
create policy "admins manage claims" on public.business_claims
  for all to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));
