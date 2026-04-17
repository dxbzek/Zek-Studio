-- Run this SQL manually in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/otyksdmlepmhqwsyxvsn/sql/new

-- Enable required extensions (usually already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Weekly competitor re-scrape: every Monday at 03:00 UTC
-- Calls the auto-sync-competitors edge function via HTTP
-- Replace <SERVICE_ROLE_KEY> with your project's service role key
-- (Settings → API → service_role key — stays server-side, never sent to browser)
select cron.schedule(
  'weekly-competitor-sync',
  '0 3 * * 1',
  $$
  select net.http_post(
    url     := 'https://otyksdmlepmhqwsyxvsn.supabase.co/functions/v1/auto-sync-competitors',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  )
  $$
);
