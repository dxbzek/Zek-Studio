-- Add `reference_image_url` to calendar_entries.
--
-- Briefs are incomplete without visual reference — a moodboard image, a
-- sample shot, the property's hero photo. This is just a URL pointer for
-- now (no upload bucket); the team pastes a link from anywhere (Drive,
-- listing CMS, Pinterest) and the calendar / drawer / export render it as
-- a thumbnail. A real upload flow can come later without breaking the
-- column.

alter table public.calendar_entries
  add column if not exists reference_image_url text;
