-- Recovered from the live database (Zek Studio project, remote migration
-- version 20260527110548). This migration was applied directly to production
-- (out-of-band) and never committed to the repo — captured here so the repo
-- migration history reflects what actually ran. It sorts between 043 and 044
-- by application date (2026-05-27).
--
-- Purpose: fix Supabase `auth_rls_initplan` warnings by wrapping auth.uid() in
-- (select auth.uid()) so Postgres evaluates it once per query instead of once
-- per row, and pins search_path = '' on the SECURITY DEFINER helper functions.

-- ============================================================
-- 1. HELPER FUNCTIONS — replace auth.uid() with (select auth.uid())
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
  select lower(coalesce((select email from auth.users where id = (select auth.uid())), ''));
$$;

CREATE OR REPLACE FUNCTION public.user_owns_brand(p_brand_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
  select exists (
    select 1 from public.brand_profiles
    where id = p_brand_id and user_id = (select auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_brand_team_member(p_brand_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
  select exists (
    select 1
    from public.team_members tm
    where tm.brand_id = p_brand_id
      and tm.accepted_at is not null
      and (
        tm.user_id = (select auth.uid())
        or lower(tm.email) = lower(
             coalesce((select email from auth.users where id = (select auth.uid())), '')
           )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_role_for_brand(p_brand_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
  select tm.role
  from public.team_members tm
  where tm.brand_id = p_brand_id
    and tm.accepted_at is not null
    and (
      tm.user_id = (select auth.uid())
      or lower(tm.email) = lower(
           coalesce((select email from auth.users where id = (select auth.uid())), '')
         )
    )
  order by case tm.role
    when 'admin' then 1 when 'editor' then 2
    when 'approver' then 3 when 'viewer' then 4
    else 5
  end
  limit 1;
$$;

CREATE OR REPLACE FUNCTION public.enforce_calendar_entry_write_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
declare
  is_writer boolean;
  is_owner  boolean;
begin
  select exists (
    select 1 from public.brand_profiles bp
    where bp.id = new.brand_id and bp.user_id = (select auth.uid())
  ) into is_owner;
  if is_owner then return new; end if;

  select public.is_brand_writer(new.brand_id) into is_writer;
  if is_writer then return new; end if;

  if new.id                   is distinct from old.id
     or new.brand_id          is distinct from old.brand_id
     or new.platform          is distinct from old.platform
     or new.content_type      is distinct from old.content_type
     or new.title             is distinct from old.title
     or new.body              is distinct from old.body
     or new.scheduled_date    is distinct from old.scheduled_date
     or new.status            is distinct from old.status
     or new.generated_content_id is distinct from old.generated_content_id
     or new.campaign_id       is distinct from old.campaign_id
     or new.pillar_id         is distinct from old.pillar_id
     or new.assigned_editor   is distinct from old.assigned_editor
     or new.assigned_shooter  is distinct from old.assigned_shooter
     or new.assigned_talent   is distinct from old.assigned_talent
     or new.character         is distinct from old.character
  then
    raise exception 'Approvers can only change approval_status and approval_note';
  end if;
  return new;
end;
$$;

-- ============================================================
-- 2. RLS POLICIES — drop and recreate with (select auth.uid())
-- ============================================================

-- blog_posts
DROP POLICY IF EXISTS "Users manage own blog_posts" ON public.blog_posts;
CREATE POLICY "Users manage own blog_posts" ON public.blog_posts
  FOR ALL USING (
    brand_id IN (SELECT bp.id FROM brand_profiles bp WHERE bp.user_id = (select auth.uid()))
  );

-- brand_kpis
DROP POLICY IF EXISTS "brand_kpis: owner access" ON public.brand_kpis;
CREATE POLICY "brand_kpis: owner access" ON public.brand_kpis
  FOR ALL USING (
    brand_id IN (SELECT bp.id FROM brand_profiles bp WHERE bp.user_id = (select auth.uid()))
  );

-- brand_profiles
DROP POLICY IF EXISTS "Users manage their own brands" ON public.brand_profiles;
CREATE POLICY "Users manage their own brands" ON public.brand_profiles
  FOR ALL USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- calendar_entries
DROP POLICY IF EXISTS "Users manage calendar entries for their brands" ON public.calendar_entries;
CREATE POLICY "Users manage calendar entries for their brands" ON public.calendar_entries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles bp WHERE bp.id = calendar_entries.brand_id AND bp.user_id = (select auth.uid()))
  );

-- campaigns
DROP POLICY IF EXISTS "owner manages campaigns" ON public.campaigns;
CREATE POLICY "owner manages campaigns" ON public.campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = campaigns.brand_id AND brand_profiles.user_id = (select auth.uid()))
  );

-- competitor_posts
DROP POLICY IF EXISTS "Users view posts for their brands" ON public.competitor_posts;
CREATE POLICY "Users view posts for their brands" ON public.competitor_posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles bp WHERE bp.id = competitor_posts.brand_id AND bp.user_id = (select auth.uid()))
  );

-- competitors
DROP POLICY IF EXISTS "Users manage competitors for their brands" ON public.competitors;
CREATE POLICY "Users manage competitors for their brands" ON public.competitors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles bp WHERE bp.id = competitors.brand_id AND bp.user_id = (select auth.uid()))
  );

