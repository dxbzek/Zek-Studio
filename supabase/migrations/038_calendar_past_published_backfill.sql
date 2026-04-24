-- Safety follow-up to 037. That migration applied but logged
--   "WARNING: SET LOCAL can only be used in transaction blocks"
-- which means the approver-restriction trigger from migration 030 may have
-- silently blocked the backfill UPDATE. This migration re-runs the backfill
-- using the reliable `alter table … disable trigger` pattern so we know the
-- rows actually flipped.
--
-- Idempotent: if 037's backfill did run, this update matches 0 rows.

alter table public.calendar_entries
  disable trigger calendar_entries_enforce_write_rules;

update public.calendar_entries
set status = 'published', updated_at = now()
where scheduled_date < current_date
  and status = 'scheduled';

alter table public.calendar_entries
  enable trigger calendar_entries_enforce_write_rules;
