import { useMemo } from 'react'
import { Briefcase, Users, Sparkles, CalendarDays, TrendingUp, ArrowRight, TrendingDown, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveBrand } from '@/stores/activeBrand'
import { useBrands } from '@/hooks/useBrands'
import { usePostMetrics } from '@/hooks/usePostMetrics'
import { useSeoKeywords, useBlogPosts } from '@/hooks/useSeo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { PostMetric } from '@/types'

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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // No brands yet — onboarding state
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
            {activeBrand.platforms.map((p) => (
              <Badge key={p} variant="secondary" className="capitalize text-xs">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {activeBrand && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

      {/* All Brands */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your Brands
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/brands">Manage <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.slice(0, 6).map((brand) => (
            <Card key={brand.id} className="flex items-center gap-3 p-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ background: brand.color ?? '#6366f1' }}
              >
                {brand.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{brand.name}</p>
                <p className="truncate text-xs text-muted-foreground">{brand.niche}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
