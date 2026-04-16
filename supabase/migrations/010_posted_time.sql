-- Add posted_time to post_metrics so we can track hour-of-day posting patterns
alter table public.post_metrics
  add column if not exists posted_time time;
