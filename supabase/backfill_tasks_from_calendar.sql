-- Create one task per (brand_id, title, scheduled_date) calendar-entry group
-- that does not already have a linked task. Points at the earliest entry id
-- as the "representative" (matches the UI grouping logic).
WITH groups AS (
  SELECT
    brand_id,
    title,
    scheduled_date,
    MIN(status)     AS group_status,  -- if mixed, draft<published<scheduled alphabetically — safe enough; we override below
    MIN(created_at) AS first_created_at
  FROM calendar_entries
  GROUP BY brand_id, title, scheduled_date
),
reps AS (
  SELECT DISTINCT ON (ce.brand_id, ce.title, ce.scheduled_date)
    ce.id          AS rep_id,
    ce.brand_id,
    ce.title,
    ce.scheduled_date,
    ce.status
  FROM calendar_entries ce
  ORDER BY ce.brand_id, ce.title, ce.scheduled_date, ce.created_at ASC
)
INSERT INTO tasks (brand_id, title, description, type, status, priority, assignee_id, assignee_email, calendar_entry_id, due_date, created_by)
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
