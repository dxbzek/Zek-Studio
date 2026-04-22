-- 027 tried to check brand ownership inline inside the storage policy:
--   exists (select 1 from public.brand_profiles where id::text = (foldername(name))[1] and user_id = auth.uid())
-- In practice that subquery runs with RLS applied and failed to match during
-- INSERT, producing "new row violates row-level security policy" on upload.
--
-- Fix: push the ownership check into a SECURITY DEFINER helper so it bypasses
-- brand_profiles RLS (the function itself still checks auth.uid(), so it's
-- safe to expose). Then rewrite the storage policies to call it.

create or replace function public.user_owns_brand(p_brand_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.brand_profiles
    where id = p_brand_id and user_id = auth.uid()
  );
$$;

revoke all on function public.user_owns_brand(uuid) from public;
grant execute on function public.user_owns_brand(uuid) to authenticated;

-- ── Replace the 027 policies with helper-based versions ──────────────────────
drop policy if exists "brand avatars: owner insert" on storage.objects;
drop policy if exists "brand avatars: owner update" on storage.objects;
drop policy if exists "brand avatars: owner delete" on storage.objects;

create policy "brand avatars: owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'brand-avatars'
    and coalesce((storage.foldername(name))[1], '') <> ''
    and public.user_owns_brand(((storage.foldername(name))[1])::uuid)
  );

create policy "brand avatars: owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'brand-avatars'
    and public.user_owns_brand(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'brand-avatars'
    and public.user_owns_brand(((storage.foldername(name))[1])::uuid)
  );

create policy "brand avatars: owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'brand-avatars'
    and public.user_owns_brand(((storage.foldername(name))[1])::uuid)
  );
