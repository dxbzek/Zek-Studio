-- Reset Abdul Kadir Faizal brand content
-- Prior seed put ERE Homes content on Abdul's brand by mistake.
-- Wipe, reseed with his actual PDF content, regenerate tasks.

BEGIN;

-- 1) Remove wrongly-seeded tasks + calendar entries (Abdul only; ERE Homes untouched)
DELETE FROM tasks            WHERE brand_id = '0ecfe3c9-a7bc-4150-a162-61710266ea5c';
DELETE FROM calendar_entries WHERE brand_id = '0ecfe3c9-a7bc-4150-a162-61710266ea5c';

-- 2) Seed Abdul's real content on Instagram (primary platform)
INSERT INTO calendar_entries (brand_id, platform, content_type, title, body, scheduled_date, status, generated_content_id, campaign_id, pillar_id, approval_status, approval_note) VALUES
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','behind_scenes',    'Office',                                         NULL,                                                                                                                                                                                         '2026-01-27','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Golden Visa',                                    NULL,                                                                                                                                                                                         '2026-02-26','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    '300K To Invest',                                 NULL,                                                                                                                                                                                         '2026-02-27','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'MJL',                                            NULL,                                                                                                                                                                                         '2026-03-02','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'UK vs Dubai',                                    NULL,                                                                                                                                                                                         '2026-03-03','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'UK VS UAE',                                      NULL,                                                                                                                                                                                         '2026-03-04','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','new_launch',       'Palm Jebel Ali',                                 'History repeats itself: Palm Jebel Ali is the new investment chance, like Palm Jumeirah 15 years ago. #DubaiRealEstate #Investment',                                                          '2026-03-05','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','behind_scenes',    'Visit Office',                                   'The future is tax-free in Dubai. Working professionals and high-net-worth individuals are making Dubai their home.',                                                                         '2026-03-06','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Golden Visa — Phone Call',                       'Golden Visa unlocked! 8 million dirhams and some properties later.',                                                                                                                         '2026-03-07','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','behind_scenes',    'Phone Call',                                     NULL,                                                                                                                                                                                         '2026-03-08','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','property_tour',    'Manchester City Residences by Ohana — Viewing',  'Luxury beachfront living starts at 7 million dirhams at Manchester City Residences!',                                                                                                        '2026-03-09','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Branded Residences',                             'Branded residences in Dubai: trophy assets with inflated prices?',                                                                                                                           '2026-03-10','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'UK vs Dubai — Beachfront Scarcity',              'Beachfront scarcity in Dubai means big future value. Only 8% of Dubai is beachfront. Investing in limited locations like Palm Jumeirah, Palm Jebel Ali, and Dubai Islands means buying into scarcity.', '2026-03-11','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Dubai is Still Growing',                         NULL,                                                                                                                                                                                         '2026-03-12','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','behind_scenes',    'Podcast Highlight',                              NULL,                                                                                                                                                                                         '2026-03-13','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','area_spotlight',   'UAE is Not Just Dubai',                          'Dubai isn''t the only star. Abu Dhabi is emerging as the UAE''s center, offering higher wealth generation and more family-friendly attractions like Disney, F1, and Seaworld. #AbuDhabi #UAE #Dubai #Investing #RealEstate', '2026-03-15','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Dubai Market Crash',                             'Will Dubai property prices drop? The answer might surprise you.',                                                                                                                            '2026-03-25','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Market Drop',                                    'While demand is shifting, developers aren''t slashing prices. Instead, they''re getting innovative with payment plans. Whether you''re an investor or looking for your dream home, now is the time to watch the market.', '2026-03-26','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Current Situation in UAE',                       NULL,                                                                                                                                                                                         '2026-03-27','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    '15 Years in Dubai',                              NULL,                                                                                                                                                                                         '2026-03-28','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'How to Spend 10 Million AED',                    NULL,                                                                                                                                                                                         '2026-03-29','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Villas & Townhouses',                            'Dubai villas & townhouses: demand exploding, supply years behind — and the smartest investors already moved.',                                                                               '2026-03-30','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Who Said Dubai is Quiet',                        NULL,                                                                                                                                                                                         '2026-03-31','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'How Much Do You Need to Invest in Dubai',        NULL,                                                                                                                                                                                         '2026-04-01','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'How to Spend 10M AED — Breakdown',               '10M AED in Dubai: split it right and turn villas + offices into a 10%+ return strategy.',                                                                                                    '2026-04-02','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    '90 Million',                                     NULL,                                                                                                                                                                                         '2026-04-03','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','area_spotlight',   'Best Locations to Buy',                          'Dubai hotspots for smart investors: Palm, JBR, Downtown, Dubai Hills — which would you pick?',                                                                                               '2026-04-05','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Asset vs Liability',                             NULL,                                                                                                                                                                                         '2026-04-06','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'How to Buy Property in UAE',                     'Buying property in Dubai: from shortlist to keys in 2–3 days if you''re ready.',                                                                                                             '2026-04-07','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Why This Cost',                                  NULL,                                                                                                                                                                                         '2026-04-08','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','area_spotlight',   'Dubai Creek',                                    'Dubai Creek: bigger than Downtown, taller than Burj Khalifa — the future hotspot for billions in investment.',                                                                               '2026-04-09','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    '10,000,000 AED Gold',                            NULL,                                                                                                                                                                                         '2026-04-10','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Local-Only Properties',                          'Dubai freehold secrets: you can''t buy everywhere, but long leases let you live like an owner in prime spots like Jumeirah.',                                                                '2026-04-11','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','property_tour',    'Inside the Royal Atlantis',                      NULL,                                                                                                                                                                                         '2026-04-12','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Gold Comparison',                                NULL,                                                                                                                                                                                         '2026-04-13','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Article 06',                                     NULL,                                                                                                                                                                                         '2026-04-14','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','property_tour',    'Atlantis Apartment Video',                       NULL,                                                                                                                                                                                         '2026-04-15','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Taxes You Will Pay in These Countries',          NULL,                                                                                                                                                                                         '2026-04-16','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Article 05',                                     NULL,                                                                                                                                                                                         '2026-04-17','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'K9 — Part 2',                                    NULL,                                                                                                                                                                                         '2026-04-18','published',NULL,NULL,NULL,NULL,NULL),
  ('0ecfe3c9-a7bc-4150-a162-61710266ea5c','instagram','market_update',    'Article 03',                                     NULL,                                                                                                                                                                                         '2026-04-19','published',NULL,NULL,NULL,NULL,NULL);

