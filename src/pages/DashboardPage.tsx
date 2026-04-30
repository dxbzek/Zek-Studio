import { useState, useMemo } from 'react'
import { Briefcase, ArrowRight, TrendingUp, TrendingDown, Minus, Target, Sparkles, CalendarDays, Eye, Users } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { Link } from 'react-router-dom'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveBrand } from '@/stores/activeBrand'
import { useBrands } from '@/hooks/useBrands'
import { usePostMetrics } from '@/hooks/usePostMetrics'
import { useSeoKeywords, useBlogPosts } from '@/hooks/useSeo'
import { supabase } from '@/lib/supabase'
import { fmtCompact, isInMonth } from '@/lib/formatting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { PostMetric, BrandKpi } from '@/types'

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 1) return <Minus className="h-3 w-3 text-muted-foreground" />
  return pct > 0
    ? <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-[10.5px] font-semibold tabular-nums"><TrendingUp className="h-3 w-3" />{pct.toFixed(0)}%</span>
    : <span className="flex items-center gap-0.5 text-red-500 text-[10.5px] font-semibold tabular-nums"><TrendingDown className="h-3 w-3" />{Math.abs(pct).toFixed(0)}%</span>
}

function KpiTile({
  label, value, sub, trend,
}: { label: string; value: string; sub?: string; trend?: React.ReactNode }) {
  return (
    <div className="premium-card group relative overflow-hidden rounded-xl ring-1 ring-border/80 p-4 transition-all duration-300 ease-out hover:-translate-y-px hover:ring-border motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500">
      {/* Soft radial accent in the corner — adds depth without color */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-60 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in oklch, var(--accent) 65%, transparent) 0%, transparent 75%)',
        }}
      />
      <div className="relative eyebrow mb-2">{label}</div>
      <div
        className="relative mono-num text-[30px] leading-[1.1] font-medium"
        style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.025em' }}
      >
        {value}
      </div>
      {sub && <div className="relative text-[11px] text-muted-foreground mt-1">{sub}</div>}
      {trend && (
        <div className="absolute top-4 right-4">{trend}</div>
      )}
    </div>
  )
}

function GoalBar({ label, actual, target, fmtFn }: {
  label: string; actual: number; target: number; fmtFn: (n: number) => string
}) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
  const reached = pct >= 100
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-foreground">{label}</span>
        <span className="mono-num text-[11px] text-muted-foreground tabular-nums">
          {fmtFn(actual)} <span className="text-muted-foreground/50">/</span> {fmtFn(target)}
          <span className={`ml-1.5 text-[10px] font-semibold tabular-nums ${reached ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/70'}`}>
            {pct}%
          </span>
        </span>
      </div>
      <div className="relative h-[5px] w-full rounded-full bg-muted overflow-hidden ring-1 ring-inset ring-border/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-foreground/85 to-foreground transition-all duration-700 ease-out shadow-[0_0_8px_-2px_color-mix(in_oklch,var(--foreground)_40%,transparent)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function useKpis(brandId: string | null) {
  const { metrics } = usePostMetrics(brandId)
  const { keywords } = useSeoKeywords(brandId)
  const { posts: blogPosts } = useBlogPosts(brandId)

  return useMemo(() => {
    const all: PostMetric[] = metrics.data ?? []
    const now = new Date()
    const cm = now.getMonth(), cy = now.getFullYear()
    const lm = cm === 0 ? 11 : cm - 1, ly = cm === 0 ? cy - 1 : cy

    const thisMonth = all.filter((m) => isInMonth(m.posted_at, cm, cy))
    const lastMonth = all.filter((m) => isInMonth(m.posted_at, lm, ly))
    const viewsThis = thisMonth.reduce((s, m) => s + (m.views ?? 0), 0)
    const viewsLast = lastMonth.reduce((s, m) => s + (m.views ?? 0), 0)

    const engRates = thisMonth.map((m) => {
      const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0)
      const base = m.reach ?? m.impressions ?? m.views
      return base ? (eng / base) * 100 : null
    }).filter((v): v is number => v !== null)
    const avgEng = engRates.length ? engRates.reduce((a, b) => a + b, 0) / engRates.length : null

    const rankingKw = (keywords ?? []).filter((k) => k.status === 'page_1_2').length
    const totalKw = (keywords ?? []).length
    const blogPublished = (blogPosts ?? []).filter(
      (p) => p.status === 'published' && isInMonth(p.publish_date, cm, cy),
    ).length

    return { postsThis: thisMonth.length, postsLast: lastMonth.length, viewsThis, viewsLast, avgEng, rankingKw, totalKw, blogPublished }
  }, [metrics.data, keywords, blogPosts])
}

