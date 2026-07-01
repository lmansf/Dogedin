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

-- ============================================================================
-- 1. THINGS TO DO — local business reviews
-- ============================================================================
create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  category      text not null,
  neighborhood  text,
  description   text,
  image         text,            -- self-hosted path, e.g. /assets/spots/foo.svg
  dog_friendly  boolean not null default true,
  place_id      text,            -- future: real-world place / partner id
  offer         jsonb,           -- { label, detail, code } partner discount
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

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

drop policy if exists "businesses are public"  on public.businesses;
create policy "businesses are public"  on public.businesses     for select using (true);
drop policy if exists "reviews are public"      on public.reviews;
create policy "reviews are public"      on public.reviews        for select using (true);
drop policy if exists "reviews are insertable"  on public.reviews;
create policy "reviews are insertable"  on public.reviews        for insert with check (true);
drop policy if exists "replies are public"      on public.review_replies;
create policy "replies are public"      on public.review_replies for select using (true);
drop policy if exists "replies are insertable"  on public.review_replies;
create policy "replies are insertable"  on public.review_replies for insert with check (true);

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
  photo_path           text,
  lost_contact_opt_in  boolean not null default false,
  created_at           timestamptz not null default now()
);
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
create or replace view public.public_dog_profiles
with (security_invoker = false) as
  select
    id, slug, dog_name, breed, photo_path, lost_contact_opt_in,
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

-- Storage bucket for dog photos.
insert into storage.buckets (id, name, public)
  values ('dog-photos', 'dog-photos', true) on conflict (id) do nothing;
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

-- ============================================================================
-- 3. ADVERTISERS — local business ads with rotation + tracking
-- ============================================================================
-- Emails allowed to manage advertisers (and other admin surfaces). Seed your
-- own address here (or in the dashboard) so you can use /admin/ads.
create table if not exists public.app_admins (
  email       text primary key,
  created_at  timestamptz not null default now()
);
-- Example: insert into public.app_admins (email) values ('you@example.com');

create table if not exists public.advertisers (
  id             uuid primary key default gen_random_uuid(),
  business_name  text not null,
  image_url      text not null,   -- /assets/ads/foo.svg (self-hosted) or external
  link_url       text not null,
  weight         int  not null default 1 check (weight between 0 and 100),
  active         boolean not null default true,
  impressions    bigint not null default 0,
  clicks         bigint not null default 0,
  created_at     timestamptz not null default now()
);

alter table public.advertisers enable row level security;
alter table public.app_admins  enable row level security;

-- The public reads ads through the public_ads view below (display columns
-- only), NOT the base table — so impressions/clicks stay admin-only. There is
-- deliberately no anon/public SELECT policy on the base advertisers table.

-- Admins (see app_admins) get full control of advertisers.
drop policy if exists "admins manage ads" on public.advertisers;
create policy "admins manage ads" on public.advertisers
  for all to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "admins read admin list" on public.app_admins;
create policy "admins read admin list" on public.app_admins
  for select to authenticated
  using (email = (auth.jwt() ->> 'email'));

-- Public read surface for ads: active rows, display columns only (no counters).
-- Definer view bypasses the base-table RLS; AdSlot reads this.
create or replace view public.public_ads
with (security_invoker = false) as
  select id, business_name, image_url, link_url, weight
  from public.advertisers
  where active = true;
grant select on public.public_ads to anon, authenticated;

-- Counters bumped by SECURITY DEFINER functions so anon never updates the table.
create or replace function public.increment_ad_impression(p_ad_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.advertisers set impressions = impressions + 1 where id = p_ad_id;
$$;
grant execute on function public.increment_ad_impression(uuid) to anon, authenticated;

create or replace function public.increment_ad_click(p_ad_id uuid)
returns text language sql security definer set search_path = public as $$
  update public.advertisers set clicks = clicks + 1 where id = p_ad_id
  returning link_url;
$$;
grant execute on function public.increment_ad_click(uuid) to anon, authenticated;

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

alter table public.members enable row level security;
-- A member may read their OWN row. All writes happen server-side in the Stripe
-- webhook via the service-role key (bypasses RLS) — never from the browser.
drop policy if exists "members read own row" on public.members;
create policy "members read own row" on public.members
  for select to authenticated using (auth.uid() = user_id);
