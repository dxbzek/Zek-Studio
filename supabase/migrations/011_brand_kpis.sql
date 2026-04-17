create table if not exists public.brand_kpis (
  id            uuid default gen_random_uuid() primary key,
  brand_id      uuid not null references public.brand_profiles(id) on delete cascade,
  platform      text not null default 'all',
  metric        text not null,
  target_value  numeric not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.brand_kpis enable row level security;

create policy "brand_kpis: owner access"
  on public.brand_kpis for all
  using (
    brand_id in (
      select id from public.brand_profiles where user_id = auth.uid()
    )
  );

create unique index brand_kpis_brand_platform_metric_idx
  on public.brand_kpis (brand_id, platform, metric);
