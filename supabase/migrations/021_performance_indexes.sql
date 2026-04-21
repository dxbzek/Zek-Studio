-- ============================================================
-- Zek Studio — Pass I: performance indexes on hot filter columns
--
-- Every table gets RLS-scoped reads filtered by brand_id and (usually)
-- one secondary column — without indexes the planner falls back to
-- sequential scans, which degrades linearly with row count.
--
-- share_tokens.token already has a UNIQUE btree (from 008), so no
-- extra index needed there.
-- ============================================================

-- Tasks: board view = filter by brand_id + status + optional assignee
create index if not exists tasks_brand_status_idx
  on public.tasks (brand_id, status);
create index if not exists tasks_assignee_idx
  on public.tasks (assignee_id)
  where assignee_id is not null;
create index if not exists tasks_calendar_entry_idx
  on public.tasks (calendar_entry_id)
  where calendar_entry_id is not null;

-- Calendar entries: month views filter by brand + scheduled_date range
create index if not exists calendar_entries_brand_date_idx
  on public.calendar_entries (brand_id, scheduled_date);

-- Competitor posts: research pages filter by brand_id; benchmark query
-- sorts by views desc.
create index if not exists competitor_posts_brand_idx
  on public.competitor_posts (brand_id);

-- Generated content: dashboard + content page list by brand desc
create index if not exists generated_content_brand_created_idx
  on public.generated_content (brand_id, created_at desc);

-- Post metrics: analytics filters by brand + posted_at + platform
create index if not exists post_metrics_brand_posted_idx
  on public.post_metrics (brand_id, posted_at);
create index if not exists post_metrics_brand_platform_idx
  on public.post_metrics (brand_id, platform);

-- Team members: is_brand_team_member() lookup by brand_id + (user_id OR email)
create index if not exists team_members_brand_user_idx
  on public.team_members (brand_id, user_id)
  where user_id is not null;
create index if not exists team_members_brand_email_idx
  on public.team_members (brand_id, lower(email))
  where email is not null;

-- oauth_states: cleanup cron will filter by created_at
create index if not exists oauth_states_created_idx
  on public.oauth_states (created_at);
