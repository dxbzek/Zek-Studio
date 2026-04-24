-- Calendar entries with a scheduled_date in the past should always read
-- as "published" — a historical post sitting in the calendar as
-- "scheduled" is a stale state the user was having to correct by hand.
--
-- Two parts:
--   1. One-time backfill of rows already in the past (excluding 'draft' so
--      we don't promote something the user explicitly kept as a working
--      copy).
--   2. BEFORE INSERT/UPDATE trigger that sets status = 'published' whenever
--      scheduled_date < current_date. The client already applies the same
--      rule in EntryDrawer; trigger is belt-and-braces for API callers and
--      for any case where a scheduled entry's date is later edited into the
--      past.
--
-- Draft entries are still allowed to live in the past — authors sometimes
-- keep archived drafts on historical dates.

-- ── 1. Backfill ─────────────────────────────────────────────────────────────
-- Switch to replica mode for the backfill so the approver-restriction
-- trigger from migration 030 (enforce_calendar_entry_write_rules) doesn't
-- block the admin update — it runs without an auth.uid() and would
-- otherwise treat the migration as a non-writer caller.
set local session_replication_role = replica;

update public.calendar_entries
set status = 'published', updated_at = now()
where scheduled_date < current_date
  and status = 'scheduled';

set local session_replication_role = origin;

-- ── 2. Enforce-on-write trigger ─────────────────────────────────────────────
create or replace function public.calendar_entries_past_to_published()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.scheduled_date < current_date and new.status = 'scheduled' then
    new.status := 'published';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_entries_past_to_published_trg on public.calendar_entries;
create trigger calendar_entries_past_to_published_trg
  before insert or update on public.calendar_entries
  for each row
  execute function public.calendar_entries_past_to_published();
