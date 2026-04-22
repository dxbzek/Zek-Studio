-- Backfill tasks for calendar entries that don't have a linked task yet.
-- Historically, entries created via the Content Generator's "Save to
-- calendar" path skipped task creation — only the Calendar drawer
-- created a task. Now that the generator path also creates tasks going
-- forward, backfill the existing orphans.
--
-- Idempotent: the NOT EXISTS guard makes re-running this a no-op.

WITH reps AS (
  SELECT DISTINCT ON (ce.brand_id, ce.title, ce.scheduled_date)
    ce.id AS rep_id,
    ce.brand_id,
    ce.title,
    ce.scheduled_date,
    ce.status
  FROM calendar_entries ce
  ORDER BY ce.brand_id, ce.title, ce.scheduled_date, ce.created_at ASC
)
INSERT INTO tasks (
  brand_id, title, description, type, status, priority,
  assignee_id, assignee_email, calendar_entry_id, due_date, created_by
)
SELECT
  r.brand_id,
  r.title,
  NULL,
  'content',
  CASE r.status
    WHEN 'published' THEN 'done'
    WHEN 'scheduled' THEN 'scheduled'
    ELSE 'todo'
  END,
  'medium',
  NULL,
  NULL,
  r.rep_id,
  r.scheduled_date,
  NULL
FROM reps r
WHERE NOT EXISTS (
  SELECT 1 FROM tasks t WHERE t.calendar_entry_id = r.rep_id
);
