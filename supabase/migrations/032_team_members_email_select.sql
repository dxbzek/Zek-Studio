-- The specialist SELECT policy on team_members only matches user_id = auth.uid(),
-- but team_members.user_id is populated lazily (on first login for older invites,
-- or via the 018 sync trigger when email_confirmed_at fires). If Karim / Mustafa
-- hit the app before their user_id was backfilled, RLS returns 0 rows from
-- team_members, so:
--   - useIsSpecialist returns false (thinks they're owners)
--   - They get routed to AppShell (owner view) with an empty brand list
--
-- Fix: widen the SELECT policy to also match by email against auth.users.
-- This mirrors the logic already used in is_brand_team_member().

drop policy if exists "specialist views own membership" on public.team_members;

create policy "specialist views own membership"
  on public.team_members
  for select
  using (
    user_id = auth.uid()
    or lower(email) = lower(
         coalesce((select email from auth.users where id = auth.uid()), '')
       )
  );
