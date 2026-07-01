-- Schema for the "Things to do in Dunedin" feature (app/things-to-do).
-- Run this in the Supabase SQL editor once NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
-- are set. Until then the app reads from lib/demoBusinesses.ts and interactions
-- run in read-only "preview" mode (see lib/businesses.ts#persistenceEnabled).

-- Curated local businesses shown as cards.
create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  category      text not null,
  neighborhood  text,
  description   text,
  image         text,             -- self-hosted path, e.g. /assets/spots/foo.svg
  dog_friendly  boolean not null default true,
  place_id      text,             -- future: real-world place / partner id
  offer         jsonb,            -- { label, detail, code } partner discount
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Customer reviews of a business. `upvotes` is a denormalised counter bumped by
-- the increment_review_upvotes() RPC below.
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

-- Threaded replies to a review (single level).
create table if not exists public.review_replies (
  id            uuid primary key default gen_random_uuid(),
  review_id     uuid not null references public.reviews(id) on delete cascade,
  author        text not null,
  body          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists review_replies_review_id_idx on public.review_replies(review_id);

-- Atomic upvote: increment and return the new count in one round-trip.
create or replace function public.increment_review_upvotes(p_review_id uuid)
returns int
language sql
as $$
  update public.reviews
     set upvotes = upvotes + 1
   where id = p_review_id
  returning upvotes;
$$;

-- Row Level Security: anyone may read; anyone may add reviews/replies and
-- upvote. Tighten (e.g. require auth, rate-limit) before real launch.
alter table public.businesses      enable row level security;
alter table public.reviews         enable row level security;
alter table public.review_replies  enable row level security;

create policy "businesses are public"       on public.businesses     for select using (true);
create policy "reviews are public"           on public.reviews        for select using (true);
create policy "reviews are insertable"       on public.reviews        for insert with check (true);
create policy "reviews are upvotable"        on public.reviews        for update using (true) with check (true);
create policy "replies are public"           on public.review_replies for select using (true);
create policy "replies are insertable"       on public.review_replies for insert with check (true);
