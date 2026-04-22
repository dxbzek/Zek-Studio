-- Pass M — audit fixes across several tables.
--
-- 1. Campaigns trigger was calling a non-existent function
--    (update_updated_at_column) — the actual helper is public.set_updated_at.
--    Result: campaigns.updated_at has been frozen at insert time since phase 8.
--
-- 2. blog_posts and brand_kpis both declare updated_at columns but never had
--    a trigger attached, so the column never moves. Add the standard one.
--
-- 3. share_tokens exposed every row to anon clients with `using (true)`. Edge
--    functions use the service role and bypass RLS, so the anon policy was
--    only a token-enumeration surface. Drop it.
--
-- 4. platform_connections.platform CHECK only allowed 4 networks but the
--    Platform enum in TS (and the UI) already treats LinkedIn + Twitter as
--    connectable. Widen the CHECK so LinkedIn OAuth can ship without a
--    migration gap.
--
-- 5. oauth_states was created without RLS and without an FK on brand_id.
--    Lock it to no-direct-access (service role still bypasses RLS) and add
--    the cascade so deleted brands don't leak orphan rows.
--
-- 6. team_members had a unique(brand_id, email) but not unique(brand_id, user_id).
--    After invite acceptance, the same user could end up on a brand twice.
--    Add a partial unique index.
--
-- 7. calendar_entries.character had no CHECK constraint. Tighten to mirror
--    the CHARACTERS tuple in src/types/index.ts.
--
-- 8. sync_calendar_status_from_task() had no fixed search_path — pin to public.
--
-- 9. campaigns had no CHECK that end_date >= start_date. Enforce.
--
-- Idempotent: everything uses drop-if-exists or is no-op if already applied.

-- ─── 1. Fix campaigns updated_at trigger ─────────────────────────────────────
drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ─── 2. Add missing updated_at triggers ──────────────────────────────────────
drop trigger if exists blog_posts_updated_at on public.blog_posts;
create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

drop trigger if exists brand_kpis_updated_at on public.brand_kpis;
create trigger brand_kpis_updated_at
  before update on public.brand_kpis
  for each row execute function public.set_updated_at();

-- ─── 3. Remove anon enumeration on share_tokens ──────────────────────────────
-- Edge functions (get-report-data, submit-approval) use the service role and
-- bypass RLS. Owners keep the "owner manages share tokens" policy from 008.
drop policy if exists "public read share tokens" on public.share_tokens;

-- ─── 4. Widen platform_connections CHECK to cover all Platform values ────────
alter table public.platform_connections
  drop constraint if exists platform_connections_platform_check;
alter table public.platform_connections
  add constraint platform_connections_platform_check
  check (platform in ('instagram','facebook','tiktok','youtube','linkedin','twitter'));

-- ─── 5. Lock oauth_states down ───────────────────────────────────────────────
-- Service role bypasses RLS, so edge functions that manage the OAuth dance
-- keep working. Authenticated + anon callers get zero rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'oauth_states_brand_fk'
  ) then
    alter table public.oauth_states
      add constraint oauth_states_brand_fk
      foreign key (brand_id) references public.brand_profiles(id) on delete cascade;
  end if;
end $$;

alter table public.oauth_states enable row level security;
drop policy if exists "no direct access" on public.oauth_states;
create policy "no direct access" on public.oauth_states
  for all using (false) with check (false);

-- ─── 6. Dedupe team_members by (brand, user), then enforce ───────────────────
-- Keep the earliest accepted row per (brand_id, user_id); delete the rest.
with ranked as (
  select id,
    row_number() over (
      partition by brand_id, user_id
      order by accepted_at asc nulls last, invited_at asc
    ) as rn
  from public.team_members
  where user_id is not null
)
delete from public.team_members
where id in (select id from ranked where rn > 1);

create unique index if not exists team_members_brand_user_uidx
  on public.team_members(brand_id, user_id)
  where user_id is not null;

-- ─── 7. Enforce calendar_entries.character enum at the DB layer ──────────────
-- Null stays allowed (entries without a cast assignment).
alter table public.calendar_entries
  drop constraint if exists calendar_entries_character_check;
alter table public.calendar_entries
  add constraint calendar_entries_character_check
  check (
    character is null
    or character in ('Edna','Nikhil','Imran','Khuram','Ibrahim','Elliot','Keeley')
  );

-- ─── 8. Pin search_path on sync trigger function ─────────────────────────────
create or replace function public.sync_calendar_status_from_task()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.calendar_entry_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  update public.calendar_entries
  set status = case new.status
      when 'done'      then 'published'
      when 'scheduled' then 'scheduled'
      else 'draft'
    end
  where id = new.calendar_entry_id;
  return new;
end;
$$;

-- ─── 9. campaigns: forbid end_date < start_date ──────────────────────────────
alter table public.campaigns
  drop constraint if exists campaigns_date_order_check;
alter table public.campaigns
  add constraint campaigns_date_order_check
  check (start_date is null or end_date is null or end_date >= start_date);
