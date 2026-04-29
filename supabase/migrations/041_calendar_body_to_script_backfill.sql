-- Backfill `script` from legacy `body` content where script is empty.
--
-- The drawer dropped its Caption section several iterations ago — Script
-- now carries the brief, Notes carry internal references. Old entries
-- still have content stuck in `body` that the UI no longer surfaces.
-- This migration moves anything in body into script (only when script is
-- empty, so we don't clobber a manually-written script).
--
-- The body column itself is left in place for now: PublicApprovalPage
-- still reads it, and dropping the column would be a separate, riskier
-- migration. After this, new edits stop touching body and existing rows
-- have their script populated.

set local session_replication_role = replica;

update public.calendar_entries
set script = body, updated_at = now()
where (script is null or script = '')
  and body is not null
  and body <> '';

set local session_replication_role = origin;
