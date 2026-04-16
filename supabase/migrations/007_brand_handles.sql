-- ── Add social handle columns to brand_profiles ──────────────────────────────
-- Used for Apify-based analytics sync (no OAuth required)

alter table public.brand_profiles
  add column if not exists instagram_handle text,
  add column if not exists tiktok_handle     text,
  add column if not exists facebook_handle   text,
  add column if not exists youtube_handle    text;
