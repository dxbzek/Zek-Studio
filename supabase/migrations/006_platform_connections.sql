-- ── Add unique constraint to post_metrics for upsert on sync ────────────────
-- Only add if the constraint doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'post_metrics_brand_platform_url_key'
  ) then
    alter table public.post_metrics
      add constraint post_metrics_brand_platform_url_key
      unique (brand_id, platform, post_url);
  end if;
end;
$$;

-- ── OAuth state (short-lived, CSRF protection) ─────────────────────────────
create table if not exists public.oauth_states (
  state      uuid primary key default gen_random_uuid(),
  brand_id   uuid not null,
  platform   text not null,
  created_at timestamptz not null default now()
);

-- No RLS needed — only accessed by edge functions with service role key
-- Cleanup happens inside oauth-callback (delete on use + delete expired)

-- ── Platform connections ─────────────────────────────────────────────────────
create table if not exists public.platform_connections (
  id                    uuid primary key default gen_random_uuid(),
  brand_id              uuid not null references public.brand_profiles(id) on delete cascade,
  platform              text not null check (platform in ('instagram', 'facebook', 'tiktok', 'youtube')),
  access_token          text not null,
  refresh_token         text,
  token_expires_at      timestamptz,
  platform_account_id   text,
  platform_account_name text,
  scopes                text[],
  connected_at          timestamptz not null default now(),
  last_synced_at        timestamptz,
  unique (brand_id, platform)
);

alter table public.platform_connections enable row level security;

-- Owner can manage connections for their brands
create policy "owner manages connections" on public.platform_connections
  using (
    exists (
      select 1 from public.brand_profiles
      where id = platform_connections.brand_id
        and user_id = auth.uid()
    )
  );
