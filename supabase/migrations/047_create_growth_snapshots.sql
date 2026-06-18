-- Schema-drift fix: the `growth_snapshots` table defined in migration 015 was
-- never applied to this project, yet both the Analytics "Follower Growth" chart
-- (src/pages/AnalyticsPage.tsx) and the sync-brand-analytics edge function
-- read/write it. Create it to match the code's expectations exactly:
--   read : select platform, followers, recorded_at where brand_id/recorded_at
--   write: upsert {brand_id, platform, followers, recorded_at}
--          onConflict (brand_id, platform, recorded_at)
-- RLS mirrors the sibling analytics tables (post_metrics / brand_kpis): owner-only.

CREATE TABLE IF NOT EXISTS public.growth_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  platform    text NOT NULL,
  followers   bigint NOT NULL,
  recorded_at date NOT NULL DEFAULT current_date,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (brand_id, platform, recorded_at) -- also covers the brand_id FK lookup
);

ALTER TABLE public.growth_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brand owner manages growth snapshots" ON public.growth_snapshots;
CREATE POLICY "Brand owner manages growth snapshots"
  ON public.growth_snapshots
  FOR ALL
  USING      (brand_id IN (SELECT id FROM public.brand_profiles WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (brand_id IN (SELECT id FROM public.brand_profiles WHERE user_id = (SELECT auth.uid())));
