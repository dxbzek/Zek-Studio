-- Performance advisor 0005_unused_index: drop indexes with zero scans that are
-- not backing any constraint. Scoped to the 4 app-managed indexes only; the
-- dld_market idx_dlm_* indexes are left in place (that table is an out-of-band
-- reference dataset, plausibly indexed for ad-hoc SQL analysis). Fully
-- reversible — the original CREATE statements are kept in comments below.

DROP INDEX IF EXISTS public.tasks_assignee_idx;
-- CREATE INDEX tasks_assignee_idx ON public.tasks USING btree (assignee_id) WHERE (assignee_id IS NOT NULL);

DROP INDEX IF EXISTS public.post_metrics_brand_posted_idx;
-- CREATE INDEX post_metrics_brand_posted_idx ON public.post_metrics USING btree (brand_id, posted_at);

DROP INDEX IF EXISTS public.team_members_brand_email_idx;
-- CREATE INDEX team_members_brand_email_idx ON public.team_members USING btree (brand_id, lower(email)) WHERE (email IS NOT NULL);

DROP INDEX IF EXISTS public.niche_research_cache_brand_query_idx;
-- CREATE INDEX niche_research_cache_brand_query_idx ON public.niche_research_cache USING btree (brand_id, query);
