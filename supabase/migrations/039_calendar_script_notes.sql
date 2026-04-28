-- Add `script` and `notes` columns to calendar_entries.
--
-- Until now `body` carried both the published caption and any free-form
-- internal context. Splitting them: `body` stays as the caption that goes
-- on-platform, `script` is the talking-points / concept / hook outline,
-- and `notes` is anything else the team needs to keep with the entry
-- (links to references, talent direction, location notes).
--
-- All three are nullable text — drafts often have only one of them.

alter table public.calendar_entries
  add column if not exists script text,
  add column if not exists notes  text;
