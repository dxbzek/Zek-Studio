-- Regression fix: 032 added an inline subquery against auth.users inside the
-- "specialist views own membership" SELECT policy. The authenticated role
-- doesn't have SELECT privilege on auth.users, so the subquery raised a
-- permission error — which PostgREST surfaces as HTTP 403 on every single
-- team_members query (including the owner's).
--
-- Wrap the email lookup in a SECURITY DEFINER helper so the policy runs
-- under privileges that can reach auth.users safely. Mirrors the pattern
-- already used by is_brand_team_member().

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce((select email from auth.users where id = auth.uid()), ''));
$$;
revoke all on function public.current_user_email() from public;
grant execute on function public.current_user_email() to authenticated;

drop policy if exists "specialist views own membership" on public.team_members;
create policy "specialist views own membership"
  on public.team_members
  for select
  using (
    user_id = auth.uid()
    or lower(email) = public.current_user_email()
  );
