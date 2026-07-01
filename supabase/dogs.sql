-- Schema for Phase 1: Dog Profiles / Registration (app/register, /dog/[slug],
-- /dogs, /account). Run in the Supabase SQL editor once the project's
-- NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are set.
--
-- Design notes:
--  * Profiles are owned by an authenticated user (user_id -> auth.users). RLS
--    lets an owner read/write ONLY their own rows. The anon role cannot read
--    this table at all.
--  * Public access (the /dog/{slug} page and the /dogs search) goes through a
--    privilege-gated view + a search function, NOT the base table, so contact
--    details and owner names can't be scraped with the public anon key:
--      - public_dog_profiles: exposes dog_name/breed/photo always, but
--        owner_phone/owner_email ONLY when lost_contact_opt_in = true. Owner
--        name is never exposed.
--      - search_dogs(q): matches on dog name OR owner name, but returns only
--        the public columns (so you can find "Rex" or search your own name
--        without owner names leaking into results).

create extension if not exists pgcrypto;

create table if not exists public.dog_profiles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  slug                 text unique not null,
  owner_name           text not null check (char_length(owner_name) between 1 and 80),
  owner_phone          text not null check (char_length(owner_phone) between 3 and 40),
  owner_email          text not null check (char_length(owner_email) between 3 and 120),
  dog_name             text not null check (char_length(dog_name) between 1 and 60),
  breed                text check (char_length(breed) <= 60),
  photo_path           text,        -- object path in the "dog-photos" storage bucket
  lost_contact_opt_in  boolean not null default false,
  created_at           timestamptz not null default now()
);

create index if not exists dog_profiles_user_id_idx    on public.dog_profiles (user_id);
create index if not exists dog_profiles_dog_name_idx   on public.dog_profiles (lower(dog_name));
create index if not exists dog_profiles_owner_name_idx on public.dog_profiles (lower(owner_name));

-- RLS: owners manage their own dogs; nobody reads the raw table anonymously.
alter table public.dog_profiles enable row level security;

drop policy if exists "owners manage own dogs" on public.dog_profiles;
create policy "owners manage own dogs" on public.dog_profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public, privilege-gated view. security_invoker = false (definer) so it runs
-- with the view owner's rights and bypasses the base-table RLS, exposing only
-- the safe columns. Contact is nulled out unless the owner opted in.
create or replace view public.public_dog_profiles
with (security_invoker = false) as
  select
    id,
    slug,
    dog_name,
    breed,
    photo_path,
    lost_contact_opt_in,
    case when lost_contact_opt_in then owner_phone end as owner_phone,
    case when lost_contact_opt_in then owner_email end as owner_email
  from public.dog_profiles;

grant select on public.public_dog_profiles to anon, authenticated;

-- Search by dog OR owner name, returning only public columns (owner name is
-- searchable but never returned). SECURITY DEFINER so it can read the base
-- table under RLS.
create or replace function public.search_dogs(q text)
returns table (
  slug text,
  dog_name text,
  breed text,
  photo_path text,
  has_contact boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select d.slug, d.dog_name, d.breed, d.photo_path, d.lost_contact_opt_in
  from public.dog_profiles d
  where length(btrim(q)) >= 2
    and (d.dog_name ilike '%' || btrim(q) || '%'
      or d.owner_name ilike '%' || btrim(q) || '%')
  order by d.dog_name
  limit 50;
$$;

grant execute on function public.search_dogs(text) to anon, authenticated;

-- Storage bucket for dog photos: public read (photos aren't sensitive), and an
-- authenticated user may upload only into their own "{uid}/..." folder.
insert into storage.buckets (id, name, public)
  values ('dog-photos', 'dog-photos', true)
  on conflict (id) do nothing;

drop policy if exists "dog photos are public read" on storage.objects;
create policy "dog photos are public read" on storage.objects
  for select using (bucket_id = 'dog-photos');

drop policy if exists "owners upload own dog photos" on storage.objects;
create policy "owners upload own dog photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dog-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owners delete own dog photos" on storage.objects;
create policy "owners delete own dog photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'dog-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