-- 3) Cross-post to TikTok / Facebook / YouTube (the PDF shows the same content on all 4)
INSERT INTO calendar_entries (brand_id, platform, content_type, title, body, scheduled_date, status, generated_content_id, campaign_id, pillar_id, approval_status, approval_note)
SELECT c.brand_id, p.platform, c.content_type, c.title, c.body, c.scheduled_date, c.status,
       c.generated_content_id, c.campaign_id, c.pillar_id, c.approval_status, c.approval_note
FROM calendar_entries c
CROSS JOIN (VALUES ('tiktok'), ('facebook'), ('youtube')) AS p(platform)
WHERE c.brand_id = '0ecfe3c9-a7bc-4150-a162-61710266ea5c'
  AND c.platform = 'instagram';

-- 4) Regenerate tasks — one per (title, date) group, earliest entry is the rep
WITH reps AS (
  SELECT DISTINCT ON (ce.brand_id, ce.title, ce.scheduled_date)
    ce.id AS rep_id, ce.brand_id, ce.title, ce.scheduled_date, ce.status
  FROM calendar_entries ce
  WHERE ce.brand_id = '0ecfe3c9-a7bc-4150-a162-61710266ea5c'
  ORDER BY ce.brand_id, ce.title, ce.scheduled_date, ce.created_at ASC
)
INSERT INTO tasks (brand_id, title, description, type, status, priority, assignee_id, assignee_email, calendar_entry_id, due_date, created_by)
SELECT
  r.brand_id, r.title, NULL, 'content',
  CASE r.status
    WHEN 'published' THEN 'done'
    WHEN 'scheduled' THEN 'in_progress'
    ELSE 'todo'
  END,
  'medium', NULL, NULL, r.rep_id, r.scheduled_date, NULL
FROM reps r
WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.calendar_entry_id = r.rep_id);

COMMIT;

-- Verify
SELECT brand_id, status, COUNT(*) FROM calendar_entries WHERE brand_id = '0ecfe3c9-a7bc-4150-a162-61710266ea5c' GROUP BY 1,2;
SELECT brand_id, status, COUNT(*) FROM tasks            WHERE brand_id = '0ecfe3c9-a7bc-4150-a162-61710266ea5c' GROUP BY 1,2;
