import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { CONTENT_FORMATS, CONTENT_THEMES } from '@/types'
import type { CalendarEntry, ContentFormat, ContentTheme } from '@/types'

const URL_RE = /https?:\/\/[^\s<>"'()\[\]]+/gi

function extractLinks(text: string): string[] {
  const matches = text.match(URL_RE) ?? []
  const cleaned = matches.map((u) => u.replace(/[.,;:!?]+$/, '')).filter(Boolean)
  return Array.from(new Set(cleaned))
}

function lineNumberedScript(script: string): string[] {
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

export default function PrintEntryPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['print-entry', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing entry id')
      const { data: rep, error: repErr } = await supabase
        .from('calendar_entries')
        .select('*')
        .eq('id', id)
        .single()
      if (repErr) throw repErr
      const r = rep as CalendarEntry
      const { data: siblings } = await supabase
        .from('calendar_entries')
        .select('*')
        .eq('brand_id', r.brand_id)
        .eq('title', r.title)
        .eq('scheduled_date', r.scheduled_date)
      const all = (siblings ?? []) as CalendarEntry[]
      const platforms = Array.from(new Set([r.platform, ...all.map((s) => s.platform)]))
      return { rep: r, platforms }
    },
    enabled: !!id,
    staleTime: 60_000,
  })

  // Auto-trigger the print dialog once the data has loaded so the user lands
  // straight at the system print sheet. They can cancel and we still leave a
  // readable on-screen view for editing/inspection.
  useEffect(() => {
    if (data && typeof window !== 'undefined') {
      const t = setTimeout(() => window.print(), 350)
      return () => clearTimeout(t)
    }
  }, [data])

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-2">
          <p className="text-lg font-semibold">Entry not available</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'This entry could not be loaded.'}
          </p>
        </div>
      </div>
    )
  }

  const { rep, platforms } = data
  const scriptBeats = lineNumberedScript(rep.script ?? '')
  const links = extractLinks(`${rep.script ?? ''}\n${rep.notes ?? ''}`)

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm 16mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .brief-page {
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #111;
          background: #fff;
          max-width: 780px;
          margin: 0 auto;
          padding: 32px 28px;
          line-height: 1.5;
        }
        .brief-page h1 { font-size: 26px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em; }
        .brief-page .eyebrow { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; }
        .brief-page table.meta { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px; }
        .brief-page table.meta td { padding: 6px 10px; vertical-align: top; border-top: 1px solid #eee; }
        .brief-page table.meta td:first-child { color: #666; width: 130px; font-weight: 500; }
        .brief-page h2 { font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #444; margin: 22px 0 8px; }
        .brief-page ol.beats { padding-left: 20px; margin: 0; font-size: 14px; }
        .brief-page ol.beats li { margin: 4px 0; }
        .brief-page p.body { font-size: 14px; white-space: pre-wrap; margin: 0; }
        .brief-page .links a { color: #2563eb; text-decoration: none; word-break: break-all; }
        .brief-page .links a:hover { text-decoration: underline; }
        .brief-page footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #888; }
      `}</style>

      <div className="brief-page">
        <div className="no-print" style={{
          background: '#fffbeb', border: '1px solid #fde68a', color: '#854d0e',
          padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 18,
        }}>
          Use <strong>Ctrl + P</strong> (or <strong>⌘ P</strong>) and choose
          <em> Save as PDF </em> for a clean PDF. The print dialog will open
          automatically; close it to keep editing the on-screen view.
        </div>

        <div className="eyebrow">{format(parseISO(rep.scheduled_date), 'EEEE · MMM d, yyyy')}</div>
        <h1>{rep.title}</h1>

        <table className="meta">
          <tbody>
            <tr>
              <td>Format</td>
              <td>{formatLabel(rep.format)}</td>
            </tr>
            <tr>
              <td>Content type</td>
              <td>{themeLabel(rep.content_type)}</td>
            </tr>
            <tr>
              <td>Platforms</td>
              <td>{platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}</td>
            </tr>
            <tr>
              <td>Status</td>
              <td style={{ textTransform: 'capitalize' }}>{rep.status}</td>
            </tr>
            {rep.assigned_talent && (
              <tr>
                <td>Talent</td>
                <td>{rep.assigned_talent}</td>
              </tr>
            )}
          </tbody>
        </table>

        {scriptBeats.length > 0 && (
          <>
            <h2>Script</h2>
            <ol className="beats">
              {scriptBeats.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </>
        )}

        {rep.notes && (
          <>
            <h2>Notes</h2>
            <p className="body">{rep.notes}</p>
          </>
        )}

        {links.length > 0 && (
          <>
            <h2>Reference links</h2>
            <ul className="links" style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
              {links.map((u) => (
                <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{u}</a></li>
              ))}
            </ul>
          </>
        )}

        <footer>
          Generated from the calendar on {format(new Date(), 'MMM d, yyyy · HH:mm')}.
        </footer>
      </div>
    </>
  )
}
