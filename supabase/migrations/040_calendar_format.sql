-- Add `format` column to calendar_entries.
--
-- Format = how the post is delivered (vs. content_type which is the theme).
-- Four buckets the team works with:
--   reel              — vertical short-form video
--   carousel          — multi-slide swipe post
--   static            — single image
--   emergency_backup  — static or carousel, max 4 slides; flagged so it
--                       stands out on the calendar
--
-- Nullable so legacy rows keep working without a backfill choice.

alter table public.calendar_entries
  add column if not exists format text
  check (format is null or format in ('reel', 'carousel', 'static', 'emergency_backup'));
