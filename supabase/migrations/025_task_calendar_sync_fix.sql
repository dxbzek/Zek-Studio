-- Fix calendar ↔ task sync drift.
--
-- 1. Dedupe: many (brand, title, scheduled_date) content groups ended up with
--    multiple tasks because the live edit path in ContentCalendarPage only
--    checked for an existing task on the *current* representative entry's id.
--    When the representative changed between edits, a second task was created.
--    Keep the best-status task per group; delete the rest.
--
-- 2. Align 2 drift rows where tasks.status = 'done' but the linked calendar
--    entry still says 'scheduled'. Treat task as source of truth (it's the
--    active surface where users drag cards) and pull calendar_entries.status
--    up to 'published'.
--
-- 3. Trigger: propagate future tasks.status updates to the linked calendar
--    entry so the two never diverge again.
--
-- Mapping tasks.status → calendar_entries.status:
--   done           → published
--   scheduled      → scheduled
--   todo | in_progress → draft
--
-- Idempotent: dedupe uses row_number so re-running is a no-op; status patch
-- only fires when mismatched; trigger uses create-or-replace.

-- ─── 1. Dedupe duplicate tasks per content group ─────────────────────────────
with ranked as (
  select
    t.id as task_id,
    row_number() over (
      partition by ce.brand_id, ce.title, ce.scheduled_date
      order by
        case t.status
          when 'done'        then 0
          when 'scheduled'   then 1
          when 'in_progress' then 2
          when 'todo'        then 3
          else 4
        end,
        t.updated_at desc,
        t.created_at asc
    ) as rn
  from public.tasks t
  join public.calendar_entries ce on ce.id = t.calendar_entry_id
)
delete from public.tasks
where id in (select task_id from ranked where rn > 1);

-- ─── 2. Pull calendar_entries.status up to match task.status ─────────────────
update public.calendar_entries ce
set status = case t.status
    when 'done'        then 'published'
    when 'scheduled'   then 'scheduled'
    else 'draft'
  end
from public.tasks t
where t.calendar_entry_id = ce.id
  and ce.status <> case t.status
    when 'done'        then 'published'
    when 'scheduled'   then 'scheduled'
    else 'draft'
  end;

-- ─── 3. Trigger: future-proof the sync ───────────────────────────────────────
create or replace function public.sync_calendar_status_from_task()
returns trigger
language plpgsql
as $$
begin
  if new.calendar_entry_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  update public.calendar_entries
  set status = case new.status
      when 'done'      then 'published'
      when 'scheduled' then 'scheduled'
      else 'draft'
    end
  where id = new.calendar_entry_id;
  return new;
end;
$$;

drop trigger if exists tasks_sync_calendar_status on public.tasks;
create trigger tasks_sync_calendar_status
  after insert or update of status on public.tasks
  for each row execute function public.sync_calendar_status_from_task();
