-- ============================================================
-- Zek Studio — Initial Schema
-- Run this in your Supabase SQL editor or via Supabase CLI
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── Brand Profiles ──────────────────────────────────────────────────────────

create table public.brand_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  niche       text not null,
  website_url text,
  platforms   text[] not null default '{}',
  avatar_url  text,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.brand_profiles enable row level security;

create policy "Users manage their own brands"
  on public.brand_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brand_profiles_updated_at
  before update on public.brand_profiles
  for each row execute function public.set_updated_at();

-- ─── Competitors ─────────────────────────────────────────────────────────────

create table public.competitors (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references public.brand_profiles(id) on delete cascade,
  handle          text not null,
  platform        text not null,
  last_scraped_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (brand_id, handle, platform)
);

alter table public.competitors enable row level security;

create policy "Users manage competitors for their brands"
  on public.competitors
  for all
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_id and bp.user_id = auth.uid()
    )
  );

-- ─── Competitor Posts ─────────────────────────────────────────────────────────

create table public.competitor_posts (
  id              uuid primary key default gen_random_uuid(),
  competitor_id   uuid not null references public.competitors(id) on delete cascade,
  brand_id        uuid not null references public.brand_profiles(id) on delete cascade,
  platform        text not null,
  url             text,
  caption         text,
  views           bigint,
  likes           bigint,
  comments        bigint,
  shares          bigint,
  hook            text,
  thumbnail_url   text,
  posted_at       timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.competitor_posts enable row level security;

create policy "Users view posts for their brands"
  on public.competitor_posts
  for all
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_id and bp.user_id = auth.uid()
    )
  );

-- ─── Saved Hooks ─────────────────────────────────────────────────────────────

create table public.saved_hooks (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.brand_profiles(id) on delete cascade,
  text           text not null,
  source_post_id uuid references public.competitor_posts(id) on delete set null,
  platform       text,
  tags           text[] not null default '{}',
  created_at     timestamptz not null default now()
);

alter table public.saved_hooks enable row level security;

create policy "Users manage hooks for their brands"
  on public.saved_hooks
  for all
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_id and bp.user_id = auth.uid()
    )
  );

-- ─── Niche Research Cache ─────────────────────────────────────────────────────

create table public.niche_research_cache (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brand_profiles(id) on delete cascade,
  query      text not null,
  results    jsonb not null default '{}',
  fetched_at timestamptz not null default now(),
  unique (brand_id, query)
);

alter table public.niche_research_cache enable row level security;

create policy "Users manage research cache for their brands"
  on public.niche_research_cache
  for all
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_id and bp.user_id = auth.uid()
    )
  );

-- ─── Generated Content ───────────────────────────────────────────────────────

create table public.generated_content (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brand_profiles(id) on delete cascade,
  type       text not null check (type in ('hook', 'caption', 'idea')),
  platform   text not null,
  brief      text not null,
  output     text[] not null default '{}',
  tone       text not null,
  created_at timestamptz not null default now()
);

alter table public.generated_content enable row level security;

create policy "Users manage generated content for their brands"
  on public.generated_content
  for all
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_id and bp.user_id = auth.uid()
    )
  );

-- ─── Calendar Entries ────────────────────────────────────────────────────────

create table public.calendar_entries (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references public.brand_profiles(id) on delete cascade,
  platform             text not null,
  content_type         text not null,
  title                text not null,
  body                 text,
  scheduled_date       date not null,
  status               text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  generated_content_id uuid references public.generated_content(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.calendar_entries enable row level security;

create policy "Users manage calendar entries for their brands"
  on public.calendar_entries
  for all
  using (
    exists (
      select 1 from public.brand_profiles bp
      where bp.id = brand_id and bp.user_id = auth.uid()
    )
  );

create trigger calendar_entries_updated_at
  before update on public.calendar_entries
  for each row execute function public.set_updated_at();
