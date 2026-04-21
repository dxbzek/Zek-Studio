-- ============================================================
-- Zek Studio — Auto-sync team_members acceptance with auth.users
-- Bug: team_members.accepted_at was never set when invitees confirmed
-- their Supabase auth invite, so the Team page always showed "Pending".
-- ============================================================

create or replace function public.sync_team_member_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null then
    update public.team_members
    set user_id     = new.id,
        accepted_at = coalesce(accepted_at, new.email_confirmed_at, now())
    where lower(email) = lower(new.email)
      and (user_id is null or accepted_at is null);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_acceptance on auth.users;
create trigger on_auth_user_acceptance
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.sync_team_member_acceptance();

-- Backfill anyone who already confirmed before this trigger existed
update public.team_members tm
set user_id     = u.id,
    accepted_at = coalesce(tm.accepted_at, u.email_confirmed_at, now())
from auth.users u
where lower(tm.email) = lower(u.email)
  and u.email_confirmed_at is not null
  and (tm.user_id is null or tm.accepted_at is null);
