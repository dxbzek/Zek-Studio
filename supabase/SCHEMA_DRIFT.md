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

## 2. `brand_kpis` — ⚠️ live table and app code disagree (Dashboard KPI Goals is broken)

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

---

## Open question (blocks #2 and the type regen)

Which `brand_kpis` model is canonical?

- **A — App is right:** migrate the live table back to the wide-column model
  (`posts_target`, `views_target`, `engagement_target`, `keywords_target`,
  `month`). Restores the Dashboard KPI Goals feature as designed.
- **B — DB is right:** rewrite `DashboardPage` + types to the generic
  `{platform, metric, target_value}` model.

No code or schema change has been made for `brand_kpis` pending this decision.
