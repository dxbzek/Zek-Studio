import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CONTENT_FORMATS, CONTENT_THEMES } from '@/types'
import type { CalendarEntry, ContentFormat, ContentTheme, Platform } from '@/types'
import { groupEntries, type EntryGroup } from '@/components/calendar/entryGroups'

const URL_RE = /https?:\/\/[^\s<>"'()\[\]]+/gi

function extractLinks(text: string): string[] {
  const matches = text.match(URL_RE) ?? []
  const cleaned = matches.map((u) => u.replace(/[.,;:!?]+$/, '')).filter(Boolean)
  return Array.from(new Set(cleaned))
}

function lineBeats(script: string): string[] {
  return script
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

function formatLabel(value: ContentFormat | null): string {
  if (!value) return '—'
  return CONTENT_FORMATS.find((f) => f.value === value)?.label ?? value
}

function themeLabel(value: string): string {
  return CONTENT_THEMES.find((t) => t.value === value as ContentTheme)?.label ?? value
}

function platformsLabel(platforms: Platform[]): string {
  return platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
}

const FORMAT_BG: Record<ContentFormat, string> = {
  reel:             '#a855f7',
  carousel:         '#3b82f6',
  static:           '#10b981',
  emergency_backup: '#ef4444',
}

export default function PrintCalendarPage() {
  const { brandId, year, month } = useParams<{ brandId: string; year: string; month: string }>()
  const yearNum = year ? parseInt(year, 10) : NaN
  // route uses 1–12 for human readability; date-fns uses 0–11
  const monthIdx = month ? parseInt(month, 10) - 1 : NaN
  const valid = !!brandId && Number.isInteger(yearNum) && Number.isInteger(monthIdx) && monthIdx >= 0 && monthIdx < 12

  const range = useMemo(() => {
    if (!valid) return null
    const first = startOfMonth(new Date(yearNum, monthIdx))
    const gridStart = format(startOfWeek(first, { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const gridEnd   = format(endOfWeek(endOfMonth(first), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const monthStart = format(first, 'yyyy-MM-dd')
    const monthEnd   = format(endOfMonth(first), 'yyyy-MM-dd')
    return { first, gridStart, gridEnd, monthStart, monthEnd }
  }, [valid, yearNum, monthIdx])

  const { data, isLoading, error } = useQuery({
    queryKey: ['print-calendar', brandId, yearNum, monthIdx],
    queryFn: async () => {
      if (!range || !brandId) throw new Error('Invalid route')
      const { data: rows, error: err } = await supabase
        .from('calendar_entries')
        .select('*')
        // Use the actual month range (not the grid range with leading/trailing
        // weeks) — the export should be the user's month, not whatever the
        // visual grid happens to overflow into.
        .eq('brand_id', brandId)
        .gte('scheduled_date', range.monthStart)
        .lte('scheduled_date', range.monthEnd)
        .order('scheduled_date', { ascending: true })
      if (err) throw err
      const entries = (rows ?? []) as CalendarEntry[]
      const groups = groupEntries(entries)
      // Group by date for the print layout
      const byDate = new Map<string, EntryGroup[]>()
      for (const g of groups) {
        const d = g.representative.scheduled_date
        if (!byDate.has(d)) byDate.set(d, [])
        byDate.get(d)!.push(g)
      }
      const dates = Array.from(byDate.keys()).sort()
      const { data: brand } = await supabase
        .from('brand_profiles')
        .select('name')
        .eq('id', brandId)
        .single()
      return {
        brandName: (brand as { name?: string } | null)?.name ?? 'Brand',
        dates,
        byDate,
        total: groups.length,
      }
    },
    enabled: !!range && !!brandId,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (data && typeof window !== 'undefined') {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [data])

  if (!valid) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Invalid print URL.</div>
  }
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-2">
          <p className="text-lg font-semibold">Couldn't load calendar</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Try again from the calendar page.'}
          </p>
        </div>
      </div>
    )
  }

  const monthLabel = range ? format(range.first, 'MMMM yyyy') : ''

  return (
    <>
      <style>{`
        @page { size: A4; margin: 16mm 14mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .day-block { break-inside: avoid; page-break-inside: avoid; }
          .entry-block { break-inside: avoid; page-break-inside: avoid; }
        }
        .cal-page {
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #111;
          background: #fff;
          max-width: 820px;
          margin: 0 auto;
          padding: 28px;
          line-height: 1.5;
        }
        .cal-page h1 { font-size: 26px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
        .cal-page .eyebrow { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; }
        .cal-page .summary { font-size: 12px; color: #555; margin: 4px 0 24px; }
        .cal-page .day-block { margin-top: 22px; }
        .cal-page .day-header { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #444; padding: 4px 0 6px; border-bottom: 1px solid #ddd; margin-bottom: 10px; }
        .cal-page .entry-block { padding: 10px 12px; margin: 8px 0; background: #fafafa; border: 1px solid #ececec; border-left: 4px solid #aaa; border-radius: 4px; }
        .cal-page .entry-title { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
        .cal-page .entry-meta { font-size: 11.5px; color: #555; margin: 0 0 8px; }
        .cal-page .entry-meta .pill { display: inline-block; padding: 1px 7px; border-radius: 999px; color: #fff; font-size: 10px; font-weight: 600; margin-right: 6px; vertical-align: 1px; }
        .cal-page ol.beats { padding-left: 20px; margin: 6px 0 0; font-size: 12.5px; }
        .cal-page ol.beats li { margin: 2px 0; }
        .cal-page p.notes { font-size: 12.5px; white-space: pre-wrap; margin: 6px 0 0; color: #333; }
        .cal-page .links { font-size: 12px; margin: 6px 0 0; padding-left: 20px; }
        .cal-page .links a { color: #2563eb; text-decoration: none; word-break: break-all; }
        .cal-page footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #888; }
      `}</style>

      <div className="cal-page">
        <div className="no-print" style={{
          background: '#fffbeb', border: '1px solid #fde68a', color: '#854d0e',
          padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 18,
        }}>
          Use <strong>Ctrl + P</strong> (or <strong>⌘ P</strong>) and choose
          <em> Save as PDF</em>. The print dialog opens automatically; close it
          to keep the on-screen view for review.
        </div>

        <div className="eyebrow">Content Calendar</div>
        <h1>{data.brandName} · {monthLabel}</h1>
        <div className="summary">
          {data.total} {data.total === 1 ? 'entry' : 'entries'} · generated {format(new Date(), 'MMM d, yyyy')}
        </div>

        {data.dates.length === 0 && (
          <p style={{ fontSize: 13, color: '#777' }}>No entries scheduled for this month.</p>
        )}

        {data.dates.map((d) => {
          const groups = data.byDate.get(d) ?? []
          return (
            <div key={d} className="day-block">
              <div className="day-header">{format(parseISO(d), 'EEEE · MMM d')}</div>
              {groups.map((g) => {
                const r = g.representative
                const fmt = r.format as ContentFormat | null
                const beats = lineBeats(r.script ?? '')
                const links = extractLinks(`${r.script ?? ''}\n${r.notes ?? ''}`)
                return (
                  <div
                    key={g.id}
                    className="entry-block"
                    style={fmt ? { borderLeftColor: FORMAT_BG[fmt] } : {}}
                  >
                    <h3 className="entry-title">{r.title}</h3>
                    <p className="entry-meta">
                      {fmt && (
                        <span className="pill" style={{ background: FORMAT_BG[fmt] }}>
                          {formatLabel(fmt)}
                        </span>
                      )}
                      {themeLabel(r.content_type)} · {platformsLabel(g.platforms)}
                      {' · '}
                      <span style={{ textTransform: 'capitalize' }}>{r.status}</span>
                      {r.assigned_talent ? ` · Talent: ${r.assigned_talent}` : ''}
                    </p>
                    {beats.length > 0 && (
                      <ol className="beats">
                        {beats.map((line, i) => <li key={i}>{line}</li>)}
                      </ol>
                    )}
                    {r.notes && <p className="notes">{r.notes}</p>}
                    {links.length > 0 && (
                      <ul className="links">
                        {links.map((u) => (
                          <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{u}</a></li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        <footer>
          Exported from Zek Studio on {format(new Date(), 'MMM d, yyyy · HH:mm')}.
        </footer>
      </div>
    </>
  )
}
