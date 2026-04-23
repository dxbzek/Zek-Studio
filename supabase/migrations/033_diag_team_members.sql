-- Diagnostic: count team_members and list (email, brand, role, accepted?) to
-- verify the rows really exist. Output appears as NOTICE lines in db push.
-- This file does not modify schema; safe to reapply or delete afterwards.

do $$
declare
  total int;
  rec record;
begin
  select count(*) into total from public.team_members;
  raise notice '[diag] total team_members rows = %', total;

  for rec in
    select
      tm.email,
      tm.role,
      tm.accepted_at is not null as accepted,
      tm.user_id is not null as has_user_id,
      bp.name as brand
    from public.team_members tm
    join public.brand_profiles bp on bp.id = tm.brand_id
    order by tm.email, bp.name
  loop
    raise notice '[diag] % | % | role=% | accepted=% | user_id=%', rec.email, rec.brand, rec.role, rec.accepted, rec.has_user_id;
  end loop;

  -- Also count the existing SELECT policies on team_members so we catch any
  -- accidental drop.
  for rec in
    select polname, polcmd
    from pg_policy
    where polrelid = 'public.team_members'::regclass
    order by polname
  loop
    raise notice '[diag] policy % (cmd=%)', rec.polname, rec.polcmd;
  end loop;
end $$;
