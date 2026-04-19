import { useState, useMemo } from 'react'
import { Briefcase, Users, Sparkles, CalendarDays, TrendingUp, ArrowRight, TrendingDown, Minus, Lock, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveBrand } from '@/stores/activeBrand'
import { useBrands } from '@/hooks/useBrands'
import { usePostMetrics } from '@/hooks/usePostMetrics'
import { useSeoKeywords, useBlogPosts } from '@/hooks/useSeo'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { PostMetric, BrandKpi } from '@/types'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 1) return <Minus className="h-3 w-3 text-muted-foreground" />
  return pct > 0
    ? <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 text-xs font-medium"><TrendingUp className="h-3 w-3" />{pct.toFixed(0)}%</span>
    : <span className="flex items-center gap-0.5 text-red-500 text-xs font-medium"><TrendingDown className="h-3 w-3" />{Math.abs(pct).toFixed(0)}%</span>
}

function KpiCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {trend}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function GoalBar({
  label,
  actual,
  target,
  fmtFn,
}: {
  label: string
  actual: number
  target: number
  fmtFn: (n: number) => string
}) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${textColor}`}>
          {fmtFn(actual)} / {fmtFn(target)} <span className="text-muted-foreground font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
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

    const inMonth = (m: PostMetric, month: number, year: number) => {
      if (!m.posted_at) return false
      const d = new Date(m.posted_at + 'T00:00:00')
      return d.getMonth() === month && d.getFullYear() === year
    }

    const thisMonth = all.filter((m) => inMonth(m, cm, cy))
    const lastMonth = all.filter((m) => inMonth(m, lm, ly))

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

    const blogPublished = (blogPosts ?? []).filter((p) => {
      if (p.status !== 'published' || !p.publish_date) return false
      const d = new Date(p.publish_date + 'T00:00:00')
      return d.getMonth() === cm && d.getFullYear() === cy
    }).length

    return { postsThis: thisMonth.length, postsLast: lastMonth.length, viewsThis, viewsLast, avgEng, rankingKw, totalKw, blogPublished }
  }, [metrics.data, keywords, blogPosts])
}

const QUICK_ACTIONS = [
  {
    to: '/competitors',
    icon: Users,
    title: 'Research Competitors',
    description: 'Paste a handle and surface top posts',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    to: '/research',
    icon: TrendingUp,
    title: 'Niche Research',
    description: 'Discover trending topics in your niche',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    to: '/generator',
    icon: Sparkles,
    title: 'Generate Content',
    description: 'AI hooks, captions, and ideas',
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  {
    to: '/calendar',
    icon: CalendarDays,
    title: 'Content Calendar',
    description: 'Schedule and manage your content',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
]

export function DashboardPage() {
  const { activeBrand } = useActiveBrand()
  const { brands, isLoading } = useBrands()
  const kpis = useKpis(activeBrand?.id ?? null)
  const currentMonthISO = useMemo(() => format(new Date(), 'yyyy-MM-01'), [])

  // ── KPI Goals ──────────────────────────────────────────────────────────────

  const kpiGoalQuery = useQuery({
    queryKey: ['brand-kpi', activeBrand?.id, currentMonthISO],
    queryFn: async () => {
      if (!activeBrand?.id) return null
      const { data } = await supabase
        .from('brand_kpis')
        .select('*')
        .eq('brand_id', activeBrand.id)
        .eq('month', currentMonthISO)
        .maybeSingle()
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
    kpiGoal.posts_target != null ||
    kpiGoal.views_target != null ||
    kpiGoal.engagement_target != null ||
    kpiGoal.keywords_target != null
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (brands.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Briefcase className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome to Zek Studio</h2>
          <p className="mt-2 text-muted-foreground">
            Create your first brand profile to get started with AI-powered content intelligence.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/brands?new=1">
            Create your first brand
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {activeBrand ? activeBrand.name : 'Dashboard'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {activeBrand
            ? `${activeBrand.niche} · ${activeBrand.platforms.join(', ')}`
            : 'Select a brand from the sidebar to get started.'}
        </p>
        {activeBrand && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeBrand.platforms.map((p) =>
              p === 'linkedin' ? (
                <Badge
                  key={p}
                  variant="secondary"
                  className="capitalize text-xs opacity-50 cursor-not-allowed gap-1"
                  title="LinkedIn analytics coming soon"
                >
                  <Lock className="h-2.5 w-2.5" />
                  {p}
                </Badge>
              ) : (
                <Link key={p} to={`/analytics?platform=${p}`}>
                  <Badge variant="secondary" className="capitalize text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors">
                    {p}
                  </Badge>
                </Link>
              )
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {activeBrand && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiCard
            label="Posts this month"
            value={String(kpis.postsThis)}
            sub={kpis.postsLast > 0 ? `${kpis.postsLast} last month` : 'No data last month'}
            trend={<Trend current={kpis.postsThis} previous={kpis.postsLast} />}
          />
          <KpiCard
            label="Views this month"
            value={fmt(kpis.viewsThis)}
            sub={kpis.viewsLast > 0 ? `${fmt(kpis.viewsLast)} last month` : 'No data last month'}
            trend={<Trend current={kpis.viewsThis} previous={kpis.viewsLast} />}
          />
          <KpiCard
            label="Avg engagement"
            value={kpis.avgEng != null ? `${kpis.avgEng.toFixed(1)}%` : '—'}
            sub="This month"
          />
          <KpiCard
            label="Keywords ranking"
            value={kpis.totalKw > 0 ? `${kpis.rankingKw}/${kpis.totalKw}` : '—'}
            sub="Page 1–2"
          />
          <KpiCard
            label="Blog published"
            value={String(kpis.blogPublished)}
            sub="This month"
          />
        </div>
      )}

      {/* Monthly Goals */}
      {activeBrand && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Monthly Goals</p>
              <p className="text-xs text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={openGoalDialog}>
              <Target className="h-3 w-3" />
              {hasAnyTarget ? 'Edit Goals' : 'Set Goals'}
            </Button>
          </div>
          <div className="p-4">
            {hasAnyTarget ? (
              <div className="space-y-4">
                {kpiGoal!.posts_target != null && (
                  <GoalBar
                    label="Posts this month"
                    actual={kpis.postsThis}
                    target={kpiGoal!.posts_target}
                    fmtFn={String}
                  />
                )}
                {kpiGoal!.views_target != null && (
                  <GoalBar
                    label="Total views"
                    actual={kpis.viewsThis}
                    target={kpiGoal!.views_target}
                    fmtFn={fmt}
                  />
                )}
                {kpiGoal!.engagement_target != null && kpis.avgEng != null && (
                  <GoalBar
                    label="Avg engagement rate"
                    actual={kpis.avgEng}
                    target={kpiGoal!.engagement_target}
                    fmtFn={(n) => `${n.toFixed(1)}%`}
                  />
                )}
                {kpiGoal!.engagement_target != null && kpis.avgEng == null && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Avg engagement rate</span>
                      <span className="text-muted-foreground">Target: {kpiGoal!.engagement_target}% · No data yet</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted" />
                  </div>
                )}
                {kpiGoal!.keywords_target != null && (
                  <GoalBar
                    label="Keywords ranking (page 1–2)"
                    actual={kpis.rankingKw}
                    target={kpiGoal!.keywords_target}
                    fmtFn={String}
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Set monthly targets to track your team's progress toward KPIs.
                </p>
                <Button variant="link" size="sm" className="text-xs h-auto p-0 shrink-0 ml-4" onClick={openGoalDialog}>
                  Set goals <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map(({ to, icon: Icon, title, description, color }) => (
            <Link key={to} to={to}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Edit Goals Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Monthly Goals — {format(new Date(), 'MMMM yyyy')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Leave a field blank to hide that goal bar. Progress is calculated from your logged post metrics.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Posts target</label>
              <Input
                type="number"
                min={0}
                value={goalForm.posts}
                onChange={(e) => setGoalForm((g) => ({ ...g, posts: e.target.value }))}
                placeholder="e.g. 20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Views target</label>
              <Input
                type="number"
                min={0}
                value={goalForm.views}
                onChange={(e) => setGoalForm((g) => ({ ...g, views: e.target.value }))}
                placeholder="e.g. 50000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Avg engagement rate target (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={goalForm.engagement}
                onChange={(e) => setGoalForm((g) => ({ ...g, engagement: e.target.value }))}
                placeholder="e.g. 4.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Keywords ranking (page 1–2) target</label>
              <Input
                type="number"
                min={0}
                value={goalForm.keywords}
                onChange={(e) => setGoalForm((g) => ({ ...g, keywords: e.target.value }))}
                placeholder="e.g. 10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGoalDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveGoals} disabled={savingGoals}>
              {savingGoals ? 'Saving…' : 'Save Goals'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
