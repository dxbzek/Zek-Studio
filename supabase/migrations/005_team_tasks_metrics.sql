-- ============================================================
-- Zek Studio — Phase 6: Team Management, Tasks & Analytics
-- ============================================================

-- ─── Team Members ────────────────────────────────────────────────────────────

create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_profiles(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'specialist' check (role in ('specialist')),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (brand_id, email)
);

alter table public.team_members enable row level security;

-- Owner manages their brand's team members
create policy "owner manages team members"
  on public.team_members
  for all
  using (
    exists (
      select 1 from public.brand_profiles
      where id = team_members.brand_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brand_profiles
      where id = team_members.brand_id and user_id = auth.uid()
    )
  );

-- Specialists can view their own membership (needed to detect role on login)
create policy "specialist views own membership"
  on public.team_members
  for select
  using (user_id = auth.uid());

-- ─── Tasks ───────────────────────────────────────────────────────────────────

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.brand_profiles(id) on delete cascade,
  title             text not null,
  description       text,
  type              text not null default 'content'
    check (type in ('content', 'shoot', 'approval', 'backup', 'other')),
  status            text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  priority          text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  assignee_id       uuid references auth.users(id) on delete set null,
  assignee_email    text,
  calendar_entry_id uuid references public.calendar_entries(id) on delete set null,
  due_date          date,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.tasks enable row level security;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Owner has full access to tasks for their brands
create policy "owner manages tasks"
  on public.tasks
  for all
  using (
    exists (
      select 1 from public.brand_profiles
      where id = tasks.brand_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brand_profiles
      where id = tasks.brand_id and user_id = auth.uid()
    )
  );

-- Specialists can read their assigned tasks
create policy "specialist reads own tasks"
  on public.tasks
  for select
  using (assignee_id = auth.uid());

-- Specialists can update status on their assigned tasks
create policy "specialist updates own tasks"
  on public.tasks
  for update
  using (assignee_id = auth.uid())
  with check (assignee_id = auth.uid());

-- ─── Post Metrics ─────────────────────────────────────────────────────────────

create table if not exists public.post_metrics (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.brand_profiles(id) on delete cascade,
  calendar_entry_id uuid references public.calendar_entries(id) on delete set null,
  platform          text not null,
  post_url          text,
  posted_at         date,
  views             bigint,
  likes             bigint,
  comments          bigint,
  shares            bigint,
  saves             bigint,
  reach             bigint,
  impressions       bigint,
  notes             text,
  logged_by         uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.post_metrics enable row level security;

create trigger post_metrics_updated_at
  before update on public.post_metrics
  for each row execute function public.set_updated_at();

-- Owner manages metrics for their brands
create policy "owner manages post metrics"
  on public.post_metrics
  for all
  using (
    exists (
      select 1 from public.brand_profiles
      where id = post_metrics.brand_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brand_profiles
      where id = post_metrics.brand_id and user_id = auth.uid()
    )
  );
