-- Pass L: medium-polish items from the round-2 audit.
-- 1) Scope competitor-thumbnails storage writes to authenticated users only.
--    The original policy was FOR ALL with no role target, so anon INSERTs were
--    attempted and rejected by RLS further upstream — noisy, not a real leak.
-- 2) Replace post_metrics (brand_id, platform, post_url) UNIQUE with a PARTIAL
--    unique index that excludes rows where post_url IS NULL. Postgres treats
--    NULLs as distinct, so the plain UNIQUE allowed duplicate "no-URL" rows to
--    accumulate; the partial index only enforces when a URL is present.

-- ── Storage policies ─────────────────────────────────────────────────────────
drop policy if exists "Service role manages competitor thumbnails" on storage.objects;

create policy "Authenticated writes competitor thumbnails"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'competitor-thumbnails');

create policy "Authenticated updates competitor thumbnails"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'competitor-thumbnails')
  with check (bucket_id = 'competitor-thumbnails');

create policy "Authenticated deletes competitor thumbnails"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'competitor-thumbnails');

-- ── post_metrics unique → partial unique ─────────────────────────────────────
alter table public.post_metrics
  drop constraint if exists post_metrics_brand_platform_url_key;

create unique index if not exists post_metrics_brand_platform_url_uidx
  on public.post_metrics (brand_id, platform, post_url)
  where post_url is not null;
