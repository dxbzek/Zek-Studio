-- Add posted_time to post_metrics so we can track hour-of-day posting patterns.
-- Originally 010_posted_time.sql; renumbered because version 010 was already
-- claimed by 010_auto_sync_cron.sql in schema_migrations on prod.
-- Idempotent via IF NOT EXISTS — safe to re-run.
alter table public.post_metrics
  add column if not exists posted_time time;
