-- Brand avatars storage bucket.
--
-- Public read (so <img> tags work anonymously on public share pages), but
-- writes are scoped to the brand owner: the first path segment of the object
-- name must be a brand_id owned by auth.uid(). Upload convention:
--   brand-avatars/{brand_id}/avatar-{timestamp}.{ext}
--
-- Idempotent: bucket insert has ON CONFLICT, policies use drop-if-exists.

insert into storage.buckets (id, name, public)
values ('brand-avatars', 'brand-avatars', true)
on conflict (id) do nothing;

-- ── Public read ──────────────────────────────────────────────────────────────
drop policy if exists "brand avatars: public read" on storage.objects;
create policy "brand avatars: public read"
  on storage.objects
  for select
  using (bucket_id = 'brand-avatars');

-- ── Owner-only writes, scoped by path prefix ─────────────────────────────────
drop policy if exists "brand avatars: owner insert" on storage.objects;
create policy "brand avatars: owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'brand-avatars'
    and exists (
      select 1 from public.brand_profiles bp
      where bp.id::text = (storage.foldername(name))[1]
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "brand avatars: owner update" on storage.objects;
create policy "brand avatars: owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'brand-avatars'
    and exists (
      select 1 from public.brand_profiles bp
      where bp.id::text = (storage.foldername(name))[1]
        and bp.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'brand-avatars'
    and exists (
      select 1 from public.brand_profiles bp
      where bp.id::text = (storage.foldername(name))[1]
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "brand avatars: owner delete" on storage.objects;
create policy "brand avatars: owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'brand-avatars'
    and exists (
      select 1 from public.brand_profiles bp
      where bp.id::text = (storage.foldername(name))[1]
        and bp.user_id = auth.uid()
    )
  );
