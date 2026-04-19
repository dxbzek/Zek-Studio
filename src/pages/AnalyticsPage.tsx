import { useState, useMemo, useEffect } from 'react'
import { format, parseISO, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { TrendingUp, Eye, ThumbsUp, BarChart3, RefreshCw, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useSearchParams } from 'react-router-dom'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { useActiveBrand } from '@/stores/activeBrand'
import { usePostMetrics } from '@/hooks/usePostMetrics'
import { useBrandSync } from '@/hooks/usePlatformConnections'
import { useShareTokens } from '@/hooks/useShareTokens'
import { useCompetitorPosts } from '@/hooks/useCompetitors'
import { supabase } from '@/lib/supabase'
import { PLATFORMS } from '@/types'
import type { Platform, PostMetric, PostMetricInsert } from '@/types'

const PLATFORM_LINE_COLORS: Record<string, string> = {
  instagram: '#a855f7',
  tiktok:    '#f43f5e',
  facebook:  '#3b82f6',
  youtube:   '#ef4444',
}

function weekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7)
}

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

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="eyebrow" style={{ fontSize: 10 }}>{label}</span>
      </div>
      <p className="mono-num" style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 500 }}>{value}</p>
    </div>
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const w = 64, h = 22
  if (data.length < 2) return <span className="text-muted-foreground text-[10px]">—</span>
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / max) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
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
  const competitorPostsQuery = useCompetitorPosts(activeBrand?.id ?? null)
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({})
  const [auditInsights, setAuditInsights] = useState<{ category: string; text: string }[] | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditDateFrom, setAuditDateFrom] = useState<string>(format(subDays(new Date(), 90), 'yyyy-MM-dd'))
  const [auditDateTo, setAuditDateTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [auditPlatform, setAuditPlatform] = useState<string>('all')
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all')
  const [auditSortBy, setAuditSortBy] = useState<'default' | 'category'>('default')
  const [syncFrom, setSyncFrom] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [syncTo, setSyncTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

  // ── Content Velocity ──────────────────────────────────────────────────────

  const velocityQuery = useQuery({
    queryKey: ['content-velocity', activeBrand?.id],
    queryFn: async () => {
      if (!activeBrand?.id) return []
      const now = new Date()
      const { data, error } = await supabase
        .from('calendar_entries')
        .select('scheduled_date, status')
        .eq('brand_id', activeBrand.id)
        .gte('scheduled_date', format(startOfMonth(now), 'yyyy-MM-dd'))
        .lte('scheduled_date', format(endOfMonth(now), 'yyyy-MM-dd'))
      if (error) throw error
      return (data ?? []) as { scheduled_date: string; status: string }[]
    },
    enabled: !!activeBrand?.id,
    staleTime: 1000 * 60 * 30,
  })

  const velocityData = useMemo(() => {
    const entries = velocityQuery.data ?? []
    const weekMap: Record<string, { label: string; planned: number; published: number }> = {}
    for (const e of entries) {
      const d = new Date(e.scheduled_date + 'T00:00:00')
      const wk = `W${weekOfMonth(d)}`
      if (!weekMap[wk]) weekMap[wk] = { label: wk, planned: 0, published: 0 }
      if (e.status === 'published') {
        weekMap[wk].published++
      } else {
        weekMap[wk].planned++
      }
    }
    return Object.values(weekMap).sort((a, b) => a.label.localeCompare(b.label))
  }, [velocityQuery.data])

  const consistencyScore = useMemo(() => {
    const total  = velocityData.reduce((s, w) => s + w.planned + w.published, 0)
    const published = velocityData.reduce((s, w) => s + w.published, 0)
    return total > 0 ? Math.round((published / total) * 100) : null
  }, [velocityData])

  // ── Follower Growth ───────────────────────────────────────────────────────

  const growthQuery = useQuery({
    queryKey: ['growth-snapshots', activeBrand?.id],
    queryFn: async () => {
      if (!activeBrand?.id) return []
      const since = format(subDays(new Date(), 90), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('growth_snapshots')
        .select('platform, followers, recorded_at')
        .eq('brand_id', activeBrand.id)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as { platform: string; followers: number; recorded_at: string }[]
    },
    enabled: !!activeBrand?.id,
    staleTime: 1000 * 60 * 30,
  })

  const growthChartResult = useMemo(() => {
    const snapshots = growthQuery.data ?? []
    if (snapshots.length === 0) return null
    const byDate: Record<string, Record<string, number>> = {}
    const platformSet = new Set<string>()
    for (const s of snapshots) {
      if (!byDate[s.recorded_at]) byDate[s.recorded_at] = {}
      byDate[s.recorded_at][s.platform] = s.followers
      platformSet.add(s.platform)
    }
    const chartData = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date: format(parseISO(date), 'MMM d'), ...vals }))
    const platforms = [...platformSet]
    return { chartData, platforms }
  }, [growthQuery.data])

  const growthNetStats = useMemo(() => {
    const snapshots = growthQuery.data ?? []
    if (snapshots.length === 0) return null
    const byPlatform: Record<string, number[]> = {}
    for (const s of snapshots) {
      if (!byPlatform[s.platform]) byPlatform[s.platform] = []
      byPlatform[s.platform].push(s.followers)
    }
    return Object.entries(byPlatform).map(([platform, counts]) => ({
      platform,
      latest: counts[counts.length - 1],
      net: counts[counts.length - 1] - counts[0],
    }))
  }, [growthQuery.data])

  async function handleSync(platform: string) {
    setSyncingPlatform(platform)
    setSyncErrors((prev) => ({ ...prev, [platform]: '' }))
    try {
      const result = await sync.mutateAsync({ platform, since: syncFrom, until: syncTo })
      const label = SYNC_PLATFORMS.find((p) => p.value === platform)?.label ?? platform
      toast.success(`Synced ${result.synced} posts from ${label}`)
    } catch (err) {
      const msg = (err as Error).message
      setSyncErrors((prev) => ({ ...prev, [platform]: msg }))
      toast.error('Sync failed', { description: msg })
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
        const result = await sync.mutateAsync({ platform: p.value, since: syncFrom, until: syncTo })
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const [searchParams] = useSearchParams()
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>(() => {
    const p = searchParams.get('platform')
    return (p && PLATFORMS.some((pl) => pl.value === p) ? p : 'all') as Platform | 'all'
  })
  const [sortBy, setSortBy] = useState<'posted_at' | 'views' | 'likes'>('posted_at')
  const [metricsLimit, setMetricsLimit] = useState(50)

  useEffect(() => {
    const p = searchParams.get('platform')
    if (p && PLATFORMS.some((pl) => pl.value === p)) setFilterPlatform(p as Platform)
  }, [searchParams])

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

  const maxBestTimesAvg = useMemo(
    () => Math.max(...bestTimesData.map((d) => d.avg), 0),
    [bestTimesData],
  )
  const maxBestHoursAvg = useMemo(
    () => Math.max(...bestHoursData.map((d) => d.avg), 0),
    [bestHoursData],
  )

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

  // ── Channel stats + sparklines ────────────────────────────────────────────

  const channelStats = useMemo(() => {
    const platformSet = [...new Set(allMetrics.map((m) => m.platform))]
    return platformSet.map((platform) => {
      const pm = allMetrics.filter((m) => m.platform === platform)
      const totalReach = pm.reduce((s, m) => s + (m.reach ?? m.views ?? 0), 0)
      const engRates = pm.map((m) => {
        const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0)
        const base = m.reach ?? m.impressions ?? m.views
        return base ? (eng / base) * 100 : null
      }).filter((v): v is number => v !== null)
      const avgEng = engRates.length > 0 ? engRates.reduce((a, b) => a + b) / engRates.length : null
      const now = new Date()
      const weekBuckets: number[] = Array(8).fill(0)
      pm.forEach((m) => {
        if (!m.posted_at) return
        const d = new Date(m.posted_at + 'T00:00:00')
        const weeksAgo = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000))
        if (weeksAgo >= 0 && weeksAgo < 8) weekBuckets[7 - weeksAgo] += (m.views ?? 0)
      })
      return { platform, totalReach, avgEng, weekBuckets, count: pm.length }
    }).sort((a, b) => b.totalReach - a.totalReach)
  }, [allMetrics])

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
    setAuditCategoryFilter('all')
    try {
      const { data, error } = await supabase.functions.invoke('content-audit', {
        body: {
          brand_id: activeBrand?.id,
          date_from: auditDateFrom,
          date_to: auditDateTo,
          platform: auditPlatform === 'all' ? undefined : auditPlatform,
        },
      })
      if (error) throw error
      setAuditInsights(data.insights)
    } catch (err) {
      toast.error('Audit failed', { description: (err as Error).message })
    } finally {
      setAuditLoading(false)
    }
  }

  if (!activeBrand) return <NoBrandSelected />

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="eyebrow mb-1.5">Performance overview · {activeBrand.name}</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>
            Analytics
          </h1>
        </div>
        <Button size="sm" onClick={openCreate}>
          Log Metrics
        </Button>
      </div>

      {/* Editorial hero card */}
      {summary && (
        <div className="px-6 pb-4 shrink-0">
          <div className="rounded-xl border border-border bg-card overflow-hidden grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr]">
            {/* Left — big reach number */}
            <div className="p-5 border-b lg:border-b-0 lg:border-r border-border">
              <div className="eyebrow mb-3">Total reach</div>
              <div
                className="mono-num"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(52px, 7vw, 72px)',
                  fontWeight: 400,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}
              >
                {fmt(summary.totalViews)}
              </div>
              <p className="text-[12px] text-muted-foreground mt-2 italic" style={{ fontFamily: 'var(--font-heading)' }}>
                Across {summary.count} post{summary.count !== 1 ? 's' : ''}, all platforms
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-foreground/10 text-foreground font-medium">
                  {summary.count} posts logged
                </span>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-foreground/8 text-muted-foreground font-medium uppercase tracking-wide">
                  Top: {summary.topPlatform}
                </span>
              </div>
            </div>

            {/* Center — engagement stats */}
            <div className="p-5 border-b lg:border-b-0 lg:border-r border-border flex flex-col gap-4">
              <div>
                <div className="eyebrow mb-1">Avg engagement rate</div>
                <div
                  className="mono-num"
                  style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em' }}
                >
                  {summary.avgEngRate != null ? `${summary.avgEngRate.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div>
                <div className="eyebrow mb-1">Total likes</div>
                <div
                  className="mono-num"
                  style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em' }}
                >
                  {fmt(summary.totalLikes)}
                </div>
              </div>
            </div>

            {/* Right — velocity + best platform */}
            <div className="p-5 flex flex-col gap-4">
              <div>
                <div className="eyebrow mb-1">Consistency score</div>
                <div
                  className="mono-num"
                  style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em' }}
                >
                  {consistencyScore != null ? `${consistencyScore}%` : '—'}
                </div>
                {consistencyScore != null && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {consistencyScore >= 80 ? 'On track' : consistencyScore >= 50 ? 'Improving' : 'Needs attention'}
                  </p>
                )}
              </div>
              <div>
                <div className="eyebrow mb-1">Platforms tracked</div>
                <div
                  className="mono-num"
                  style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em' }}
                >
                  {channelStats.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        {/* Brand Accounts */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2 justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand Accounts</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Date range:</span>
              <input
                type="date"
                value={syncFrom}
                max={syncTo}
                onChange={(e) => setSyncFrom(e.target.value)}
                className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
              />
              <span className="text-[11px] text-muted-foreground">to</span>
              <input
                type="date"
                value={syncTo}
                min={syncFrom}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setSyncTo(e.target.value)}
                className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
              />
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
                      {syncErrors[p.value] && (
                        <span className="text-[11px] text-destructive truncate max-w-[180px]" title={syncErrors[p.value]}>
                          ⚠ {syncErrors[p.value]}
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
                        onClick={() =>
                          deleteToken.mutate(existing!.id, {
                            onSuccess: () => toast.success('Share link revoked'),
                            onError: (err) => toast.error('Failed to revoke link', { description: (err as Error).message }),
                          })
                        }
                      >
                        Revoke
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() =>
                        createToken.mutate({ type }, {
                          onSuccess: () => toast.success('Share link created'),
                          onError: (err) => toast.error('Failed to create link', { description: (err as Error).message }),
                        })
                      }
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

        {/* Follower Growth */}
        {(growthChartResult || growthQuery.isLoading) && (
          <section>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="eyebrow mb-1">Growth</div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>Follower Growth</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">Last 90 days — captured automatically on each sync</p>
              </div>
            </div>
            {growthNetStats && (
              <div className="flex flex-wrap gap-3 mb-4">
                {growthNetStats.map(({ platform, latest, net }) => (
                  <div key={platform} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${PLATFORM_CHIP_COLORS[platform as Platform]}`}>
                      {platform}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{latest >= 1000 ? `${(latest / 1000).toFixed(1)}K` : latest}</span>
                    {net !== 0 && (
                      <span className={`text-xs font-medium ${net > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {net > 0 ? '+' : ''}{net >= 1000 ? `${(net / 1000).toFixed(1)}K` : net}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {growthChartResult && growthChartResult.chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={growthChartResult.chartData} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} />
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
                  <Legend />
                  {growthChartResult.platforms.map((p) => (
                    <Line
                      key={p}
                      type="monotone"
                      dataKey={p}
                      name={p.charAt(0).toUpperCase() + p.slice(1)}
                      stroke={PLATFORM_LINE_COLORS[p] ?? 'hsl(var(--primary))'}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              growthChartResult && (
                <p className="text-sm text-muted-foreground">
                  More data points will appear after multiple syncs. Current snapshot is shown above.
                </p>
              )
            )}
          </section>
        )}

        {/* Metrics loading */}
        {metrics.isLoading && (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading metrics…</span>
          </div>
        )}

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

        {/* Filter + sort bar */}
        {allMetrics.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setFilterPlatform('all'); setMetricsLimit(50) }}
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
                onClick={() => { setFilterPlatform(p.value); setMetricsLimit(50) }}
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
                  onClick={() => { setSortBy(s); setMetricsLimit(50) }}
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
            <div className="eyebrow mb-1">Timing</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>Best Posting Times</h2>
            <p className="text-[12px] text-muted-foreground mb-4">Average views by day of week and time of day</p>
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
                    formatter={(value: unknown, _name: unknown, props: unknown) => {
                      const posts = (props as { payload?: { posts?: number } }).payload?.posts ?? 0
                      return [`${fmt(Number(value))} avg views · ${posts} post${posts !== 1 ? 's' : ''}`, 'Performance']
                    }}
                  />
                  <Bar
                    dataKey="avg"
                    radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fontSize: 10, formatter: (v: unknown) => Number(v) > 0 ? fmt(Number(v)) : '' }}
                  >
                    {bestTimesData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.avg === maxBestTimesAvg && maxBestTimesAvg > 0
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--muted-foreground) / 0.25)'
                        }
                      />
                    ))}
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
                      formatter={(value: unknown, _name: unknown, props: unknown) => {
                        const posts = (props as { payload?: { posts?: number } }).payload?.posts ?? 0
                        return [`${fmt(Number(value))} avg views · ${posts} post${posts !== 1 ? 's' : ''}`, 'Performance']
                      }}
                    />
                    <Bar
                      dataKey="avg"
                      radius={[0, 4, 4, 0]}
                      label={{ position: 'right', fontSize: 10, formatter: (v: unknown) => Number(v) > 0 ? fmt(Number(v)) : '' }}
                    >
                      {bestHoursData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.avg === maxBestHoursAvg && maxBestHoursAvg > 0
                              ? 'hsl(var(--primary))'
                              : 'hsl(var(--muted-foreground) / 0.25)'
                          }
                        />
                      ))}
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

        {/* Content Velocity */}
        {velocityData.length > 0 && (
          <section>
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="eyebrow mb-1">Output</div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>Content Velocity</h2>
                <p className="text-[12px] text-muted-foreground mb-4">
                  Planned vs published this month
                  {consistencyScore !== null && (
                    <span className={`ml-2 font-semibold ${consistencyScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : consistencyScore >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                      · {consistencyScore}% consistency
                    </span>
                  )}
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={velocityData} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="published" name="Published" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="planned" name="Planned / Draft" fill="hsl(var(--muted-foreground) / 0.3)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* Competitor Benchmark */}
        {(allMetrics.length > 0 || (competitorPostsQuery.data ?? []).length > 0) && (
          <section>
            <div className="eyebrow mb-1">Benchmark</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>Competitor Benchmark</h2>
            <p className="text-[12px] text-muted-foreground mb-4">
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
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
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
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-base font-semibold">AI Content Audit</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Personalized recommendations based on your performance data
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleAudit}
                disabled={auditLoading || allMetrics.length < 3}
                className="shrink-0"
              >
                {auditLoading ? 'Analyzing…' : auditInsights ? 'Re-run' : 'Run Audit'}
              </Button>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Date:</span>
              <input
                type="date"
                value={auditDateFrom}
                max={auditDateTo}
                onChange={(e) => setAuditDateFrom(e.target.value)}
                className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
              />
              <span className="text-[11px] text-muted-foreground">to</span>
              <input
                type="date"
                value={auditDateTo}
                min={auditDateFrom}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setAuditDateTo(e.target.value)}
                className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
              />
              <select
                value={auditPlatform}
                onChange={(e) => setAuditPlatform(e.target.value)}
                className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
              >
                <option value="all">All platforms</option>
                {SYNC_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4">
            {allMetrics.length < 3 && !auditInsights && (
              <p className="text-sm text-muted-foreground py-2">
                Log at least 3 posts to run an AI audit.
              </p>
            )}

            {auditInsights && (() => {
              const categories = ['all', ...Array.from(new Set(auditInsights.map((i) => i.category)))]
              const filtered = auditInsights.filter(
                (i) => auditCategoryFilter === 'all' || i.category === auditCategoryFilter
              )
              const sorted = auditSortBy === 'category'
                ? [...filtered].sort((a, b) => a.category.localeCompare(b.category))
                : filtered

              return (
                <div className="space-y-3">
                  {/* Sort + category filter */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={auditSortBy}
                      onChange={(e) => setAuditSortBy(e.target.value as 'default' | 'category')}
                      className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
                    >
                      <option value="default">Sort: Default</option>
                      <option value="category">Sort: Category</option>
                    </select>
                    <div className="flex flex-wrap gap-1">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setAuditCategoryFilter(cat)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                            auditCategoryFilter === cat
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {cat === 'all' ? 'All' : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {sorted.map((insight, i) => (
                    <div key={i} className="flex gap-3 rounded-lg border border-border bg-background p-4">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary h-fit shrink-0 mt-0.5">
                        {insight.category}
                      </span>
                      <p className="text-sm text-foreground">{insight.text}</p>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </section>

        {/* Channel breakdown table */}
        {channelStats.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="eyebrow">Channel breakdown</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Channel</th>
                    <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Reach</th>
                    <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Engagement</th>
                    <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Posts</th>
                    <th className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">8-wk trend</th>
                  </tr>
                </thead>
                <tbody>
                  {channelStats.map((ch) => (
                    <tr key={ch.platform} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${PLATFORM_CHIP_COLORS[ch.platform as Platform] ?? 'bg-muted text-muted-foreground'}`}>
                          {ch.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="mono-num text-[13px]">{fmt(ch.totalReach)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="mono-num text-[13px]">
                          {ch.avgEng != null ? `${ch.avgEng.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="mono-num text-[13px]">{ch.count}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <Sparkline data={ch.weekBuckets} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Metrics table */}
        {displayed.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Platform</th>
                  <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Views</th>
                  <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Likes</th>
                  <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Comments</th>
                  <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Eng. Rate</th>
                  <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">URL</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {displayed.slice(0, metricsLimit).map((m, i) => (
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
            {displayed.length > metricsLimit && (
              <div className="px-4 py-3 border-t border-border text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setMetricsLimit((n) => n + 50)}
                >
                  Load more ({displayed.length - metricsLimit} remaining)
                </Button>
              </div>
            )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                onClick={() => setConfirmDeleteOpen(true)}
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

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this metric log?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { setConfirmDeleteOpen(false); await handleDelete() }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
