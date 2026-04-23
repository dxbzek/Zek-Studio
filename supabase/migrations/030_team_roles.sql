-- Roles: admin, editor, approver, viewer.
-- Existing 'specialist' rows are migrated to 'editor' (same write behavior).
--
-- Permission model:
--   Owner (brand_profiles.user_id)  — everything, implicit
--   Admin     — everything except deleting the brand; can manage team_members
--   Editor    — read + full write on tasks/calendar/campaigns/pillars
--   Approver  — read + only approval_status / approval_note on calendar_entries
--   Viewer    — read-only
--
-- Viewer-level read stays gated by public.is_brand_team_member(uuid).
-- Writes now gate on new helpers below.

-- ─── 1. Widen the CHECK + migrate existing specialists ──────────────────────
alter table public.team_members
  alter column role drop default;

alter table public.team_members
  drop constraint if exists team_members_role_check;

update public.team_members set role = 'editor' where role = 'specialist';

alter table public.team_members
  add constraint team_members_role_check
  check (role in ('admin', 'editor', 'approver', 'viewer'));

alter table public.team_members
  alter column role set default 'editor';

-- ─── 2. Role-aware helpers ──────────────────────────────────────────────────
-- Resolve the caller's role for a given brand (null if not a member).
create or replace function public.user_role_for_brand(p_brand_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select tm.role
  from public.team_members tm
  where tm.brand_id = p_brand_id
    and tm.accepted_at is not null
    and (
      tm.user_id = auth.uid()
      or lower(tm.email) = lower(
           coalesce((select email from auth.users where id = auth.uid()), '')
         )
    )
  order by case tm.role
    when 'admin' then 1 when 'editor' then 2
    when 'approver' then 3 when 'viewer' then 4
    else 5
  end
  limit 1;
$$;
grant execute on function public.user_role_for_brand(uuid) to authenticated;

-- Writer = admin or editor. Used by tasks/calendar/campaigns/pillars writes.
create or replace function public.is_brand_writer(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_role_for_brand(p_brand_id) in ('admin', 'editor');
$$;
grant execute on function public.is_brand_writer(uuid) to authenticated;

-- Approver = admin, editor, or approver. Used by the approval-columns trigger.
create or replace function public.is_brand_approver(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_role_for_brand(p_brand_id) in ('admin', 'editor', 'approver');
$$;
grant execute on function public.is_brand_approver(uuid) to authenticated;

-- Admin = admin only. Used for team_members management.
create or replace function public.is_brand_admin(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_role_for_brand(p_brand_id) = 'admin';
$$;
grant execute on function public.is_brand_admin(uuid) to authenticated;

-- ─── 3. Tasks policies — writers only for writes, team members for reads ────
drop policy if exists "specialist reads brand tasks"    on public.tasks;
drop policy if exists "specialist updates brand tasks"  on public.tasks;
drop policy if exists "writer inserts brand tasks"      on public.tasks;
drop policy if exists "writer updates brand tasks"      on public.tasks;
drop policy if exists "writer deletes brand tasks"      on public.tasks;
drop policy if exists "member reads brand tasks"        on public.tasks;

create policy "member reads brand tasks"
  on public.tasks for select
  using (public.is_brand_team_member(brand_id));

create policy "writer inserts brand tasks"
  on public.tasks for insert
  with check (public.is_brand_writer(brand_id));

create policy "writer updates brand tasks"
  on public.tasks for update
  using (public.is_brand_writer(brand_id))
  with check (public.is_brand_writer(brand_id));

create policy "writer deletes brand tasks"
  on public.tasks for delete
  using (public.is_brand_writer(brand_id));

-- ─── 4. Calendar entries — writers full; approvers limited by trigger ──────
drop policy if exists "specialist reads brand calendar"   on public.calendar_entries;
drop policy if exists "specialist inserts brand calendar" on public.calendar_entries;
drop policy if exists "specialist updates brand calendar" on public.calendar_entries;
drop policy if exists "specialist deletes brand calendar" on public.calendar_entries;
drop policy if exists "member reads brand calendar"       on public.calendar_entries;
drop policy if exists "writer inserts brand calendar"     on public.calendar_entries;
drop policy if exists "writer updates brand calendar"     on public.calendar_entries;
drop policy if exists "approver updates brand calendar"   on public.calendar_entries;

create policy "member reads brand calendar"
  on public.calendar_entries for select
  using (public.is_brand_team_member(brand_id));

create policy "writer inserts brand calendar"
  on public.calendar_entries for insert
  with check (public.is_brand_writer(brand_id));

-- Update is allowed to any approver-or-higher; the trigger below enforces
-- that non-writers can only change approval_status and approval_note.
create policy "approver updates brand calendar"
  on public.calendar_entries for update
  using (public.is_brand_approver(brand_id))
  with check (public.is_brand_approver(brand_id));

-- BEFORE UPDATE trigger: if the caller is not a writer, reject any change
-- outside approval_status/approval_note. Owners bypass by dint of the
-- brand_profiles "for all" policy never firing this trigger with a non-
-- matching row, but we also fast-path-accept if the caller is a writer.
create or replace function public.enforce_calendar_entry_write_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_writer boolean;
  is_owner  boolean;
begin
  select exists (
    select 1 from public.brand_profiles bp
    where bp.id = new.brand_id and bp.user_id = auth.uid()
  ) into is_owner;
  if is_owner then return new; end if;

  select public.is_brand_writer(new.brand_id) into is_writer;
  if is_writer then return new; end if;

  -- Non-writer approver: only approval_status and approval_note may change.
  if new.id                   is distinct from old.id
     or new.brand_id          is distinct from old.brand_id
     or new.platform          is distinct from old.platform
     or new.content_type      is distinct from old.content_type
     or new.title             is distinct from old.title
     or new.body              is distinct from old.body
     or new.scheduled_date    is distinct from old.scheduled_date
     or new.status            is distinct from old.status
     or new.generated_content_id is distinct from old.generated_content_id
     or new.campaign_id       is distinct from old.campaign_id
     or new.pillar_id         is distinct from old.pillar_id
     or new.assigned_editor   is distinct from old.assigned_editor
     or new.assigned_shooter  is distinct from old.assigned_shooter
     or new.assigned_talent   is distinct from old.assigned_talent
     or new.character         is distinct from old.character
  then
    raise exception 'Approvers can only change approval_status and approval_note';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_entries_enforce_write_rules on public.calendar_entries;
create trigger calendar_entries_enforce_write_rules
  before update on public.calendar_entries
  for each row execute function public.enforce_calendar_entry_write_rules();

-- ─── 5. Campaigns + content_pillars — writers for writes ────────────────────
drop policy if exists "specialist reads brand campaigns" on public.campaigns;
drop policy if exists "member reads brand campaigns"     on public.campaigns;
drop policy if exists "writer writes brand campaigns"    on public.campaigns;

create policy "member reads brand campaigns"
  on public.campaigns for select
  using (public.is_brand_team_member(brand_id));

create policy "writer writes brand campaigns"
  on public.campaigns for all
  using (public.is_brand_writer(brand_id))
  with check (public.is_brand_writer(brand_id));

drop policy if exists "specialist reads brand pillars" on public.content_pillars;
drop policy if exists "member reads brand pillars"     on public.content_pillars;
drop policy if exists "writer writes brand pillars"    on public.content_pillars;

create policy "member reads brand pillars"
  on public.content_pillars for select
  using (public.is_brand_team_member(brand_id));

create policy "writer writes brand pillars"
  on public.content_pillars for all
  using (public.is_brand_writer(brand_id))
  with check (public.is_brand_writer(brand_id));

-- ─── 6. team_members — admins can manage team alongside the owner ───────────
-- The existing owner-managed policy from 005 stays; we add a parallel policy
-- so admins can INSERT/UPDATE/DELETE team_members for brands they admin.
drop policy if exists "admin manages team members" on public.team_members;
create policy "admin manages team members"
  on public.team_members
  for all
  using (public.is_brand_admin(brand_id))
  with check (public.is_brand_admin(brand_id));
