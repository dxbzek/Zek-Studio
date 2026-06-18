# Schema drift report — repo migrations vs. live database

_Generated 2026-06-18 by reconciling `supabase/migrations/*` and `src/types/*`
against the live **Zek Studio** project (`otyksdmlepmhqwsyxvsn`) via DB
introspection. No `supabase` CLI is available in this environment, so this was
done through direct introspection rather than `supabase db pull`._

The live database is the source of truth. The points below are places where the
repo (migration files and/or TypeScript types and/or app code) disagrees with
what is actually deployed.

## 1. Recovered out-of-band migration ✅ fixed

The live migration history contained one migration with **no file in the repo**:

| Remote version  | Name                                  | Status |
| --------------- | ------------------------------------- | ------ |
| `20260527110548`| `fix_rls_initplan_auth_uid_subselect` | Recovered → `043a_fix_rls_initplan_auth_uid_subselect.sql` |

It wraps `auth.uid()` in `(select auth.uid())` across all RLS policies and pins
`search_path = ''` on the SECURITY DEFINER helpers. It was applied directly to
production and never committed. The file is numbered `043a` because it ran
between `043` (2026-05-27) and `044` (2026-06-08); its canonical remote version
is `20260527110548`.

> Note: the repo numbers migrations `NNN_name`, but the remote records `044`/
> `045`/`046`/`047` under timestamp versions (`20260608…`, `20260618…`). The
> file-name ↔ remote-version mapping is cosmetic, but worth aligning if the team
> adopts `supabase db push`.

## 2. `brand_kpis` — ✅ fixed (migration 048)

**Resolved:** decision was "app is canonical". The empty live table was recreated
in the wide-column model the app expects via
`048_brand_kpis_wide_model.sql` (`month, posts_target, views_target,
engagement_target, keywords_target`, `UNIQUE(brand_id, month)`). No app/type
changes were needed — they already matched. Original drift detail below for
history.



| Source                              | Shape |
| ----------------------------------- | ----- |
| **Live DB**                         | `id, brand_id, platform, metric, target_value, created_at, updated_at` (generic key/value) |
| Repo migration `015_kpi_goals_growth.sql` | `id, brand_id, month, posts_target, views_target, engagement_target, keywords_target, …` (wide columns) |
| `src/types/index.ts` (`BrandKpi`) + `src/types/supabase.ts` | wide columns (`posts_target`, …) |
| `src/pages/DashboardPage.tsx` (`.from('brand_kpis')` select + upsert) | wide columns (`posts_target`, …) |

The table was redefined in the DB to the generic `{platform, metric,
target_value}` model, but `DashboardPage` still reads/writes
`posts_target/views_target/engagement_target/keywords_target` — columns that no
longer exist. **The "KPI Goals" upsert therefore fails at runtime**, the same
failure class as the `growth_snapshots` bug (#16).

**Needs a product decision** before fixing (see open question at bottom). This
is why `src/types/supabase.ts` cannot simply be regenerated from the live DB
yet — doing so would (correctly) make `DashboardPage` fail to compile.

## 3. `growth_snapshots` — ✅ fixed (#16)

Defined in `015` but never applied live; recreated by migration
`047_create_growth_snapshots.sql`.

## 4. `content_themes` — migration `014` table absent from live

`014_content_themes.sql` defines a `content_themes` table that **does not exist
in the live DB** and is **not referenced anywhere in `src/`**. Likely created
then dropped, or superseded by the `content_pillars` table. No action needed,
but the migration file no longer reflects reality.

## 5. Hand-maintained types are stale

`src/types/supabase.ts` is hand-written (not generated) and lags the live
schema: it was missing the entire SEO module (`seo_keywords`, `blog_posts`,
`seo_audit_items`, `review_snapshots`) and carries the wrong `brand_kpis` shape.
Once #2 is resolved, regenerate it from the live DB and drop the `as any` casts
in `src/hooks/useSeo.ts` and `src/hooks/useTeam.ts`.

> **Resolved:** decision was **A — app is canonical**. The empty `brand_kpis`
> table was recreated in the wide-column model (`048_brand_kpis_wide_model.sql`),
> and the stale types were regenerated from the live DB (item 5 above is also
> resolved — the SEO tables were added and the `as any` casts dropped).

---

## Performance advisories — decisions (won't-fix / partial)

The Supabase performance advisor flags a few items that were reviewed and
**intentionally not (fully) actioned** — they are low-value at this app's scale
and/or carry production risk that outweighs the benefit:

- **`unused_index` (0005)** — the 4 app-table indexes were dropped
  (`049_drop_unused_app_indexes.sql`). The `dld_market.idx_dlm_*` indexes are
  **kept**: that table is an out-of-band reference dataset, plausibly indexed for
  ad-hoc SQL analysis.
- **`extension_in_public` (0014) — `pg_net`** — **not moved.** Cron job #1 calls
  `net.http_post(...)` for the weekly competitor auto-sync; relocating the
  extension risks breaking it for a minor hardening advisory.
- **`multiple_permissive_policies` (0006)** — **not consolidated.** Merging the
  per-table `owner ALL` + per-action team-role policies into single OR'd
  policies is a rewrite of live multi-tenant access control for a negligible
  perf gain at this scale; the data-leak/lockout risk isn't worth it here.
