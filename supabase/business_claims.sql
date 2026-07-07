-- ============================================================================
-- Business claims — run this once in the Supabase SQL editor.
-- ============================================================================
-- A business rep clicks "Claim this business" on their guide listing and
-- leaves contact info. Low-friction lead capture (no account needed): an admin
-- verifies by phone / in person, then links the listing to their email
-- (businesses.owner_email) so the claimant gets business-portal access —
-- insights + the pitch to buy an ad spot.
--
-- Trust model mirrors ad_inquiries: anyone may insert (forced to 'new'); only
-- admins read and manage. Idempotent — safe to re-run.

create table if not exists public.business_claims (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references public.businesses(id) on delete set null,
  business_name text not null check (char_length(business_name) between 1 and 120),
  contact_name  text not null check (char_length(contact_name) between 1 and 80),
  email         text not null check (char_length(email) between 3 and 120),
  phone         text not null check (char_length(phone) between 3 and 40),
  role          text check (char_length(role) <= 80),
  message       text check (char_length(message) <= 2000),
  status        text not null default 'new',   -- new / contacted / verified / rejected
  created_at    timestamptz not null default now(),
  contacted_at  timestamptz,
  verified_at   timestamptz
);
create index if not exists business_claims_status_idx
  on public.business_claims(status, created_at desc);

alter table public.business_claims enable row level security;

-- Anyone may submit a claim, but only ever as 'new' (RLS, not just the form).
drop policy if exists "anyone can submit a claim" on public.business_claims;
create policy "anyone can submit a claim" on public.business_claims
  for insert to anon, authenticated
  with check (status = 'new');

-- Admins read the running list and manage status (contacted / verified /
-- rejected). Linking the listing to the claimant's email on verification is a
-- normal update to public.businesses, already covered by "admins manage
-- businesses".
drop policy if exists "admins read claims" on public.business_claims;
create policy "admins read claims" on public.business_claims
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));

drop policy if exists "admins manage claims" on public.business_claims;
create policy "admins manage claims" on public.business_claims
  for all to authenticated
  using (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where a.email = (auth.jwt() ->> 'email')));
