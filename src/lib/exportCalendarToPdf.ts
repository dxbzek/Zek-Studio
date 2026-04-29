import { format, parseISO, startOfWeek } from 'date-fns'
import { CONTENT_FORMATS, CONTENT_THEMES } from '@/types'
import type { CalendarEntry, ContentFormat, ContentTheme, Platform } from '@/types'
import type { EntryGroup } from '@/components/calendar/entryGroups'

const URL_RE = /https?:\/\/[^\s<>"'()\[\]]+/gi

function extractLinks(text: string): string[] {
  const matches = text.match(URL_RE) ?? []
  const cleaned = matches.map((u) => u.replace(/[.,;:!?]+$/, '')).filter(Boolean)
  return Array.from(new Set(cleaned))
}

function lineBeats(script: string): string[] {
  return script.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
}

function formatLabel(value: ContentFormat | null): string {
  if (!value) return ''
  return CONTENT_FORMATS.find((f) => f.value === value)?.label ?? value
}

function themeLabel(value: string): string {
  return CONTENT_THEMES.find((t) => t.value === value as ContentTheme)?.label ?? value
}

function platformsLabel(platforms: Platform[]): string {
  return platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
}

function safeFilename(s: string): string {
  return s.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'calendar'
}

const FORMAT_BG: Record<ContentFormat, string> = {
  reel:             '#a855f7',
  carousel:         '#3b82f6',
  static:           '#10b981',
  emergency_backup: '#ef4444',
}

export type ExportSections = {
  groupBy: 'date' | 'format' | 'talent'
  sections: { heading: string; entries: EntryGroup[] }[]
  rangeLabel: string
  brandName: string
}

export async function exportCalendarToPdf({ brandName, rangeLabel, sections, groupBy }: ExportSections): Promise<void> {
  const { Document, Page, Text, View, Link, StyleSheet, pdf } = await import('@react-pdf/renderer')
  const React = await import('react')

  const styles = StyleSheet.create({
    page: { paddingTop: 40, paddingBottom: 50, paddingHorizontal: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#111111' },
    eyebrow: { fontSize: 8, color: '#666666', letterSpacing: 1, textTransform: 'uppercase' },
    h1: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginTop: 2, marginBottom: 4 },
    summary: { fontSize: 9, color: '#555555', marginBottom: 18 },
    sectionHeader: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#444444', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#dddddd', marginTop: 14, marginBottom: 6 },
    entry: { padding: 10, marginVertical: 5, backgroundColor: '#fafafa', borderLeftWidth: 3, borderLeftColor: '#bbbbbb', borderRadius: 3 },
    title: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
    meta: { fontSize: 9, color: '#555555', marginBottom: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
    pill: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, marginRight: 6, overflow: 'hidden' },
    metaText: { fontSize: 9, color: '#555555' },
    sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#444444', marginTop: 6, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
    beat: { fontSize: 10, marginVertical: 1, flexDirection: 'row' },
    beatNum: { fontFamily: 'Helvetica-Bold', color: '#888888', width: 18 },
    beatText: { flex: 1 },
    notes: { fontSize: 10, color: '#333333', marginTop: 2 },
    link: { fontSize: 9, color: '#2563eb', textDecoration: 'underline', marginVertical: 1 },
    empty: { fontSize: 10, color: '#999999', fontStyle: 'italic' },
    footer: { position: 'absolute', bottom: 22, left: 40, right: 40, fontSize: 8, color: '#999999', borderTopWidth: 1, borderTopColor: '#eeeeee', paddingTop: 6 },
  })

  const totalEntries = sections.reduce((acc, s) => acc + s.entries.length, 0)

  function entryBlock(g: EntryGroup) {
    const r: CalendarEntry = g.representative
    const fmt = r.format as ContentFormat | null
    const beats = lineBeats(r.script ?? '')
    const links = extractLinks(`${r.script ?? ''}\n${r.notes ?? ''}`)
    const metaParts = [themeLabel(r.content_type), platformsLabel(g.platforms), r.status.charAt(0).toUpperCase() + r.status.slice(1)]
    if (r.assigned_talent) metaParts.push(`Talent: ${r.assigned_talent}`)
    // When grouping by date, the date is in the section header. For other
    // groupings, surface the date inside the meta line so each entry is
    // self-locating.
    if (groupBy !== 'date') {
      metaParts.unshift(format(parseISO(r.scheduled_date), 'MMM d'))
    }

    return React.createElement(View, {
      key: g.id,
      wrap: false,
      style: [styles.entry, fmt ? { borderLeftColor: FORMAT_BG[fmt] } : {}],
    }, [
      React.createElement(Text, { key: 'title', style: styles.title }, r.title),
      React.createElement(View, { key: 'meta', style: styles.meta }, [
        fmt
          ? React.createElement(Text, { key: 'pill', style: [styles.pill, { backgroundColor: FORMAT_BG[fmt] }] }, formatLabel(fmt).toUpperCase())
          : null,
        React.createElement(Text, { key: 'metatext', style: styles.metaText }, metaParts.join(' · ')),
      ]),
      beats.length > 0 ? React.createElement(Text, { key: 'sl', style: styles.sectionLabel }, 'Script') : null,
      ...beats.map((line, i) =>
        React.createElement(View, { key: `b${i}`, style: styles.beat }, [
          React.createElement(Text, { key: 'n', style: styles.beatNum }, `${i + 1}.`),
          React.createElement(Text, { key: 't', style: styles.beatText }, line),
        ]),
      ),
      r.notes && r.notes.trim().length > 0 ? React.createElement(Text, { key: 'nl', style: styles.sectionLabel }, 'Notes') : null,
      r.notes && r.notes.trim().length > 0 ? React.createElement(Text, { key: 'n', style: styles.notes }, r.notes) : null,
      links.length > 0 ? React.createElement(Text, { key: 'll', style: styles.sectionLabel }, 'Links') : null,
      ...links.map((u) =>
        React.createElement(Link, { key: u, src: u, style: styles.link }, u),
      ),
    ])
  }

  // When grouping by date, compute which sections are the start of a new
  // calendar week so we can insert page breaks between them. Other
  // groupings flow continuously.
  const sectionStartsNewWeek: boolean[] = sections.map((s, i) => {
    if (groupBy !== 'date') return false
    if (i === 0) return false
    const first = s.entries[0]?.representative.scheduled_date
    const prevFirst = sections[i - 1]?.entries[0]?.representative.scheduled_date
    if (!first || !prevFirst) return false
    const w1 = format(startOfWeek(parseISO(first), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const w2 = format(startOfWeek(parseISO(prevFirst), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    return w1 !== w2
  })

  function sectionBlock(s: { heading: string; entries: EntryGroup[] }, isPageBreak: boolean) {
    return React.createElement(View, {
      key: s.heading,
      break: isPageBreak,
    }, [
      React.createElement(Text, { key: 'h', style: styles.sectionHeader }, s.heading.toUpperCase()),
      ...s.entries.map((g) => entryBlock(g)),
    ])
  }

  const doc = React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: styles.page }, [
      React.createElement(Text, { key: 'eb', style: styles.eyebrow }, 'CONTENT CALENDAR'),
      React.createElement(Text, { key: 'h1', style: styles.h1 }, `${brandName} · ${rangeLabel}`),
      React.createElement(Text, { key: 'sm', style: styles.summary },
        `${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'} · grouped by ${groupBy} · generated ${format(new Date(), 'MMM d, yyyy')}`,
      ),
      sections.length === 0
        ? React.createElement(Text, { key: 'em', style: styles.empty }, 'No entries match the selected range and filters.')
        : null,
      ...sections.map((s, i) => sectionBlock(s, sectionStartsNewWeek[i])),
      React.createElement(
        Text,
        {
          key: 'ft',
          fixed: true,
          style: styles.footer,
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Exported from Zek Studio · ${format(new Date(), 'MMM d, yyyy · HH:mm')} · Page ${pageNumber} of ${totalPages}`,
        },
      ),
    ]),
  )

  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const stamp = format(new Date(), 'yyyy-MM-dd')
  a.download = `${safeFilename(`${brandName}_${rangeLabel}_calendar`)}_${stamp}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
