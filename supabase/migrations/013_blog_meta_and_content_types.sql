-- Blog post meta fields
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS slug             text,
  ADD COLUMN IF NOT EXISTS meta_title       text,
  ADD COLUMN IF NOT EXISTS meta_description text;

-- Drop old check constraint on generated_content.type and replace with expanded set
ALTER TABLE generated_content
  DROP CONSTRAINT IF EXISTS generated_content_type_check;

ALTER TABLE generated_content
  ADD CONSTRAINT generated_content_type_check
    CHECK (type IN ('hook','caption','idea','script','listing','market','story','cta'));
