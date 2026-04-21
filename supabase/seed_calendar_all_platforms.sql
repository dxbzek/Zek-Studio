-- Duplicate existing instagram calendar entries for all other platforms
INSERT INTO calendar_entries (brand_id, platform, content_type, title, body, scheduled_date, status, generated_content_id, campaign_id, pillar_id, approval_status, approval_note)
SELECT c.brand_id, p.platform, c.content_type, c.title, c.body, c.scheduled_date, c.status, c.generated_content_id, c.campaign_id, c.pillar_id, c.approval_status, c.approval_note
FROM calendar_entries c
CROSS JOIN (VALUES ('facebook'), ('tiktok'), ('linkedin'), ('youtube'), ('twitter')) AS p(platform)
WHERE c.brand_id = 'fe5b9d70-0ad7-4447-b88a-750b927b3488'
  AND c.platform = 'instagram';
