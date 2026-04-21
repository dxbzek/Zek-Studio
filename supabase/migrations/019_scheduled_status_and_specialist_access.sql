-- ============================================================
-- Zek Studio — "Scheduled" task column + specialist brand access
-- 1. Add 'scheduled' to tasks.status check constraint (new Kanban column)
-- 2. Let specialists (team_members) see their assigned brand's
--    profile, calendar, tasks, campaigns, and content pillars —
--    not just rows that happen to be tagged to their email.
-- ============================================================

-- ─── 1. Extend tasks.status ──────────────────────────────────────────────────
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add  constraint tasks_status_check
  check (status in ('todo', 'in_progress', 'scheduled', 'done'));

-- Move previously auto-synced tasks (calendar status='scheduled' mapped to
-- 'in_progress' under the old schema) into the new Scheduled column.
update public.tasks t
set status = 'scheduled'
from public.calendar_entries ce
where t.calendar_entry_id = ce.id
  and ce.status = 'scheduled'
  and t.status = 'in_progress';

-- ─── 2. Helper: is current user a team member of this brand? ─────────────────
create or replace function public.is_brand_team_member(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.brand_id = p_brand_id
      and (
        tm.user_id = auth.uid()
        or lower(tm.email) = lower(
             coalesce((select email from auth.users where id = auth.uid()), '')
           )
      )
  );
$$;

grant execute on function public.is_brand_team_member(uuid) to authenticated;

-- ─── 3. brand_profiles: specialists can read their assigned brand ────────────
drop policy if exists "specialist reads assigned brand" on public.brand_profiles;
create policy "specialist reads assigned brand"
  on public.brand_profiles
  for select
  using (public.is_brand_team_member(id));

-- ─── 4. tasks: specialists get brand-wide read + update (move cards) ─────────
drop policy if exists "specialist reads own tasks"    on public.tasks;
drop policy if exists "specialist updates own tasks"  on public.tasks;
drop policy if exists "specialist reads brand tasks"  on public.tasks;
drop policy if exists "specialist updates brand tasks" on public.tasks;

create policy "specialist reads brand tasks"
  on public.tasks
  for select
  using (public.is_brand_team_member(brand_id));

create policy "specialist updates brand tasks"
  on public.tasks
  for update
  using (public.is_brand_team_member(brand_id))
  with check (public.is_brand_team_member(brand_id));

-- ─── 5. calendar_entries: full CRUD for specialists on their brand ───────────
drop policy if exists "specialist reads brand calendar"   on public.calendar_entries;
drop policy if exists "specialist inserts brand calendar" on public.calendar_entries;
drop policy if exists "specialist updates brand calendar" on public.calendar_entries;
drop policy if exists "specialist deletes brand calendar" on public.calendar_entries;

create policy "specialist reads brand calendar"
  on public.calendar_entries
  for select
  using (public.is_brand_team_member(brand_id));

create policy "specialist inserts brand calendar"
  on public.calendar_entries
  for insert
  with check (public.is_brand_team_member(brand_id));

create policy "specialist updates brand calendar"
  on public.calendar_entries
  for update
  using (public.is_brand_team_member(brand_id))
  with check (public.is_brand_team_member(brand_id));

create policy "specialist deletes brand calendar"
  on public.calendar_entries
  for delete
  using (public.is_brand_team_member(brand_id));

-- ─── 6. Calendar-adjacent lookups specialists need (read-only) ───────────────
drop policy if exists "specialist reads brand campaigns" on public.campaigns;
create policy "specialist reads brand campaigns"
  on public.campaigns
  for select
  using (public.is_brand_team_member(brand_id));

drop policy if exists "specialist reads brand pillars" on public.content_pillars;
create policy "specialist reads brand pillars"
  on public.content_pillars
  for select
  using (public.is_brand_team_member(brand_id));
