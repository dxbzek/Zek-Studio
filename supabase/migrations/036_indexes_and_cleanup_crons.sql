-- Zek Studio — Pass N: brand_id indexes + daily cleanup crons
--
-- 1. Five missing brand_id indexes on tables that are filtered with
--    `.eq('brand_id', ...)` in a hook but have no index today. Queries degrade
--    linearly with brand-scoped row count without them.
-- 2. Three cron jobs that prune unbounded-growth tables:
--      oauth_states  — handshake abandons leave stale rows (1h TTL)
--      share_tokens  — expired share links (expires_at < now)
--      niche_research_cache — research cache is cheap to rebuild (7d TTL)
--    pg_cron is already enabled (migration 010), so no extension step.
--
-- reply_templates is intentionally skipped: the table exists but no code path
-- queries it yet. Add an index when the first hook is introduced.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists campaigns_brand_idx
  on public.campaigns (brand_id);

create index if not exists content_pillars_brand_idx
  on public.content_pillars (brand_id);

-- Composite: every query is .eq('brand_id').eq('query').maybeSingle()
create index if not exists niche_research_cache_brand_query_idx
  on public.niche_research_cache (brand_id, query);

create index if not exists saved_hooks_brand_idx
  on public.saved_hooks (brand_id);

create index if not exists share_tokens_brand_idx
  on public.share_tokens (brand_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Cleanup crons
-- ─────────────────────────────────────────────────────────────────────────────
-- Run daily, staggered by minute so they don't contend. Using cron.schedule
-- with idempotent `cron.unschedule` pattern wrapped in DO blocks so re-running
-- the migration is safe.

-- oauth_states: 1-hour TTL. OAuth state rows live only for the handshake window.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-oauth-states') then
    perform cron.unschedule('cleanup-oauth-states');
  end if;
  perform cron.schedule(
    'cleanup-oauth-states',
    '5 3 * * *',
    $job$ delete from public.oauth_states where created_at < now() - interval '1 hour' $job$
  );
end $$;

-- share_tokens: drop expired rows. Tokens without expires_at are kept (indefinite).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-share-tokens') then
    perform cron.unschedule('cleanup-share-tokens');
  end if;
  perform cron.schedule(
    'cleanup-share-tokens',
    '10 3 * * *',
    $job$ delete from public.share_tokens where expires_at is not null and expires_at < now() $job$
  );
end $$;

-- niche_research_cache: 7-day TTL. Trivially rebuilt from the edge function.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-niche-research-cache') then
    perform cron.unschedule('cleanup-niche-research-cache');
  end if;
  perform cron.schedule(
    'cleanup-niche-research-cache',
    '15 3 * * *',
    $job$ delete from public.niche_research_cache where fetched_at < now() - interval '7 days' $job$
  );
end $$;
