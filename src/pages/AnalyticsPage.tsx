import { useState, useMemo } from 'react'
import { format, parseISO, subDays, startOfMonth } from 'date-fns'
import { TrendingUp, Eye, ThumbsUp, BarChart3, RefreshCw, Pencil, Target } from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { useActiveBrand } from '@/stores/activeBrand'
import { usePostMetrics } from '@/hooks/usePostMetrics'
import { useBrandSync } from '@/hooks/usePlatformConnections'
import { useShareTokens } from '@/hooks/useShareTokens'
import { useCompetitorPosts } from '@/hooks/useCompetitors'
import { useBrandKPIs } from '@/hooks/useBrandKPIs'
import { supabase } from '@/lib/supabase'
import { PLATFORMS } from '@/types'
import type { Platform, PostMetric, PostMetricInsert, CompetitorPost, KPIMetric, BrandKPIInsert } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function engagementRate(m: PostMetric): string {
  const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0)
  const base = m.reach ?? m.impressions ?? m.views
  if (!base || base === 0) return '—'
  return `${((eng / base) * 100).toFixed(1)}%`
}

// ─── KPI helpers ─────────────────────────────────────────────────────────────

const KPI_LABELS: Record<KPIMetric, string> = {
  avg_views:           'Avg views / post',
  avg_engagement_rate: 'Avg engagement rate',
  avg_reach:           'Avg reach / post',
  posts_per_month:     'Posts / month',
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function computeSuggested(
  allMetrics: PostMetric[],
  competitorPosts: CompetitorPost[],
  platform: string,
  metric: KPIMetric,
): { suggested: number | null; competitorMedian: number | null } {
  const cutoff = subDays(new Date(), 90)
  const posts = allMetrics.filter(
    (m) =>
      (platform === 'all' || m.platform === platform) &&
      m.posted_at != null &&
      new Date(m.posted_at + 'T00:00:00') >= cutoff,
  )

  if (metric === 'posts_per_month') {
    const perMonth = posts.length / 3
    return { suggested: Math.max(Math.round(perMonth * 1.15), 1), competitorMedian: null }
  }

  const extract = (p: PostMetric): number | null => {
    if (metric === 'avg_views') return p.views
    if (metric === 'avg_reach') return p.reach
    if (metric === 'avg_engagement_rate') {
      const denom = p.reach ?? p.impressions ?? p.views
      if (!denom) return null
      return (((p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0)) / denom) * 100
    }
    return null
  }

  const values = posts.map(extract).filter((v): v is number => v != null)
  if (values.length < 3) return { suggested: null, competitorMedian: null }

  const suggested = Math.round(median(values) * 1.15)

  const cExtract = (cp: CompetitorPost): number | null => {
    if (metric === 'avg_views') return cp.views
    if (metric === 'avg_engagement_rate') {
      const denom = cp.views
      if (!denom) return null
      return (((cp.likes ?? 0) + (cp.comments ?? 0) + (cp.shares ?? 0)) / denom) * 100
    }
    return null
  }
  const cValues = competitorPosts
    .filter((cp) => platform === 'all' || cp.platform === platform)
    .map(cExtract)
    .filter((v): v is number => v != null)
  const competitorMedian = cValues.length >= 2 ? Math.round(median(cValues)) : null

  return { suggested, competitorMedian }
}

function computeCurrentValue(allMetrics: PostMetric[], platform: string, metric: KPIMetric): number | null {
  const start = startOfMonth(new Date())
  const posts = allMetrics.filter(
    (m) =>
      (platform === 'all' || m.platform === platform) &&
      m.posted_at != null &&
      new Date(m.posted_at + 'T00:00:00') >= start,
  )
  if (posts.length === 0) return metric === 'posts_per_month' ? 0 : null
  if (metric === 'posts_per_month') return posts.length
  const values = posts
    .map((p) => {
      if (metric === 'avg_views') return p.views
      if (metric === 'avg_reach') return p.reach
      if (metric === 'avg_engagement_rate') {
        const denom = p.reach ?? p.impressions ?? p.views
        if (!denom) return null
        return (((p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0)) / denom) * 100
      }
      return null
    })
    .filter((v): v is number => v != null)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

// ─── Platform chip ───────────────────────────────────────────────────────────

const PLATFORM_CHIP_COLORS: Record<Platform, string> = {
  instagram: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  tiktok:    'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  facebook:  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  linkedin:  'bg-blue-800/10 text-blue-800 dark:text-blue-300',
  youtube:   'bg-red-500/10 text-red-600 dark:text-red-400',
}

// ─── Log/Edit form defaults ───────────────────────────────────────────────────

function blankForm() {
  return {
    platform: 'instagram' as Platform,
    post_url: '',
    posted_at: format(new Date(), 'yyyy-MM-dd'),
    posted_time: '',
    views: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
    reach: '',
    impressions: '',
    notes: '',
  }
}

// ─── Sync-capable platforms (Apify supports these) ───────────────────────────

const ANALYTICS_PLATFORMS = PLATFORMS.filter((p) => p.value !== 'linkedin')

const SYNC_PLATFORMS: { value: 'instagram' | 'tiktok' | 'facebook' | 'youtube'; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook'  },
  { value: 'tiktok',    label: 'TikTok'    },
  { value: 'youtube',   label: 'YouTube'   },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { activeBrand } = useActiveBrand()
  const { metrics, logMetric, updateMetric, deleteMetric } = usePostMetrics(activeBrand?.id ?? null)
  const { sync } = useBrandSync(activeBrand?.id ?? null)
  const { tokens, createToken, deleteToken } = useShareTokens(activeBrand?.id ?? null)
  const { kpis, upsertKPI, deleteKPI } = useBrandKPIs(activeBrand?.id ?? null)
  const competitorPostsQuery = useCompetitorPosts(activeBrand?.id ?? null)
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [auditInsights, setAuditInsights] = useState<string[] | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)

  type KPIDraft = Record<KPIMetric, { enabled: boolean; target: string }>
  const [kpiSheetOpen, setKpiSheetOpen] = useState(false)
  const [kpiPlatform, setKpiPlatform] = useState<string>('all')
  const [kpiDraft, setKpiDraft] = useState<KPIDraft>({
    avg_views:           { enabled: false, target: '' },
    avg_engagement_rate: { enabled: false, target: '' },
    avg_reach:           { enabled: false, target: '' },
    posts_per_month:     { enabled: false, target: '' },
  })

  async function handleSync(platform: string) {
    setSyncingPlatform(platform)
    try {
      const result = await sync.mutateAsync(platform)
      const label = SYNC_PLATFORMS.find((p) => p.value === platform)?.label ?? platform
      toast.success(`Synced ${result.synced} posts from ${label}`)
    } catch (err) {
      toast.error('Sync failed', { description: (err as Error).message })
    } finally {
      setSyncingPlatform(null)
    }
  }

  async function handleSyncAll() {
    if (!activeBrand) return
    setSyncingAll(true)
    const toSync = SYNC_PLATFORMS.filter((p) => {
      const handle = activeBrand[`${p.value}_handle` as keyof typeof activeBrand]
      return !!handle
    })
    let totalSynced = 0
    const errorList: string[] = []
    for (const p of toSync) {
      setSyncingPlatform(p.value)
      try {
        const result = await sync.mutateAsync(p.value)
        totalSynced += result.synced
      } catch (err) {
        errorList.push(`${p.label}: ${(err as Error).message}`)
      }
    }
    setSyncingPlatform(null)
    setSyncingAll(false)
    if (errorList.length === 0) {
      toast.success(`Synced ${totalSynced} posts across ${toSync.length} platform${toSync.length !== 1 ? 's' : ''}`)
    } else {
      toast.warning(`Sync finished with ${errorList.length} error${errorList.length !== 1 ? 's' : ''}`, {
        description: errorList.join(' · '),
      })
    }
  }

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingMetric, setEditingMetric] = useState<PostMetric | null>(null)
  const [form, setForm] = useState(blankForm())

  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all')
  const [sortBy, setSortBy] = useState<'posted_at' | 'views' | 'likes'>('posted_at')

  const allMetrics = metrics.data ?? []

  const filteredMetrics = useMemo(
    () => filterPlatform === 'all' ? allMetrics : allMetrics.filter((m) => m.platform === filterPlatform),
    [allMetrics, filterPlatform],
  )

  // ── Summary stats ─────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    if (filteredMetrics.length === 0) return null
    const totalViews = filteredMetrics.reduce((s, m) => s + (m.views ?? 0), 0)
    const totalLikes = filteredMetrics.reduce((s, m) => s + (m.likes ?? 0), 0)
    const avgEng = filteredMetrics
      .map((m) => {
        const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0)
        const base = m.reach ?? m.impressions ?? m.views
        return base ? (eng / base) * 100 : null
      })
      .filter((v): v is number => v !== null)
    const avgEngRate = avgEng.length > 0 ? avgEng.reduce((a, b) => a + b, 0) / avgEng.length : null

    // Top platform by total views
    const byPlatform: Record<string, number> = {}
    filteredMetrics.forEach((m) => {
      byPlatform[m.platform] = (byPlatform[m.platform] ?? 0) + (m.views ?? 0)
    })
    const topPlatform = Object.entries(byPlatform).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    return {
      totalViews,
      totalLikes,
      avgEngRate,
      topPlatform,
      count: filteredMetrics.length,
    }
  }, [filteredMetrics])

  // ── Filtered + sorted list ────────────────────────────────────────────────

  const displayed = useMemo(() => {
    return [...filteredMetrics].sort((a, b) => {
      if (sortBy === 'views') return (b.views ?? -1) - (a.views ?? -1)
      if (sortBy === 'likes') return (b.likes ?? -1) - (a.likes ?? -1)
      return (b.posted_at ?? '').localeCompare(a.posted_at ?? '')
    })
  }, [filteredMetrics, sortBy])

  // ── Best posting times ────────────────────────────────────────────────────

  const bestTimesData = useMemo(() => {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const buckets: Record<number, { total: number; count: number }> = {}
    for (let i = 0; i < 7; i++) buckets[i] = { total: 0, count: 0 }
    for (const m of filteredMetrics) {
      if (!m.posted_at) continue
      const day = new Date(m.posted_at + 'T00:00:00').getDay()
      buckets[day].total += m.views ?? 0
      buckets[day].count++
    }
    return DAYS.map((label, i) => ({
      day: label,
      avg: buckets[i].count > 0 ? Math.round(buckets[i].total / buckets[i].count) : 0,
      posts: buckets[i].count,
    }))
  }, [filteredMetrics])

  // ── Best posting hours ────────────────────────────────────────────────────

  const bestHoursData = useMemo(() => {
    const buckets: Record<number, { total: number; count: number }> = {}
    for (let h = 0; h < 24; h++) buckets[h] = { total: 0, count: 0 }
    for (const m of filteredMetrics) {
      if (!m.posted_time) continue
      const hour = parseInt(m.posted_time.slice(0, 2))
      if (isNaN(hour)) continue
      buckets[hour].total += m.views ?? 0
      buckets[hour].count++
    }
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
      avg: buckets[h].count > 0 ? Math.round(buckets[h].total / buckets[h].count) : 0,
      posts: buckets[h].count,
    }))
  }, [filteredMetrics])

  const hasHourData = bestHoursData.some((d) => d.posts > 0)

  // ── Competitor benchmark ──────────────────────────────────────────────────

  const benchmarkData = useMemo(() => {
    const brandByWeek: Record<string, number> = {}
    const competitorByWeek: Record<string, number> = {}

    for (const m of allMetrics) {
      if (!m.posted_at || !m.views) continue
      const d = new Date(m.posted_at + 'T00:00:00')
      const weekKey = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() - d.getDay() + 6) / 7)).padStart(2, '0')}`
      brandByWeek[weekKey] = (brandByWeek[weekKey] ?? 0) + m.views
    }

    for (const p of (competitorPostsQuery.data ?? [])) {
      if (!p.posted_at || !p.views) continue
      const d = new Date((p.posted_at as string) + 'T00:00:00')
      const weekKey = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() - d.getDay() + 6) / 7)).padStart(2, '0')}`
      competitorByWeek[weekKey] = (competitorByWeek[weekKey] ?? 0) + p.views
    }

    const allWeeks = [...new Set([...Object.keys(brandByWeek), ...Object.keys(competitorByWeek)])].sort().slice(-12)
    return allWeeks.map((week) => ({
      week: week.replace(/\d{4}-/, ''),
      brand: brandByWeek[week] ?? 0,
      competitors: competitorByWeek[week] ?? 0,
    }))
  }, [allMetrics, competitorPostsQuery.data])

  // ── KPI suggestions ───────────────────────────────────────────────────────

  const kpiSuggestions = useMemo(() => {
    const METRICS: KPIMetric[] = ['avg_views', 'avg_engagement_rate', 'avg_reach', 'posts_per_month']
    const platforms = ['all', ...ANALYTICS_PLATFORMS.map((p) => p.value)]
    const result: Record<string, Record<KPIMetric, { suggested: number | null; competitorMedian: number | null }>> = {}
    for (const platform of platforms) {
      result[platform] = {} as Record<KPIMetric, { suggested: number | null; competitorMedian: number | null }>
      for (const metric of METRICS) {
        result[platform][metric] = computeSuggested(allMetrics, competitorPostsQuery.data ?? [], platform, metric)
      }
    }
    return result
  }, [allMetrics, competitorPostsQuery.data])

  function openKpiSheet(platform = kpiPlatform) {
    const existing = kpis.data ?? []
    setKpiPlatform(platform)
    setKpiDraft({
      avg_views:           { enabled: false, target: '' },
      avg_engagement_rate: { enabled: false, target: '' },
      avg_reach:           { enabled: false, target: '' },
      posts_per_month:     { enabled: false, target: '' },
      ...Object.fromEntries(
        existing
          .filter((k) => k.platform === platform)
          .map((k) => [k.metric, { enabled: true, target: String(k.target_value) }]),
      ),
    })
    setKpiSheetOpen(true)
  }

  function handleKpiPlatformChange(platform: string) {
    setKpiPlatform(platform)
    const existing = kpis.data ?? []
    setKpiDraft({
      avg_views:           { enabled: false, target: '' },
      avg_engagement_rate: { enabled: false, target: '' },
      avg_reach:           { enabled: false, target: '' },
      posts_per_month:     { enabled: false, target: '' },
      ...Object.fromEntries(
        existing
          .filter((k) => k.platform === platform)
          .map((k) => [k.metric, { enabled: true, target: String(k.target_value) }]),
      ),
    })
  }

  async function handleSaveKPIs() {
    if (!activeBrand) return
    const METRICS: KPIMetric[] = ['avg_views', 'avg_engagement_rate', 'avg_reach', 'posts_per_month']
    try {
      for (const metric of METRICS) {
        const draft = kpiDraft[metric]
        const existing = (kpis.data ?? []).find((k) => k.platform === kpiPlatform && k.metric === metric)
        if (draft.enabled && draft.target.trim()) {
          const payload: BrandKPIInsert = {
            brand_id: activeBrand.id,
            platform: kpiPlatform,
            metric,
            target_value: Number(draft.target),
          }
          await upsertKPI.mutateAsync(payload)
        } else if (!draft.enabled && existing) {
          await deleteKPI.mutateAsync(existing.id)
        }
      }
      toast.success('KPI targets saved')
      setKpiSheetOpen(false)
    } catch (err) {
      toast.error('Failed to save KPIs', { description: (err as Error).message })
    }
  }

  // ── Drawer helpers ────────────────────────────────────────────────────────

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openCreate() {
    setDrawerMode('create')
    setEditingMetric(null)
    setForm(blankForm())
    setDrawerOpen(true)
  }

  function openEdit(m: PostMetric) {
    setDrawerMode('edit')
    setEditingMetric(m)
    setForm({
      platform: m.platform,
      post_url: m.post_url ?? '',
      posted_at: m.posted_at ?? format(new Date(), 'yyyy-MM-dd'),
      posted_time: m.posted_time ?? '',
      views: m.views != null ? String(m.views) : '',
      likes: m.likes != null ? String(m.likes) : '',
      comments: m.comments != null ? String(m.comments) : '',
      shares: m.shares != null ? String(m.shares) : '',
      saves: m.saves != null ? String(m.saves) : '',
      reach: m.reach != null ? String(m.reach) : '',
      impressions: m.impressions != null ? String(m.impressions) : '',
      notes: m.notes ?? '',
    })
    setDrawerOpen(true)
  }

  function buildPayload(): PostMetricInsert {
    const num = (v: string) => v.trim() ? Number(v) : null
    return {
      brand_id: activeBrand!.id,
      calendar_entry_id: null,
      platform: form.platform,
      post_url: form.post_url.trim() || null,
      posted_at: form.posted_at || null,
      posted_time: form.posted_time || null,
      views: num(form.views),
      likes: num(form.likes),
      comments: num(form.comments),
      shares: num(form.shares),
      saves: num(form.saves),
      reach: num(form.reach),
      impressions: num(form.impressions),
      notes: form.notes.trim() || null,
      logged_by: null,
    }
  }

  async function handleSave() {
    try {
      if (drawerMode === 'create') {
        await logMetric.mutateAsync(buildPayload())
        toast.success('Metrics logged')
      } else {
        await updateMetric.mutateAsync({ id: editingMetric!.id, patch: buildPayload() })
        toast.success('Metrics updated')
      }
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to save', { description: (err as Error).message })
    }
  }

  async function handleDelete() {
    try {
      await deleteMetric.mutateAsync(editingMetric!.id)
      toast.success('Entry deleted')
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to delete', { description: (err as Error).message })
    }
  }

  async function handleAudit() {
    setAuditLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('content-audit', {
        body: { brand_id: activeBrand?.id },
      })
      if (error) throw error
      setAuditInsights(data.insights)
    } catch (err) {
      toast.error('Audit failed', { description: (err as Error).message })
    } finally {
      setAuditLoading(false)
    }
  }

  if (!activeBrand) {
    return <div className="p-6 text-muted-foreground">Select a brand to view analytics.</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{activeBrand.name}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          Log Metrics
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        {/* Brand Accounts */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand Accounts</p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Synced via Apify</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleSyncAll}
                disabled={syncingAll || !!syncingPlatform}
              >
                <RefreshCw className={`h-3 w-3 ${syncingAll ? 'animate-spin' : ''}`} />
                {syncingAll ? 'Syncing…' : 'Sync All'}
              </Button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {SYNC_PLATFORMS.map((p) => {
              const handle = activeBrand[`${p.value}_handle` as keyof typeof activeBrand] as string | null
              const lastSyncedMetric = allMetrics
                .filter((m) => m.platform === p.value)
                .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
              const isSyncing = syncingPlatform === p.value

              return (
                <div key={p.value} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded shrink-0 ${PLATFORM_CHIP_COLORS[p.value as Platform]}`}>
                    {p.label}
                  </span>
                  {handle ? (
                    <>
                      <span className="text-xs text-foreground truncate min-w-0">
                        @{handle.replace(/^@/, '')}
                      </span>
                      {lastSyncedMetric && (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          Synced {format(parseISO(lastSyncedMetric.created_at), 'MMM d')}
                        </span>
                      )}
                      <div className="ml-auto shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => handleSync(p.value)}
                          disabled={isSyncing || syncingAll}
                        >
                          <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                          {isSyncing ? 'Syncing…' : 'Sync'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Add handle in brand settings to enable sync
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Share Links */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Share Links</p>
          </div>
          <div className="p-4 flex gap-3 flex-wrap">
            {(['report', 'approval'] as const).map((type) => {
              const existing = (tokens.data ?? []).find((t) => t.type === type)
              const url = existing
                ? `${window.location.origin}/${type === 'report' ? 'report' : 'approve'}/${existing.token}`
                : null
              return (
                <div
                  key={type}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 flex-wrap"
                >
                  <span className="text-sm font-medium">
                    {type === 'report' ? 'Client Report' : 'Content Approval'}
                  </span>
                  {url ? (
                    <>
                      <input
                        readOnly
                        value={url}
                        className="text-xs font-mono bg-muted rounded px-2 py-1 w-48 truncate border-none outline-none"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(url)
                          toast.success('Link copied')
                        }}
                      >
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => deleteToken.mutate(existing!.id)}
                      >
                        Revoke
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => createToken.mutate({ type })}
                      disabled={createToken.isPending}
                    >
                      Generate Link
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Summary stat cards */}
        {summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Posts logged" value={String(summary.count)} icon={BarChart3} />
            <StatCard label="Total views" value={fmt(summary.totalViews)} icon={Eye} />
            <StatCard label="Total likes" value={fmt(summary.totalLikes)} icon={ThumbsUp} />
            <StatCard
              label="Avg engagement"
              value={summary.avgEngRate != null ? `${summary.avgEngRate.toFixed(1)}%` : '—'}
              icon={TrendingUp}
            />
          </div>
        ) : (
          !metrics.isLoading && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No metrics logged yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                After publishing a post, log the views, likes, and engagement here to track performance over time.
              </p>
              <Button size="sm" className="mt-4" onClick={openCreate}>
                Log your first post
              </Button>
            </div>
          )
        )}

        {/* KPI Targets */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KPI Targets</p>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openKpiSheet()}>
              Edit targets
            </Button>
          </div>
          {(kpis.data ?? []).length === 0 ? (
            <div className="p-6 text-center">
              <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">No KPI targets set</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Set realistic targets based on your last 90 days of performance. We'll suggest numbers automatically.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => openKpiSheet()}>
                Set targets
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
              {(kpis.data ?? []).map((kpi) => {
                const current = computeCurrentValue(allMetrics, kpi.platform, kpi.metric as KPIMetric)
                const pct = current != null && kpi.target_value > 0 ? Math.min(current / kpi.target_value, 1) : 0
                const isHit = pct >= 1
                const label = KPI_LABELS[kpi.metric as KPIMetric] ?? kpi.metric
                const platformLabel =
                  kpi.platform === 'all'
                    ? 'All'
                    : ANALYTICS_PLATFORMS.find((p) => p.value === kpi.platform)?.label ?? kpi.platform
                const { competitorMedian } = kpiSuggestions[kpi.platform]?.[kpi.metric as KPIMetric] ?? {}
                const isRate = kpi.metric === 'avg_engagement_rate'
                return (
                  <div key={kpi.id} className="space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-foreground">{label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{platformLabel}</span>
                    </div>
                    <p className="text-sm text-foreground">
                      {current != null ? (isRate ? `${current.toFixed(1)}%` : fmt(current)) : '—'}
                      <span className="text-[11px] text-muted-foreground">
                        {' '}/ {isRate ? `${kpi.target_value}%` : fmt(kpi.target_value)}
                      </span>
                    </p>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isHit ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                    {competitorMedian != null && (
                      <p className="text-[10px] text-muted-foreground">
                        Competitor median: {isRate ? `${competitorMedian}%` : fmt(competitorMedian)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Filter + sort bar */}
        {allMetrics.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterPlatform('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterPlatform === 'all'
                  ? 'bg-foreground text-background border-transparent'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              All platforms
            </button>
            {ANALYTICS_PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setFilterPlatform(p.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterPlatform === p.value
                    ? `${PLATFORM_CHIP_COLORS[p.value]} border-transparent`
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              Sort by:
              {(['posted_at', 'views', 'likes'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSortBy(s)}
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    sortBy === s ? 'bg-background shadow-sm text-foreground border-border' : 'border-transparent'
                  }`}
                >
                  {s === 'posted_at' ? 'Date' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Best Posting Times */}
        {allMetrics.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-1">Best Posting Times</h2>
            <p className="text-sm text-muted-foreground mb-4">Average views by day of week and time of day</p>
            {bestTimesData.every((d) => d.avg === 0) ? (
              <p className="text-sm text-muted-foreground">
                Not enough data yet — log posts with dates to see patterns.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={bestTimesData}
                  layout="vertical"
                  margin={{ left: 8, right: 56, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} />
                  <YAxis type="category" dataKey="day" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, _name: any, props: any) => [
                      `${fmt(Number(value))} avg views · ${props.payload?.posts ?? 0} post${(props.payload?.posts ?? 0) !== 1 ? 's' : ''}`,
                      'Performance',
                    ]}
                  />
                  <Bar
                    dataKey="avg"
                    radius={[0, 4, 4, 0]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={{ position: 'right', fontSize: 10, formatter: (v: any) => Number(v) > 0 ? fmt(Number(v)) : '' }}
                  >
                    {bestTimesData.map((entry, i) => {
                      const maxAvg = Math.max(...bestTimesData.map((d) => d.avg))
                      return (
                        <Cell
                          key={i}
                          fill={
                            entry.avg === maxAvg && maxAvg > 0
                              ? 'hsl(var(--primary))'
                              : 'hsl(var(--muted-foreground) / 0.25)'
                          }
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Hour of day chart */}
            {hasHourData ? (
              <div className="mt-6">
                <p className="text-sm font-medium mb-3">Best time of day</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={bestHoursData}
                    layout="vertical"
                    margin={{ left: 8, right: 56, top: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} />
                    <YAxis type="category" dataKey="hour" tick={{ fontSize: 10 }} width={44} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, _name: any, props: any) => [
                        `${fmt(Number(value))} avg views · ${props.payload?.posts ?? 0} post${(props.payload?.posts ?? 0) !== 1 ? 's' : ''}`,
                        'Performance',
                      ]}
                    />
                    <Bar
                      dataKey="avg"
                      radius={[0, 4, 4, 0]}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={{ position: 'right', fontSize: 10, formatter: (v: any) => Number(v) > 0 ? fmt(Number(v)) : '' }}
                    >
                      {bestHoursData.map((entry, i) => {
                        const maxAvg = Math.max(...bestHoursData.map((d) => d.avg))
                        return (
                          <Cell
                            key={i}
                            fill={
                              entry.avg === maxAvg && maxAvg > 0
                                ? 'hsl(var(--primary))'
                                : 'hsl(var(--muted-foreground) / 0.25)'
                            }
                          />
                        )
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-4">
                Time-of-day data will appear here after your next sync — time is captured automatically from each platform.
              </p>
            )}
          </section>
        )}

        {/* Competitor Benchmark */}
        {(allMetrics.length > 0 || (competitorPostsQuery.data ?? []).length > 0) && (
          <section>
            <h2 className="text-lg font-semibold mb-1">Competitor Benchmark</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your total views vs competitor posts by week (last 12 weeks)
            </p>
            {benchmarkData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No data — log post metrics and add competitors to compare.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={benchmarkData}
                  margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                >
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="brand"
                    name={activeBrand?.name ?? 'Your Brand'}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="competitors"
                    name="Competitors (total)"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>
        )}

        {/* AI Content Audit */}
        <section>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">AI Content Audit</h2>
              <p className="text-sm text-muted-foreground">
                Personalized recommendations based on your performance data
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAudit}
              disabled={auditLoading || allMetrics.length < 3}
            >
              {auditLoading ? 'Analyzing…' : auditInsights ? 'Re-run Audit' : 'Run Audit'}
            </Button>
          </div>
          {allMetrics.length < 3 && !auditInsights && (
            <p className="text-sm text-muted-foreground">
              Log at least 3 posts to run an AI audit.
            </p>
          )}
          {auditInsights && (
            <div className="space-y-3">
              {auditInsights.map((insight, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                  <span className="text-primary font-bold text-sm shrink-0">{i + 1}.</span>
                  <p className="text-sm text-foreground">{insight}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Metrics table */}
        {displayed.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Platform</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Views</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Likes</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Comments</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Eng. Rate</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">URL</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {displayed.map((m, i) => (
                  <tr
                    key={m.id}
                    className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                  >
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {m.posted_at ? format(parseISO(m.posted_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${PLATFORM_CHIP_COLORS[m.platform as Platform]}`}>
                        {m.platform}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right tabular-nums">{fmt(m.views)}</td>
                    <td className="px-4 py-2.5 text-xs text-right tabular-nums">{fmt(m.likes)}</td>
                    <td className="px-4 py-2.5 text-xs text-right tabular-nums">{fmt(m.comments)}</td>
                    <td className="px-4 py-2.5 text-xs text-right tabular-nums">{engagementRate(m)}</td>
                    <td className="px-4 py-2.5 text-xs max-w-[120px]">
                      {m.post_url ? (
                        <a
                          href={m.post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2 truncate block"
                        >
                          {m.post_url.replace(/^https?:\/\//, '').slice(0, 30)}…
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>{drawerMode === 'create' ? 'Log Post Metrics' : 'Edit Metrics'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Platform */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Platform</label>
              <div className="flex flex-wrap gap-1.5">
                {ANALYTICS_PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setField('platform', p.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      form.platform === p.value
                        ? `${PLATFORM_CHIP_COLORS[p.value]} border-transparent`
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Posted date</label>
                <input
                  type="date"
                  value={form.posted_at}
                  onChange={(e) => setField('posted_at', e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Time <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <input
                  type="time"
                  value={form.posted_time}
                  onChange={(e) => setField('posted_time', e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
            </div>
            {/* URL */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Post URL <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                value={form.post_url}
                onChange={(e) => setField('post_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            {/* Metric fields */}
            <div className="grid grid-cols-2 gap-3">
              {([
                ['views', 'Views'],
                ['likes', 'Likes'],
                ['comments', 'Comments'],
                ['shares', 'Shares'],
                ['saves', 'Saves'],
                ['reach', 'Reach'],
                ['impressions', 'Impressions'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Input
                    type="number"
                    min={0}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder="0"
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={2}
                className="resize-none"
                placeholder="Any observations about this post…"
              />
            </div>
          </div>
          <SheetFooter className="border-t border-border px-6 py-4 flex-row gap-2">
            {drawerMode === 'edit' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMetric.isPending}
              >
                Delete
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)} className="ml-auto">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={logMetric.isPending || updateMetric.isPending}
            >
              {logMetric.isPending || updateMetric.isPending ? 'Saving…' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* KPI Targets Sheet */}
      <Sheet open={kpiSheetOpen} onOpenChange={setKpiSheetOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
            <SheetTitle>Set KPI Targets</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Platform selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleKpiPlatformChange('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    kpiPlatform === 'all'
                      ? 'bg-foreground text-background border-transparent'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  All platforms
                </button>
                {ANALYTICS_PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handleKpiPlatformChange(p.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      kpiPlatform === p.value
                        ? `${PLATFORM_CHIP_COLORS[p.value as Platform]} border-transparent`
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric rows */}
            <div className="space-y-3">
              {(Object.entries(KPI_LABELS) as [KPIMetric, string][]).map(([metric, label]) => {
                const { suggested, competitorMedian } = kpiSuggestions[kpiPlatform]?.[metric] ?? {}
                const draft = kpiDraft[metric]
                const isRate = metric === 'avg_engagement_rate'
                return (
                  <div key={metric} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(e) =>
                            setKpiDraft((prev) => ({
                              ...prev,
                              [metric]: { ...prev[metric], enabled: e.target.checked },
                            }))
                          }
                          className="accent-primary"
                        />
                        {label}
                      </label>
                      {suggested != null && (
                        <button
                          type="button"
                          className="text-[11px] text-primary underline underline-offset-2 shrink-0"
                          onClick={() =>
                            setKpiDraft((prev) => ({
                              ...prev,
                              [metric]: {
                                enabled: true,
                                target: isRate ? suggested.toFixed(1) : String(suggested),
                              },
                            }))
                          }
                        >
                          Suggested: {isRate ? `${suggested.toFixed(1)}%` : fmt(suggested)}
                        </button>
                      )}
                    </div>
                    {draft.enabled && (
                      <Input
                        type="number"
                        min={0}
                        step={isRate ? 0.1 : 1}
                        placeholder={isRate ? 'e.g. 5.2' : 'e.g. 10000'}
                        value={draft.target}
                        onChange={(e) =>
                          setKpiDraft((prev) => ({
                            ...prev,
                            [metric]: { ...prev[metric], target: e.target.value },
                          }))
                        }
                      />
                    )}
                    {competitorMedian != null && (
                      <p className="text-[11px] text-muted-foreground">
                        Competitor median: {isRate ? `${competitorMedian}%` : fmt(competitorMedian)}
                      </p>
                    )}
                    {suggested == null && allMetrics.length < 3 && metric !== 'posts_per_month' && (
                      <p className="text-[11px] text-muted-foreground">
                        Log at least 3 posts to get a suggestion.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <SheetFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button
              className="w-full"
              onClick={handleSaveKPIs}
              disabled={upsertKPI.isPending || deleteKPI.isPending}
            >
              {upsertKPI.isPending || deleteKPI.isPending ? 'Saving…' : 'Save targets'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
