-- ============================================================================
-- Dogedin — starter data (run AFTER schema.sql, safe to re-run)
-- ----------------------------------------------------------------------------
-- 1. Seeds the "Things to do" board with the four launch spots (mirrors
--    lib/demoBusinesses.ts) so reviews/upvotes/replies work against real rows
--    the moment Supabase is connected. Without this, the page shows the demo
--    fallback but review submissions fail (demo ids aren't table rows).
-- 2. Seeds each spot's starter reviews/replies ONLY if that spot has none yet,
--    so re-running never duplicates and real community reviews are never
--    disturbed.
-- 3. Admin access: uncomment the last line with your email to use /admin/ads.
-- ============================================================================

insert into public.businesses
  (slug, name, category, neighborhood, description, image, dog_friendly, place_id, offer)
values
  ('dunedin-brewery', 'Dunedin Brewery', 'Brewery', 'Downtown Dunedin',
   'Florida''s oldest craft brewery, with a shaded patio where good dogs are as welcome as the beer.',
   '/assets/spots/dunedin-brewery.svg', true, 'demo-place-dunedin-brewery',
   '{"label": "$1 off pints", "detail": "Show this review at the bar", "code": "DOGEDIN"}'::jsonb),
  ('honeymoon-island-dog-beach', 'Honeymoon Island Dog Beach', 'Beach', 'Honeymoon Island',
   'A dedicated off-leash stretch of Gulf shoreline. Shallow, calm water perfect for first-time swimmers.',
   '/assets/spots/honeymoon-island.svg', true, null, null),
  ('kellys-chic-a-boom', 'Kelly''s Chic-a-Boom Room', 'Restaurant', 'Downtown Dunedin',
   'Brunch institution with a leafy dog-friendly patio and a pup menu that''s arguably better than the human one.',
   '/assets/spots/kellys.svg', true, 'demo-place-kellys',
   '{"label": "Free pup-cup", "detail": "With any entrée — mention Dogedin", "code": null}'::jsonb),
  ('hammock-park', 'Hammock Park', 'Park', 'Dunedin',
   'Quiet boardwalk trails through oak hammock and wetlands. Shady, flat, and blissfully uncrowded on weekdays.',
   '/assets/spots/hammock-park.svg', true, null, null)
on conflict (slug) do nothing;

-- Starter reviews (+ replies), only where a spot has no reviews at all yet.
with seeds(slug, author, rating, body, upvotes) as (
  values
    ('dunedin-brewery', 'Angus''s human', 5,
     'Water bowls at every table and the bartenders keep treats behind the bar. Angus asks to go back daily.', 12),
    ('dunedin-brewery', 'Callum P.', 4,
     'Great tartan-ish vibe and live music on weekends. Patio gets busy but the pups don''t mind.', 3),
    ('honeymoon-island-dog-beach', 'Biscuit''s dad', 5,
     'The best. Biscuit met twenty new friends and passed out in the car before we hit the causeway.', 21),
    ('kellys-chic-a-boom', 'Sunny''s people', 5,
     'The pup-cup is a scoop of whipped cream and a biscuit. Sunny now pulls us down Main Street toward it.', 8),
    ('hammock-park', 'Nessie''s human', 5,
     'Perfect sniffari. Boardwalks keep paws out of the mud and the birdsong keeps Nessie fascinated.', 5)
)
insert into public.reviews (business_id, author, rating, body, upvotes)
select b.id, s.author, s.rating, s.body, s.upvotes
from seeds s
join public.businesses b on b.slug = s.slug
where not exists (select 1 from public.reviews r where r.business_id = b.id);

with replies(business_slug, review_author, author, body) as (
  values
    ('dunedin-brewery', 'Angus''s human', 'Maggie R.',
     'Second this — ask for the patio out back, it''s the shadiest in summer.'),
    ('honeymoon-island-dog-beach', 'Biscuit''s dad', 'Priya S.',
     'Bring water and a shade tent — there isn''t much cover once the sun''s up.')
)
insert into public.review_replies (review_id, author, body)
select r.id, p.author, p.body
from replies p
join public.businesses b on b.slug = p.business_slug
join public.reviews r on r.business_id = b.id and r.author = p.review_author
where not exists (select 1 from public.review_replies x where x.review_id = r.id);

-- Admin allowlist for /admin/ads (and inquiry reading). Uncomment with yours:
-- insert into public.app_admins (email) values ('you@example.com')
--   on conflict (email) do nothing;