-- content_pillars
DROP POLICY IF EXISTS "owner manages pillars" ON public.content_pillars;
CREATE POLICY "owner manages pillars" ON public.content_pillars
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = content_pillars.brand_id AND brand_profiles.user_id = (select auth.uid()))
  );

-- generated_content
DROP POLICY IF EXISTS "Users manage generated content for their brands" ON public.generated_content;
CREATE POLICY "Users manage generated content for their brands" ON public.generated_content
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles bp WHERE bp.id = generated_content.brand_id AND bp.user_id = (select auth.uid()))
  );

-- niche_research_cache
DROP POLICY IF EXISTS "Users manage research cache for their brands" ON public.niche_research_cache;
CREATE POLICY "Users manage research cache for their brands" ON public.niche_research_cache
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles bp WHERE bp.id = niche_research_cache.brand_id AND bp.user_id = (select auth.uid()))
  );

-- platform_connections
DROP POLICY IF EXISTS "owner manages connections" ON public.platform_connections;
CREATE POLICY "owner manages connections" ON public.platform_connections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = platform_connections.brand_id AND brand_profiles.user_id = (select auth.uid()))
  );

-- post_metrics
DROP POLICY IF EXISTS "owner manages post metrics" ON public.post_metrics;
CREATE POLICY "owner manages post metrics" ON public.post_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = post_metrics.brand_id AND brand_profiles.user_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = post_metrics.brand_id AND brand_profiles.user_id = (select auth.uid()))
  );

-- reply_templates
DROP POLICY IF EXISTS "owner manages reply templates" ON public.reply_templates;
CREATE POLICY "owner manages reply templates" ON public.reply_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = reply_templates.brand_id AND brand_profiles.user_id = (select auth.uid()))
  );

-- review_snapshots
DROP POLICY IF EXISTS "Users manage own review_snapshots" ON public.review_snapshots;
CREATE POLICY "Users manage own review_snapshots" ON public.review_snapshots
  FOR ALL USING (
    brand_id IN (SELECT bp.id FROM brand_profiles bp WHERE bp.user_id = (select auth.uid()))
  );

-- saved_hooks
DROP POLICY IF EXISTS "Users manage hooks for their brands" ON public.saved_hooks;
CREATE POLICY "Users manage hooks for their brands" ON public.saved_hooks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles bp WHERE bp.id = saved_hooks.brand_id AND bp.user_id = (select auth.uid()))
  );

-- seo_audit_items
DROP POLICY IF EXISTS "Users manage own seo_audit_items" ON public.seo_audit_items;
CREATE POLICY "Users manage own seo_audit_items" ON public.seo_audit_items
  FOR ALL USING (
    brand_id IN (SELECT bp.id FROM brand_profiles bp WHERE bp.user_id = (select auth.uid()))
  );

-- seo_keywords
DROP POLICY IF EXISTS "Users manage own seo_keywords" ON public.seo_keywords;
CREATE POLICY "Users manage own seo_keywords" ON public.seo_keywords
  FOR ALL USING (
    brand_id IN (SELECT bp.id FROM brand_profiles bp WHERE bp.user_id = (select auth.uid()))
  );

-- share_tokens
DROP POLICY IF EXISTS "owner manages share tokens" ON public.share_tokens;
CREATE POLICY "owner manages share tokens" ON public.share_tokens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = share_tokens.brand_id AND brand_profiles.user_id = (select auth.uid()))
  );

-- tasks
DROP POLICY IF EXISTS "owner manages tasks" ON public.tasks;
CREATE POLICY "owner manages tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = tasks.brand_id AND brand_profiles.user_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = tasks.brand_id AND brand_profiles.user_id = (select auth.uid()))
  );

-- team_members
DROP POLICY IF EXISTS "owner manages team members" ON public.team_members;
CREATE POLICY "owner manages team members" ON public.team_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = team_members.brand_id AND brand_profiles.user_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM brand_profiles WHERE brand_profiles.id = team_members.brand_id AND brand_profiles.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "specialist views own membership" ON public.team_members;
CREATE POLICY "specialist views own membership" ON public.team_members
  FOR SELECT USING (
    (user_id = (select auth.uid())) OR (lower(email) = current_user_email())
  );
