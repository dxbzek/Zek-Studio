-- Backfill acceptance for specific invites whose auth sync may have been
-- missed (e.g., signed up via OAuth where email_confirmed_at was set by a
-- different path than the trigger in 018 expected).
--
-- This is a one-off data migration. It's idempotent (only touches rows that
-- still have user_id NULL or accepted_at NULL).
--
-- Scoped to karimm@erehomes.ae + mustafa@erehomes.ae; Abdul brand untouched.

update public.team_members tm
set
  user_id     = coalesce(tm.user_id, u.id),
  accepted_at = coalesce(tm.accepted_at, u.email_confirmed_at, now())
from auth.users u
where lower(tm.email) in ('karimm@erehomes.ae', 'mustafa@erehomes.ae')
  and lower(u.email) = lower(tm.email);

-- If either of them hasn't created an auth account yet, still flip
-- accepted_at so when they DO sign up, the trigger does the rest and RLS
-- doesn't block the useBrands query in the meantime. (The email-fallback
-- branch in is_brand_team_member matches by lower(tm.email) even without
-- user_id, as long as accepted_at is set.)
update public.team_members
set accepted_at = coalesce(accepted_at, now())
where lower(email) in ('karimm@erehomes.ae', 'mustafa@erehomes.ae')
  and accepted_at is null;
