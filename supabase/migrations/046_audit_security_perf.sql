-- Audit follow-ups: index unindexed FKs, harden trigger function search_path,
-- and remove broad public-listing SELECT policies on public storage buckets.
-- (Object access on public buckets is served via the public CDN endpoint and
--  does not rely on these SELECT policies; dropping them only prevents anon
--  clients from enumerating/listing every file in the bucket.)

-- 1. Covering indexes for foreign keys (advisor 0001_unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS idx_blog_posts_brand_id            ON public.blog_posts (brand_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_keyword_id          ON public.blog_posts (keyword_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_id         ON public.brand_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_campaign_id   ON public.calendar_entries (campaign_id);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_generated_content_id ON public.calendar_entries (generated_content_id);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_pillar_id     ON public.calendar_entries (pillar_id);
CREATE INDEX IF NOT EXISTS idx_competitor_posts_competitor_id ON public.competitor_posts (competitor_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_brand_id          ON public.oauth_states (brand_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_calendar_entry_id ON public.post_metrics (calendar_entry_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_logged_by         ON public.post_metrics (logged_by);
CREATE INDEX IF NOT EXISTS idx_reply_templates_brand_id       ON public.reply_templates (brand_id);
CREATE INDEX IF NOT EXISTS idx_review_snapshots_brand_id      ON public.review_snapshots (brand_id);
CREATE INDEX IF NOT EXISTS idx_saved_hooks_source_post_id     ON public.saved_hooks (source_post_id);
CREATE INDEX IF NOT EXISTS idx_seo_audit_items_brand_id       ON public.seo_audit_items (brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_brand_id          ON public.seo_keywords (brand_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by               ON public.tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id           ON public.team_members (user_id);

-- 2. Pin a non-mutable search_path on trigger helpers
--    (advisor 0011_function_search_path_mutable). Both only reference now(),
--    which lives in pg_catalog (always on the path), so an empty search_path
--    is safe and removes the role-mutable-search_path attack surface.
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- 3. Drop broad public SELECT (listing) policies on public buckets
--    (advisor 0025_public_bucket_allows_listing). Direct object URLs still work.
DROP POLICY IF EXISTS "brand avatars: public read"        ON storage.objects;
DROP POLICY IF EXISTS "Public read competitor thumbnails" ON storage.objects;
