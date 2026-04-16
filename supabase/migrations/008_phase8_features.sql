-- ── Campaigns ─────────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_profiles(id) on delete cascade,
  name        text not null,
  description text,
  color       text not null default '#6366f1',
  start_date  date,
  end_date    date,
  goal        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function update_updated_at_column();
alter table public.campaigns enable row level security;
create policy "owner manages campaigns" on public.campaigns
  using (exists (select 1 from public.brand_profiles where id = campaigns.brand_id and user_id = auth.uid()));

-- ── Content Pillars ───────────────────────────────────────────────────────────
create table if not exists public.content_pillars (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_profiles(id) on delete cascade,
  label       text not null,
  target_pct  integer not null default 20 check (target_pct between 1 and 100),
  color       text not null default '#6366f1',
  created_at  timestamptz not null default now()
);
alter table public.content_pillars enable row level security;
create policy "owner manages pillars" on public.content_pillars
  using (exists (select 1 from public.brand_profiles where id = content_pillars.brand_id and user_id = auth.uid()));

-- ── Reply Templates ───────────────────────────────────────────────────────────
create table if not exists public.reply_templates (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_profiles(id) on delete cascade,
  label       text not null,
  text        text not null,
  platform    text,
  tags        text[] default '{}',
  created_at  timestamptz not null default now()
);
alter table public.reply_templates enable row level security;
create policy "owner manages reply templates" on public.reply_templates
  using (exists (select 1 from public.brand_profiles where id = reply_templates.brand_id and user_id = auth.uid()));

-- ── Share Tokens ──────────────────────────────────────────────────────────────
create table if not exists public.share_tokens (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_profiles(id) on delete cascade,
  type        text not null check (type in ('report', 'approval')),
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  settings    jsonb not null default '{}',
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.share_tokens enable row level security;
create policy "owner manages share tokens" on public.share_tokens
  using (exists (select 1 from public.brand_profiles where id = share_tokens.brand_id and user_id = auth.uid()));
-- Allow anon to read tokens (needed for public pages to validate)
create policy "public read share tokens" on public.share_tokens for select to anon
  using (true);

-- ── Extend calendar_entries ───────────────────────────────────────────────────
alter table public.calendar_entries
  add column if not exists campaign_id     uuid references public.campaigns(id) on delete set null,
  add column if not exists pillar_id       uuid references public.content_pillars(id) on delete set null,
  add column if not exists approval_status text check (approval_status in ('pending_review', 'approved', 'rejected')),
  add column if not exists approval_note   text;
