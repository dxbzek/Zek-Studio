-- Add a fractional-index position column on tasks so users can drag cards
-- to reorder within a column (not just move between columns).
--
-- Using double precision + "midpoint between neighbors" lets insertions
-- happen without ever shifting other rows; each reorder is a single UPDATE
-- of the moved card. Backfill uses row_number × 1024 so there's plenty of
-- float headroom between existing tasks before any precision runs out.

alter table public.tasks
  add column if not exists sort_order double precision not null default 0;

-- Backfill per (brand_id, status) column, preserving the current created_at order.
with ranked as (
  select
    id,
    row_number() over (
      partition by brand_id, status
      order by created_at asc
    ) * 1024.0 as ord
  from public.tasks
)
update public.tasks t
set sort_order = ranked.ord
from ranked
where t.id = ranked.id
  and t.sort_order = 0;

create index if not exists tasks_brand_status_sort_idx
  on public.tasks (brand_id, status, sort_order);
