import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Sparkles, ExternalLink } from 'lucide-react'
import { fmtCompact } from '@/lib/formatting'
import type { PostMetric } from '@/types'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function engagementRate(m: PostMetric): string {
  const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0)
  const base = m.reach ?? m.impressions ?? m.views
  if (!base || base === 0) return '—'
  return `${((eng / base) * 100).toFixed(1)}%`
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-sm space-y-2">
        <div className="eyebrow mb-2">Report</div>
        <h1
          style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em' }}
        >
          Report unavailable
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export default function PublicReportPage() {
  const { token } = useParams<{ token: string }>()
  const tokenValid = !!token && UUID_RE.test(token)

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-report', token],
    queryFn: async () => {
      const res = await fetch(`${FUNCTIONS_URL}/get-report-data?token=${encodeURIComponent(token!)}`)
      const isJson = res.headers.get('content-type')?.includes('application/json') ?? false
      const json = isJson ? await res.json().catch(() => ({})) : {}
      if (!res.ok) {
        throw new Error(
          (json as { error?: string; message?: string })?.error
            ?? (json as { error?: string; message?: string })?.message
            ?? `Server returned ${res.status}`,
        )
      }
      if (!isJson) throw new Error('Unexpected response from server')
      return json as {
        brand: { name: string; niche: string; color: string }
        metrics: PostMetric[]
      }
    },
    enabled: tokenValid,
    // Public reports are read-only snapshots — refresh on tab focus so stale
    // data doesn't linger when a client leaves the tab open overnight.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  if (!tokenValid) return <ErrorScreen message="This report link is invalid or has expired." />

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div role="status" aria-live="polite" className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading report…</p>
        </div>
      </div>
    )
  }

  if (error || !data) return <ErrorScreen message="This report link is invalid or has expired." />

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

  const accent = brand.color || '#6366f1'

  return (
    <div className="min-h-screen bg-background">
      {/* Editorial hero */}
      <header
        className="relative overflow-hidden border-b border-border/70"
        style={{
          background: `linear-gradient(180deg, color-mix(in oklch, ${accent} 10%, var(--background)) 0%, var(--background) 75%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, color-mix(in oklch, ${accent} 14%, transparent) 1px, transparent 1px),
              linear-gradient(to bottom, color-mix(in oklch, ${accent} 14%, transparent) 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 75%)',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-6 pt-10 pb-10">
          <div className="flex items-center justify-between mb-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-500">
            <div className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-background shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                style={{ backgroundColor: accent }}
                aria-hidden
              />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Performance Report
              </span>
            </div>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/70">
              Issued {format(new Date(), 'MMM d, yyyy')}
            </span>
          </div>

          <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-700" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(40px, 7vw, 60px)',
                fontWeight: 400,
                lineHeight: 1.02,
                letterSpacing: '-0.025em',
              }}
            >
              {brand.name}
            </h1>
            <p className="text-[14px] text-muted-foreground mt-2">{brand.niche}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Stat tiles */}
        <section
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
          style={{ animationDelay: '60ms', animationFillMode: 'backwards' }}
        >
          {[
            { label: 'Total posts', value: String(totalPosts) },
            { label: 'Total views', value: fmtCompact(totalViews) },
            { label: 'Total likes', value: fmtCompact(totalLikes) },
            { label: 'Avg engagement', value: avgEngRate },
          ].map(({ label, value }, i) => (
            <div
              key={label}
              className="premium-card group relative overflow-hidden rounded-xl ring-1 ring-border/80 p-4 transition-all duration-300 hover:-translate-y-px hover:ring-border"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-50 transition-opacity duration-500 group-hover:opacity-90"
                style={{
                  background: `radial-gradient(closest-side, color-mix(in oklch, ${accent} ${i === 0 ? 25 : 18}%, transparent) 0%, transparent 75%)`,
                }}
              />
              <p className="relative eyebrow" style={{ fontSize: 10 }}>{label}</p>
              <p
                className="relative mono-num mt-1.5"
                style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.025em' }}
              >
                {value}
              </p>
            </div>
          ))}
        </section>

        {/* Platform breakdown */}
        {platformRows.length > 0 && (
          <section>
            <SectionHeader number="01" title="Platform breakdown" />
            {/* Mobile: stacked cards */}
            <div className="sm:hidden space-y-2">
              {platformRows.map(([platform, s]) => (
                <div key={platform} className="premium-card rounded-xl ring-1 ring-border/80 p-4">
                  <div className="font-medium capitalize text-sm">{platform}</div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Posts</div>
                      <div className="tabular-nums mt-0.5 mono-num">{s.count}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Avg views</div>
                      <div className="tabular-nums mt-0.5 mono-num">{fmtCompact(Math.round(s.views / s.count))}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Avg likes</div>
                      <div className="tabular-nums mt-0.5 mono-num">{fmtCompact(Math.round(s.likes / s.count))}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block premium-card rounded-xl ring-1 ring-border/80 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Platform</th>
                    <th className="text-right px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Posts</th>
                    <th className="text-right px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Avg views</th>
                    <th className="text-right px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Avg likes</th>
                  </tr>
                </thead>
                <tbody>
                  {platformRows.map(([platform, s]) => (
                    <tr key={platform} className="border-b border-border/40 last:border-0 transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3 font-medium capitalize">{platform}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs mono-num">{s.count}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs mono-num">
                        {fmtCompact(Math.round(s.views / s.count))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs mono-num">
                        {fmtCompact(Math.round(s.likes / s.count))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Top posts */}
        {topPosts.length > 0 && (
          <section>
            <SectionHeader number="02" title="Top posts" />
            {/* Mobile: stacked cards */}
            <div className="sm:hidden space-y-2">
              {topPosts.map((m) => (
                <div key={m.id} className="premium-card rounded-xl ring-1 ring-border/80 p-4">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="capitalize font-medium text-foreground">{m.platform}</span>
                    <span>{m.posted_at ? format(parseISO(m.posted_at), 'MMM d, yyyy') : '—'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Views</div>
                      <div className="tabular-nums mt-0.5 mono-num">{fmtCompact(m.views)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Likes</div>
                      <div className="tabular-nums mt-0.5 mono-num">{fmtCompact(m.likes)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Eng.</div>
                      <div className="tabular-nums mt-0.5 mono-num">{engagementRate(m)}</div>
                    </div>
                  </div>
                  {m.post_url && (
                    <a
                      href={m.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-foreground/80 underline underline-offset-2 hover:text-foreground transition-colors truncate"
                    >
                      {m.post_url.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block premium-card rounded-xl ring-1 ring-border/80 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Date</th>
                    <th className="text-left px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Platform</th>
                    <th className="text-right px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Views</th>
                    <th className="text-right px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Likes</th>
                    <th className="text-right px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Eng. rate</th>
                    <th className="text-left px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {topPosts.map((m) => (
                    <tr key={m.id} className="border-b border-border/40 last:border-0 transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {m.posted_at ? format(parseISO(m.posted_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize">{m.platform}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums mono-num">{fmtCompact(m.views)}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums mono-num">{fmtCompact(m.likes)}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums mono-num">{engagementRate(m)}</td>
                      <td className="px-4 py-3 text-xs max-w-[160px]">
                        {m.post_url ? (
                          <a
                            href={m.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-foreground/80 underline underline-offset-2 hover:text-foreground transition-colors"
                          >
                            <span className="truncate max-w-[120px]">{m.post_url.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
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
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 pb-10">
        <div className="border-t border-border/60 pt-5 flex items-center justify-center gap-1.5">
          <Sparkles className="h-3 w-3 text-muted-foreground/60" aria-hidden />
          <p className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">
            Powered by Zek Studio
          </p>
        </div>
      </footer>
    </div>
  )
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <span
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 tabular-nums"
      >
        № {number}
      </span>
      <h2
        style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}
      >
        {title}
      </h2>
      <span aria-hidden className="flex-1 h-px bg-border/60 ml-2" />
    </div>
  )
}
