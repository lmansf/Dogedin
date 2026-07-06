-- ============================================================================
-- Dogedin — CLEAN SLATE RESET
-- Wipes all community DATA; keeps schema, policies, functions, and the
-- app_admins allow-list intact. Run in: Supabase Dashboard → SQL Editor.
-- ⚠️ IRREVERSIBLE. Take a backup first if in doubt
--    (Dashboard → Database → Backups, or `supabase db dump`).
--
-- Clears: dog profiles/posts/paws/friendships/reports, the Instagram post
-- queue + feed cache, businesses + reviews + replies, Business Insights
-- counters/subscriptions/seats/invites, advertisers + ad stats + inquiries,
-- membership rows, feature-interest counters, all non-admin auth accounts,
-- and every uploaded photo/creative.
--
-- Keeps: the entire schema (tables, RLS, functions, buckets) and app_admins.
-- By default the admin login accounts themselves are kept too.
--
-- After a wipe, run supabase/seed.sql if you want the starter guide spots
-- back instead of an empty guide.
--
-- Storage note: deleting storage.objects rows makes files inaccessible
-- immediately; for byte-level cleanup also use the dashboard's per-bucket
-- "empty bucket" (Storage → bucket → select all → delete).
-- ============================================================================
begin;

-- 1) All community / business / ads / analytics data.
--    Conditional per-table so this runs cleanly whether or not the newest
--    Business-Insights tables exist in your database yet. CASCADE clears any
--    dependents that FK into these.
do $$
declare t text;
begin
  foreach t in array array[
    -- dogs & social
    'post_reports', 'post_likes', 'dog_paws', 'dog_friendships',
    'post_queue', 'dog_posts', 'dog_profiles',
    -- local guide
    'review_replies', 'reviews', 'businesses',
    -- business insights (newer tables)
    'business_stats_daily', 'business_insights_subs',
    'business_members', 'business_invite_codes',
    -- ads
    'ad_stats_daily', 'advertisers', 'ad_inquiries',
    -- membership & misc counters/caches
    'members', 'feature_interest_daily', 'ig_feed_cache'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('truncate table public.%I restart identity cascade', t);
    end if;
  end loop;
end $$;

-- 2) User accounts. Default: delete everyone EXCEPT the admin allow-list
--    (you keep your login; admin rights are matched by email anyway).
delete from auth.users
where email is null
   or lower(email) not in (select lower(email) from public.app_admins);

-- To wipe ABSOLUTELY EVERYONE including your own admin logins (you'd just
-- sign up again with the same email), use this instead of the above:
-- delete from auth.users;

-- 3) Uploaded files: dog photos, business photos, ad creatives.
delete from storage.objects
where bucket_id in ('dog-photos', 'business-photos', 'ad-creatives');

commit;

-- ============================================================================
-- VERIFY — everything below should be 0 (or your admin count for users)
-- ============================================================================
select 'dog_profiles'  as t, count(*) from public.dog_profiles      union all
select 'dog_posts',          count(*) from public.dog_posts          union all
select 'businesses',         count(*) from public.businesses         union all
select 'reviews',            count(*) from public.reviews            union all
select 'advertisers',        count(*) from public.advertisers        union all
select 'ad_inquiries',       count(*) from public.ad_inquiries       union all
select 'members',            count(*) from public.members            union all
select 'auth users',         count(*) from auth.users                union all
select 'storage objects',    count(*) from storage.objects
  where bucket_id in ('dog-photos','business-photos','ad-creatives');