const QUICK_ACTIONS = [
  { to: '/content', icon: Sparkles, label: 'Draft a hook' },
  { to: '/calendar', icon: CalendarDays, label: 'Schedule post' },
  { to: '/research?tab=competitors', icon: Eye, label: 'Run audit' },
  { to: '/workspace', icon: Users, label: 'Invite teammate' },
  { to: '/research', icon: TrendingUp, label: 'Niche research' },
]

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export function DashboardPage() {
  const { activeBrand } = useActiveBrand()
  const { brands, isLoading } = useBrands()
  const kpis = useKpis(activeBrand?.id ?? null)
  const currentMonthISO = useMemo(() => format(new Date(), 'yyyy-MM-01'), [])

  // ── Weekly digest ────────────────────────────────────────────────────────
  // Single round-trip for this week's calendar entries, counted into four
  // buckets the dashboard card displays. Starts the week on Sunday to match
  // the calendar grid so the numbers line up with what the user sees there.
  const weekRange = useMemo(() => {
    const now = new Date()
    return {
      start: format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      end:   format(endOfWeek  (now, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
    }
  }, [])
  const weeklyDigest = useQuery({
    queryKey: ['dashboard-week', activeBrand?.id, weekRange.start],
    queryFn: async () => {
      if (!activeBrand?.id) return null
      const { data, error } = await supabase
        .from('calendar_entries')
        .select('status, approval_status, scheduled_date')
        .eq('brand_id', activeBrand.id)
        .gte('scheduled_date', weekRange.start)
        .lte('scheduled_date', weekRange.end)
      if (error) throw error
      const rows = data ?? []
      return {
        total:     rows.length,
        shipped:   rows.filter((r) => r.status === 'published').length,
        scheduled: rows.filter((r) => r.status === 'scheduled').length,
        draft:     rows.filter((r) => r.status === 'draft').length,
        inReview:  rows.filter((r) => r.approval_status === 'pending_review').length,
      }
    },
    enabled: !!activeBrand?.id,
  })

  const kpiGoalQuery = useQuery({
    queryKey: ['brand-kpi', activeBrand?.id, currentMonthISO],
    queryFn: async () => {
      if (!activeBrand?.id) return null
      const { data } = await supabase
        .from('brand_kpis').select('*')
        .eq('brand_id', activeBrand.id).eq('month', currentMonthISO).maybeSingle()
      return (data ?? null) as BrandKpi | null
    },
    enabled: !!activeBrand?.id,
  })
  const kpiGoal = kpiGoalQuery.data ?? null

  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [goalForm, setGoalForm] = useState({ posts: '', views: '', engagement: '', keywords: '' })
  const [savingGoals, setSavingGoals] = useState(false)

  function openGoalDialog() {
    setGoalForm({
      posts:      kpiGoal?.posts_target      != null ? String(kpiGoal.posts_target)      : '',
      views:      kpiGoal?.views_target      != null ? String(kpiGoal.views_target)      : '',
      engagement: kpiGoal?.engagement_target != null ? String(kpiGoal.engagement_target) : '',
      keywords:   kpiGoal?.keywords_target   != null ? String(kpiGoal.keywords_target)   : '',
    })
    setGoalDialogOpen(true)
  }

  async function handleSaveGoals() {
    if (!activeBrand) return
    setSavingGoals(true)
    try {
      const { error } = await supabase.from('brand_kpis').upsert({
        brand_id:          activeBrand.id,
        month:             currentMonthISO,
        posts_target:      goalForm.posts      ? Number(goalForm.posts)      : null,
        views_target:      goalForm.views      ? Number(goalForm.views)      : null,
        engagement_target: goalForm.engagement ? Number(goalForm.engagement) : null,
        keywords_target:   goalForm.keywords   ? Number(goalForm.keywords)   : null,
        updated_at:        new Date().toISOString(),
      }, { onConflict: 'brand_id,month' })
      if (error) throw error
      await kpiGoalQuery.refetch()
      setGoalDialogOpen(false)
      toast.success('Goals saved')
    } catch (err) {
      toast.error('Failed to save goals', { description: (err as Error).message })
    } finally {
      setSavingGoals(false)
    }
  }

  const hasAnyTarget = kpiGoal && (
    kpiGoal.posts_target != null || kpiGoal.views_target != null ||
    kpiGoal.engagement_target != null || kpiGoal.keywords_target != null
  )

  const firstName = activeBrand?.name?.split(' ')[0] || 'there'
  // Date range only changes when the day rolls over; cheap-and-correct
  // useMemo keeps the string stable across render cycles within a day.
  const greetingWeekRange = useMemo(() =>
    `${format(new Date(), 'MMM d')} – ${format(new Date(Date.now() + 6 * 86400000), 'MMM d')}`,
  [])

  if (isLoading) {
    return <LoadingState variant="dashboard" />
  }

  if (brands.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-border bg-card">
          <Briefcase className="h-8 w-8 text-foreground" />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em' }}>
            Add a brand to begin.
          </h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            One profile per client or brand you create for. Add as many as you need.
          </p>
        </div>
        <Button asChild>
          <Link to="/brands?new=1">
            Create your first brand <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Data Tape */}
      <div
        className="relative flex items-center gap-[18px] px-5 py-2.5 border-b border-border/70 overflow-hidden whitespace-nowrap shrink-0 bg-gradient-to-r from-card/40 via-transparent to-card/40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="relative inline-flex">
            <span className="inline-block size-[5px] rounded-full bg-emerald-500" style={{ boxShadow: '0 0 0 3px rgba(52,211,153,0.3)' }} />
            <span className="absolute inset-0 inline-block size-[5px] rounded-full bg-emerald-500 motion-safe:animate-ping opacity-75" />
          </span>
          Live
        </span>
        {kpis.viewsThis > 0 && <span><span className="text-muted-foreground/50">Reach</span> <span className="text-foreground/90">{fmtCompact(kpis.viewsThis)}</span></span>}
        {kpis.avgEng != null && <span><span className="text-muted-foreground/50">Eng</span> <span className="text-foreground/90">{kpis.avgEng.toFixed(1)}%</span></span>}
        <span><span className="text-muted-foreground/50">Posts</span> <span className="text-foreground/90">{kpis.postsThis}</span> this month</span>
        {kpis.rankingKw > 0 && <span><span className="text-muted-foreground/50">Keywords</span> <span className="text-foreground/90">{kpis.rankingKw}/{kpis.totalKw}</span></span>}
        {activeBrand && <span className="ml-auto text-foreground/80">{activeBrand.name}</span>}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto space-y-5">
          {/* Page header */}
          <div className="flex items-start justify-between gap-4 flex-wrap motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-500">
            <div>
              <div className="eyebrow mb-2">Weekly brief · {greetingWeekRange}</div>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                Good {timeOfDay()}, {firstName}.
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1.5">
                {activeBrand
                  ? `${activeBrand.niche} · ${activeBrand.platforms.join(', ')}`
                  : 'Select a brand to get started.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/calendar"><CalendarDays className="h-3.5 w-3.5" /> This Week</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/content"><Sparkles className="h-3.5 w-3.5" /> Generate post</Link>
              </Button>
            </div>
          </div>

          {/* KPI tiles */}
          {activeBrand && (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiTile
                label="Reach this month"
                value={fmtCompact(kpis.viewsThis)}
                sub={kpis.viewsLast > 0 ? `${fmtCompact(kpis.viewsLast)} last month` : 'No data last month'}
                trend={<TrendBadge current={kpis.viewsThis} previous={kpis.viewsLast} />}
              />
              <KpiTile
                label="Avg engagement"
                value={kpis.avgEng != null ? `${kpis.avgEng.toFixed(1)}%` : '—'}
                sub="This month"
              />
              <KpiTile
                label="Posts published"
                value={String(kpis.postsThis)}
                sub={`${kpis.postsLast} last month`}
                trend={<TrendBadge current={kpis.postsThis} previous={kpis.postsLast} />}
              />
              <KpiTile
                label="Keywords ranking"
                value={kpis.totalKw > 0 ? `${kpis.rankingKw}/${kpis.totalKw}` : '—'}
                sub="Page 1–2"
              />
            </div>
          )}

          {/* Weekly digest — at-a-glance snapshot of this week's calendar. */}
          {activeBrand && weeklyDigest.data && weeklyDigest.data.total > 0 && (
            <div className="premium-card rounded-xl ring-1 ring-border/80 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="eyebrow">This week</div>
                  <div className="text-[13px] text-muted-foreground mt-0.5">
                    {format(new Date(weekRange.start), 'MMM d')} – {format(new Date(weekRange.end), 'MMM d')}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="h-[26px] text-[11px] gap-1">
                  <Link to="/calendar">
                    <CalendarDays className="h-3 w-3" /> View calendar
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { value: weeklyDigest.data.shipped,   label: 'Shipped',   color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
                  { value: weeklyDigest.data.scheduled, label: 'Scheduled', color: '',                                       dot: 'bg-foreground/70' },
                  { value: weeklyDigest.data.inReview,  label: 'In review', color: 'text-amber-600 dark:text-amber-400',     dot: 'bg-amber-500' },
                  { value: weeklyDigest.data.draft,     label: 'Draft',     color: 'text-muted-foreground',                  dot: 'bg-muted-foreground/40' },
                ].map((tile) => (
                  <div
                    key={tile.label}
                    className="relative rounded-lg bg-muted/30 px-2 py-2 ring-1 ring-inset ring-border/30 transition-all duration-200 hover:bg-muted/50 hover:ring-border/60"
                  >
                    <span className={`absolute top-2 right-2 h-1.5 w-1.5 rounded-full ${tile.dot}`} aria-hidden />
                    <div className={`mono-num text-[20px] font-semibold tabular-nums ${tile.color}`}>
                      {tile.value}
                    </div>
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mt-0.5">{tile.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bento: Goals + Quick actions */}
          {activeBrand && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
              {/* Monthly Goals */}
              <div className="premium-card rounded-xl ring-1 ring-border/80 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                  <div>
                    <div className="eyebrow">Monthly goals</div>
                    <div className="text-[14px] font-medium mt-0.5">{format(new Date(), 'MMMM yyyy')}</div>
                  </div>
                  <Button variant="outline" size="sm" className="h-[26px] text-[11px] gap-1" onClick={openGoalDialog}>
                    <Target className="h-3 w-3" />
                    {hasAnyTarget ? 'Edit' : 'Set goals'}
                  </Button>
                </div>
                <div className="p-4">
                  {hasAnyTarget && kpiGoal ? (
                    <div className="space-y-4">
                      {kpiGoal.posts_target != null && (
                        <GoalBar label="Posts" actual={kpis.postsThis} target={kpiGoal.posts_target} fmtFn={String} />
                      )}
                      {kpiGoal.views_target != null && (
                        <GoalBar label="Reach" actual={kpis.viewsThis} target={kpiGoal.views_target} fmtFn={fmtCompact} />
                      )}
                      {kpiGoal.engagement_target != null && kpis.avgEng != null && (
                        <GoalBar label="Engagement rate" actual={kpis.avgEng} target={kpiGoal.engagement_target} fmtFn={(n) => `${n.toFixed(1)}%`} />
                      )}
                      {kpiGoal.keywords_target != null && (
                        <GoalBar label="Keywords (page 1–2)" actual={kpis.rankingKw} target={kpiGoal.keywords_target} fmtFn={String} />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-muted-foreground">Set monthly targets to track your progress.</p>
                      <Button variant="link" size="sm" className="text-[12px] h-auto p-0 ml-4" onClick={openGoalDialog}>
                        Set goals <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <nav aria-label="Quick actions" className="premium-card rounded-xl ring-1 ring-border/80 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/60">
                  <div className="eyebrow">Quick actions</div>
                </div>
                <div className="divide-y divide-border/50">
                  {QUICK_ACTIONS.map(({ to, icon: Icon, label }) => (
                    <Link
                      key={to}
                      to={to}
                      className="group/action flex items-center gap-3 px-4 h-[38px] text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-150"
                    >
                      <Icon className="h-[14px] w-[14px] shrink-0 transition-transform duration-150 group-hover/action:scale-110" aria-hidden />
                      <span className="flex-1">{label}</span>
                      <ArrowRight className="h-[11px] w-[11px] text-muted-foreground/40 transition-all duration-150 group-hover/action:translate-x-0.5 group-hover/action:text-muted-foreground" aria-hidden />
                    </Link>
                  ))}
                </div>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Goals Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Monthly Goals — {format(new Date(), 'MMMM yyyy')}</DialogTitle>
            <DialogDescription>
              Leave blank to hide that goal. Progress is calculated from your logged metrics.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { key: 'posts', label: 'Posts target', placeholder: 'e.g. 20' },
              { key: 'views', label: 'Views target', placeholder: 'e.g. 50000' },
              { key: 'engagement', label: 'Avg engagement rate (%)', placeholder: 'e.g. 4.5' },
              { key: 'keywords', label: 'Keywords ranking (page 1–2)', placeholder: 'e.g. 10' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
                <Input type="number" min={0} placeholder={placeholder}
                  value={goalForm[key as keyof typeof goalForm]}
                  onChange={(e) => setGoalForm((g) => ({ ...g, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGoalDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveGoals} disabled={savingGoals}>
              {savingGoals ? 'Saving…' : 'Save Goals'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
