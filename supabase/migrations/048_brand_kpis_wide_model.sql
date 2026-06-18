-- Schema-drift fix (decision: app is canonical). The live brand_kpis table had
-- drifted to a generic {platform, metric, target_value} shape, but the whole
-- app (DashboardPage KPI Goals, src/types/*) reads/writes the wide-column model
-- from migration 015. The table was empty (0 rows), so recreate it in the shape
-- the code expects. No app/type changes needed — they already match this model.

DROP TABLE IF EXISTS public.brand_kpis CASCADE;

CREATE TABLE public.brand_kpis (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          uuid NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  month             date NOT NULL,                 -- first day of month, e.g. 2026-06-01
  posts_target      int,
  views_target      bigint,
  engagement_target numeric(5,2),                  -- e.g. 4.50 = 4.5%
  keywords_target   int,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (brand_id, month)                          -- upsert onConflict target; also covers the brand_id FK
);

ALTER TABLE public.brand_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_kpis: owner access" ON public.brand_kpis
  FOR ALL
  USING      (brand_id IN (SELECT bp.id FROM public.brand_profiles bp WHERE bp.user_id = (select auth.uid())))
  WITH CHECK (brand_id IN (SELECT bp.id FROM public.brand_profiles bp WHERE bp.user_id = (select auth.uid())));
