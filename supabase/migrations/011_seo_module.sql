-- SEO Module: keywords, blog posts, audit checklist, review snapshots

-- Target keywords tracker
create table if not exists public.seo_keywords (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_profiles(id) on delete cascade,
  keyword     text not null,
  volume      integer,
  difficulty  text check (difficulty in ('easy', 'medium', 'hard')),
  intent      text check (intent in ('buy', 'info', 'invest', 'local')),
  target_url  text,
  status      text not null default 'targeting' check (status in ('targeting', 'in_progress', 'page_1_2', 'page_3_plus')),
  created_at  timestamptz not null default now()
);

-- Blog content planner
create table if not exists public.blog_posts (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brand_profiles(id) on delete cascade,
  keyword_id   uuid references public.seo_keywords(id) on delete set null,
  title        text not null,
  status       text not null default 'idea' check (status in ('idea', 'draft', 'published')),
  word_count   integer,
  target_wc    integer default 800,
  publish_date date,
  url          text,
  -- on-page checklist booleans
  has_h1h2     boolean not null default false,
  has_internal_links boolean not null default false,
  has_meta_description boolean not null default false,
  keyword_in_title boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- SEO audit checklist
create table if not exists public.seo_audit_items (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brand_profiles(id) on delete cascade,
  category   text not null check (category in ('technical', 'on_page', 'off_page', 'local')),
  issue      text not null,
  status     text not null default 'not_done' check (status in ('not_done', 'in_progress', 'done')),
  priority   text not null default 'p1' check (priority in ('p0', 'p1', 'ok')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Google / platform review count snapshots
create table if not exists public.review_snapshots (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_profiles(id) on delete cascade,
  platform    text not null default 'google',
  count       integer not null,
  target      integer,
  recorded_at date not null default current_date,
  created_at  timestamptz not null default now()
);

-- RLS
alter table public.seo_keywords      enable row level security;
alter table public.blog_posts        enable row level security;
alter table public.seo_audit_items   enable row level security;
alter table public.review_snapshots  enable row level security;

create policy "Users manage own seo_keywords" on public.seo_keywords
  using (brand_id in (select id from public.brand_profiles where user_id = auth.uid()));

create policy "Users manage own blog_posts" on public.blog_posts
  using (brand_id in (select id from public.brand_profiles where user_id = auth.uid()));

create policy "Users manage own seo_audit_items" on public.seo_audit_items
  using (brand_id in (select id from public.brand_profiles where user_id = auth.uid()));

create policy "Users manage own review_snapshots" on public.review_snapshots
  using (brand_id in (select id from public.brand_profiles where user_id = auth.uid()));
