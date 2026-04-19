-- Monthly KPI targets per brand
create table public.brand_kpis (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brand_profiles(id) on delete cascade,
  month date not null, -- stored as first day of month, e.g. 2026-04-01
  posts_target int,
  views_target bigint,
  engagement_target numeric(5,2), -- e.g. 4.50 = 4.5%
  keywords_target int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(brand_id, month)
);

alter table public.brand_kpis enable row level security;
create policy "Brand owner manages KPIs"
  on public.brand_kpis for all
  using (brand_id in (select id from brand_profiles where user_id = auth.uid()));

-- Follower/subscriber growth snapshots (one per platform per day)
create table public.growth_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brand_profiles(id) on delete cascade,
  platform text not null,
  followers bigint not null,
  recorded_at date not null default current_date,
  created_at timestamptz default now(),
  unique(brand_id, platform, recorded_at)
);

alter table public.growth_snapshots enable row level security;
create policy "Brand owner manages growth snapshots"
  on public.growth_snapshots for all
  using (brand_id in (select id from brand_profiles where user_id = auth.uid()));
