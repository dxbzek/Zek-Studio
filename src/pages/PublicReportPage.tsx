import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import type { PostMetric } from '@/types'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

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

export default function PublicReportPage() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-report', token],
    queryFn: async () => {
      const res = await fetch(`${FUNCTIONS_URL}/get-report-data?token=${token}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      return json as {
        brand: { name: string; niche: string; color: string }
        metrics: PostMetric[]
      }
    },
    enabled: !!token,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading report…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm space-y-2 px-6">
          <p className="text-lg font-semibold">Report unavailable</p>
          <p className="text-sm text-muted-foreground">
            This report link is invalid or has expired.
          </p>
        </div>
      </div>
    )
  }

  const { brand, metrics } = data

  // Compute summary stats
  const totalPosts = metrics.length
  const totalViews = metrics.reduce((s, m) => s + (m.views ?? 0), 0)
  const totalLikes = metrics.reduce((s, m) => s + (m.likes ?? 0), 0)
  const avgEngArr = metrics
    .map((m) => {
      const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0)
      const base = m.reach ?? m.impressions ?? m.views
      return base ? (eng / base) * 100 : null
    })
    .filter((v): v is number => v !== null)
  const avgEngRate =
    avgEngArr.length > 0
      ? `${(avgEngArr.reduce((a, b) => a + b, 0) / avgEngArr.length).toFixed(1)}%`
      : '—'

  // Per-platform breakdown
  const byPlatform: Record<string, { views: number; likes: number; count: number }> = {}
  for (const m of metrics) {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = { views: 0, likes: 0, count: 0 }
    byPlatform[m.platform].views += m.views ?? 0
    byPlatform[m.platform].likes += m.likes ?? 0
    byPlatform[m.platform].count++
  }
  const platformRows = Object.entries(byPlatform).sort((a, b) => b[1].views - a[1].views)

  // Top 10 posts
  const topPosts = [...metrics]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-background">
      {/* Header stripe */}
      <div
        className="h-2 w-full"
        style={{ backgroundColor: brand.color || '#6366f1' }}
      />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Brand info */}
        <div>
          <h1 className="text-3xl font-bold">{brand.name}</h1>
          <p className="text-muted-foreground mt-1">{brand.niche} · Analytics Report</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Posts', value: String(totalPosts) },
            { label: 'Total Views', value: fmt(totalViews) },
            { label: 'Total Likes', value: fmt(totalLikes) },
            { label: 'Avg Engagement', value: avgEngRate },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold mt-1">{value}</p>
            </div>
          ))}
        </div>

        {/* Platform breakdown */}
        {platformRows.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Platform Breakdown</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Platform</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Posts</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Avg Views</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Avg Likes</th>
                  </tr>
                </thead>
                <tbody>
                  {platformRows.map(([platform, s]) => (
                    <tr key={platform} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium capitalize">{platform}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">{s.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {fmt(Math.round(s.views / s.count))}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {fmt(Math.round(s.likes / s.count))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top posts */}
        {topPosts.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Top Posts</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Platform</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Views</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Likes</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Eng. Rate</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {topPosts.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {m.posted_at ? format(parseISO(m.posted_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize">{m.platform}</td>
                      <td className="px-4 py-2.5 text-xs text-right tabular-nums">{fmt(m.views)}</td>
                      <td className="px-4 py-2.5 text-xs text-right tabular-nums">{fmt(m.likes)}</td>
                      <td className="px-4 py-2.5 text-xs text-right tabular-nums">{engagementRate(m)}</td>
                      <td className="px-4 py-2.5 text-xs max-w-[120px]">
                        {m.post_url ? (
                          <a
                            href={m.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2 truncate block"
                          >
                            {m.post_url.replace(/^https?:\/\//, '').slice(0, 28)}…
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">Powered by Zek Studio</p>
        </div>
      </div>
    </div>
  )
}
