-- ============================================================
-- Zek Studio — Pass H: policy tightening
-- 1. `is_brand_team_member` now requires `accepted_at IS NOT NULL`
--    (unaccepted invites no longer grant access if the invitee
--    later registers that email).
-- 2. Remove the specialist DELETE policy on calendar_entries —
--    specialists are content creators, not admins. Only brand
--    owners should be able to delete entries.
-- ============================================================

-- ─── 1. Harden is_brand_team_member ──────────────────────────────────────────
create or replace function public.is_brand_team_member(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.brand_id = p_brand_id
      and tm.accepted_at is not null
      and (
        tm.user_id = auth.uid()
        or lower(tm.email) = lower(
             coalesce((select email from auth.users where id = auth.uid()), '')
           )
      )
  );
$$;

-- ─── 2. Revoke specialist delete rights on calendar_entries ─────────────────
drop policy if exists "specialist deletes brand calendar" on public.calendar_entries;
