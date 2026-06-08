-- Add Pinterest as a supported platform.
--
-- 1. Add pinterest_handle to brand_profiles (mirrors the other handle columns).
-- 2. Widen platform_connections CHECK to include 'pinterest'.

-- ─── 1. Pinterest handle on brand profiles ───────────────────────────────────
alter table public.brand_profiles
  add column if not exists pinterest_handle text;

-- ─── 2. Widen platform_connections CHECK ─────────────────────────────────────
alter table public.platform_connections
  drop constraint if exists platform_connections_platform_check;
alter table public.platform_connections
  add constraint platform_connections_platform_check
  check (platform in ('instagram','facebook','tiktok','youtube','linkedin','twitter','pinterest'));
