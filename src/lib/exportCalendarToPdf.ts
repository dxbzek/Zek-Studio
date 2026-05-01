import { format, parseISO, startOfWeek } from 'date-fns'
import { CONTENT_FORMATS, CONTENT_THEMES } from '@/types'
import type { CalendarEntry, ContentFormat, ContentTheme, Platform } from '@/types'
import { hasPlatformVariants } from '@/components/calendar/entryGroups'
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

type CoverStats = {
  total: number
  byFormat: Record<ContentFormat | 'unset', number>
  byStatus: Record<'draft' | 'scheduled' | 'published', number>
}

function computeCoverStats(sections: { entries: EntryGroup[] }[]): CoverStats {
  const stats: CoverStats = {
    total: 0,
    byFormat: { reel: 0, carousel: 0, static: 0, emergency_backup: 0, unset: 0 },
    byStatus: { draft: 0, scheduled: 0, published: 0 },
  }
  for (const s of sections) {
    for (const g of s.entries) {
      stats.total += 1
      const f = (g.representative.format as ContentFormat | null) ?? 'unset'
      stats.byFormat[f] = (stats.byFormat[f] ?? 0) + 1
      const st = g.representative.status
      if (st === 'draft' || st === 'scheduled' || st === 'published') {
        stats.byStatus[st] += 1
      }
    }
  }
  return stats
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

  // Editorial typography: bigger body, generous line-height, calm muted
  // accents. Entries lose their gray box backgrounds in favor of a single
  // top divider — reads like a publication, not a form.
  const INK = '#1a1a1a'
  const MUTED = '#6b6b6b'
  const FAINT = '#9a9a9a'
  const RULE = '#d9d9d9'
  const LINK = '#1f4ed8'

  const styles = StyleSheet.create({
    page: { paddingTop: 56, paddingBottom: 62, paddingHorizontal: 56, fontSize: 11, lineHeight: 1.55, fontFamily: 'Helvetica', color: INK },
    eyebrow: { fontSize: 9, color: FAINT, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 4 },
    h1: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginTop: 0, marginBottom: 6, lineHeight: 1.15, letterSpacing: -0.3 },
    summary: { fontSize: 10, color: MUTED, marginBottom: 22, letterSpacing: 0.2 },

    // Cover page
    coverPage: { paddingTop: 110, paddingBottom: 62, paddingHorizontal: 64, fontSize: 11, lineHeight: 1.55, fontFamily: 'Helvetica', color: INK },
    coverEyebrow: { fontSize: 9, color: FAINT, letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 14 },
    coverTitle: { fontSize: 44, fontFamily: 'Helvetica-Bold', marginBottom: 8, lineHeight: 1.05, letterSpacing: -0.6 },
    coverRange: { fontSize: 14, color: MUTED, marginBottom: 36, letterSpacing: 0.2 },
    coverStatBlock: { marginTop: 26 },
    coverStatLabel: { fontSize: 9, color: MUTED, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 },
    coverStatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    coverStatChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: RULE, borderRadius: 14 },
    coverStatChipDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
    coverStatChipText: { fontSize: 10.5, color: INK },
    coverStatChipNum: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginLeft: 6, color: INK },
    coverFooter: { position: 'absolute', bottom: 36, left: 64, right: 64, fontSize: 9, color: FAINT, letterSpacing: 1.2, textTransform: 'uppercase' },

    // Section / entry typography
    sectionHeader: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 1.4, paddingBottom: 6, borderBottomWidth: 0.6, borderBottomColor: RULE, marginTop: 22, marginBottom: 12 },

    // No more gray box. Entries are separated by a thin top rule + a
    // colored format accent rule above the title (when format is set).
    entry: { paddingTop: 14, paddingBottom: 4, marginBottom: 8, borderTopWidth: 0.6, borderTopColor: RULE },
    formatRule: { width: 28, height: 2, marginBottom: 6, borderRadius: 1 },
    title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4, lineHeight: 1.25, letterSpacing: -0.2 },
    meta: { fontSize: 9.5, color: MUTED, marginBottom: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
    pill: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginRight: 8, letterSpacing: 0.6, overflow: 'hidden' },
    metaText: { fontSize: 9.5, color: MUTED, letterSpacing: 0.2 },

    sectionLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: MUTED, marginTop: 10, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1.2 },
    beat: { fontSize: 11, lineHeight: 1.55, marginVertical: 1.5, flexDirection: 'row', paddingLeft: 4 },
    beatNum: { fontFamily: 'Helvetica-Bold', color: FAINT, width: 18, fontSize: 10 },
    beatText: { flex: 1, color: INK },
    notes: { fontSize: 11, lineHeight: 1.55, color: '#3a3a3a', marginTop: 2, paddingLeft: 4 },
    link: { fontSize: 10, color: LINK, textDecoration: 'underline', marginVertical: 1.5, paddingLeft: 4 },

    // Per-platform sub-block when variants differ. Quiet platform label
    // + thin colored bar — keeps the page calm and readable.
    variantHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 4, gap: 8 },
    variantBar: { width: 3, height: 14, borderRadius: 2 },
    variantLabel: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: 1.2, textTransform: 'uppercase' },
    variantFmt: { fontSize: 9.5, color: MUTED, letterSpacing: 0.4 },

    empty: { fontSize: 11, color: FAINT, fontStyle: 'italic' },
    footer: { position: 'absolute', bottom: 28, left: 56, right: 56, fontSize: 8.5, color: FAINT, borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 8, letterSpacing: 1, textTransform: 'uppercase' },
  })

  const totalEntries = sections.reduce((acc, s) => acc + s.entries.length, 0)
  const cover = computeCoverStats(sections)

  function statChip(label: string, count: number, color: string) {
    if (count === 0) return null
    return React.createElement(View, { key: label, style: styles.coverStatChip }, [
      React.createElement(View, { key: 'd', style: [styles.coverStatChipDot, { backgroundColor: color }] }),
      React.createElement(Text, { key: 't', style: styles.coverStatChipText }, label),
      React.createElement(Text, { key: 'n', style: styles.coverStatChipNum }, String(count)),
    ])
  }

  const coverPage = React.createElement(Page, { size: 'A4', style: styles.coverPage }, [
    React.createElement(Text, { key: 'eb', style: styles.coverEyebrow }, 'CONTENT CALENDAR'),
    React.createElement(Text, { key: 't', style: styles.coverTitle }, brandName),
    React.createElement(Text, { key: 'r', style: styles.coverRange }, rangeLabel),

    React.createElement(View, { key: 'tb', style: styles.coverStatBlock }, [
      React.createElement(Text, { key: 'l', style: styles.coverStatLabel }, 'Total entries'),
      React.createElement(Text, { key: 'n', style: { fontSize: 36, fontFamily: 'Helvetica-Bold', color: '#222222' } }, String(cover.total)),
    ]),

    React.createElement(View, { key: 'fb', style: styles.coverStatBlock }, [
      React.createElement(Text, { key: 'l', style: styles.coverStatLabel }, 'By format'),
      React.createElement(View, { key: 'r', style: styles.coverStatRow }, [
        statChip('Reels',            cover.byFormat.reel,             '#a855f7'),
        statChip('Carousels',        cover.byFormat.carousel,         '#3b82f6'),
        statChip('Street Interview', cover.byFormat.static,           '#10b981'),
        statChip('Emergency Backup', cover.byFormat.emergency_backup, '#ef4444'),
        statChip('Format unset',     cover.byFormat.unset,            '#9ca3af'),
      ]),
    ]),

    React.createElement(View, { key: 'sb', style: styles.coverStatBlock }, [
      React.createElement(Text, { key: 'l', style: styles.coverStatLabel }, 'By status'),
      React.createElement(View, { key: 'r', style: styles.coverStatRow }, [
        statChip('Draft',     cover.byStatus.draft,     '#a1a1aa'),
        statChip('Scheduled', cover.byStatus.scheduled, '#f59e0b'),
        statChip('Published', cover.byStatus.published, '#10b981'),
      ]),
    ]),

    React.createElement(Text, { key: 'gb', style: styles.coverStatBlock }, [
      React.createElement(Text, { key: 'l', style: styles.coverStatLabel }, `Grouped by ${groupBy}`),
    ]),

    React.createElement(Text, { key: 'cf', fixed: true, style: styles.coverFooter },
      `Exported from Zek Studio · ${format(new Date(), 'MMM d, yyyy · HH:mm')}`,
    ),
  ])

  // Render the script / notes / format / links portion for one row. Used
  // both for the single-entry path and for each per-platform sub-block
  // when a group has divergent variants.
  function variantBody(r: CalendarEntry, keyPrefix: string) {
    const beats = lineBeats(r.script ?? '')
    const links = extractLinks(`${r.script ?? ''}\n${r.notes ?? ''}`)
    return [
      beats.length > 0 ? React.createElement(Text, { key: `${keyPrefix}sl`, style: styles.sectionLabel }, 'Script') : null,
      ...beats.map((line, i) =>
        React.createElement(View, { key: `${keyPrefix}b${i}`, style: styles.beat }, [
          React.createElement(Text, { key: 'n', style: styles.beatNum }, `${i + 1}.`),
          React.createElement(Text, { key: 't', style: styles.beatText }, line),
        ]),
      ),
      r.notes && r.notes.trim().length > 0 ? React.createElement(Text, { key: `${keyPrefix}nl`, style: styles.sectionLabel }, 'Notes') : null,
      r.notes && r.notes.trim().length > 0 ? React.createElement(Text, { key: `${keyPrefix}n`, style: styles.notes }, r.notes) : null,
      links.length > 0 ? React.createElement(Text, { key: `${keyPrefix}ll`, style: styles.sectionLabel }, 'Links') : null,
      ...links.map((u, i) =>
        React.createElement(Link, { key: `${keyPrefix}l${i}`, src: u, style: styles.link }, u),
      ),
    ]
  }

  function entryBlock(g: EntryGroup) {
    const r: CalendarEntry = g.representative
    const fmt = r.format as ContentFormat | null
    const metaParts = [themeLabel(r.content_type), platformsLabel(g.platforms), r.status.charAt(0).toUpperCase() + r.status.slice(1)]
    if (r.assigned_talent) metaParts.push(`Talent: ${r.assigned_talent}`)
    // When grouping by date, the date is in the section header. For other
    // groupings, surface the date inside the meta line so each entry is
    // self-locating.
    if (groupBy !== 'date') {
      metaParts.unshift(format(parseISO(r.scheduled_date), 'MMM d'))
    }

    const variants = hasPlatformVariants(g)

    // When variants differ, render one sub-block per platform under the
    // shared title/meta. When they're identical (legacy or single-platform),
    // render one block from the representative — same output as before.
    const body = variants
      ? g.entries.flatMap((e) => {
          const efmt = e.format as ContentFormat | null
          const efmtColor = efmt ? FORMAT_BG[efmt] : FAINT
          const labelText = efmt
            ? `${platformsLabel([e.platform]).toUpperCase()}  ·  ${formatLabel(efmt)}`
            : platformsLabel([e.platform]).toUpperCase()
          return [
            React.createElement(View, {
              key: `vh-${e.id}`,
              style: styles.variantHeader,
            }, [
              React.createElement(View, { key: 'bar', style: [styles.variantBar, { backgroundColor: efmtColor }] }),
              React.createElement(Text, { key: 'lbl', style: styles.variantLabel }, labelText),
            ]),
            ...variantBody(e, `v-${e.id}-`),
          ]
        })
      : variantBody(r, '')

    return React.createElement(View, {
      key: g.id,
      wrap: false,
      style: styles.entry,
    }, [
      // Slim format-color rule above the title — quieter than a left border.
      fmt
        ? React.createElement(View, { key: 'rule', style: [styles.formatRule, { backgroundColor: FORMAT_BG[fmt] }] })
        : null,
      React.createElement(Text, { key: 'title', style: styles.title }, r.title),
      React.createElement(View, { key: 'meta', style: styles.meta }, [
        fmt && !variants
          ? React.createElement(Text, { key: 'pill', style: [styles.pill, { backgroundColor: FORMAT_BG[fmt] }] }, formatLabel(fmt).toUpperCase())
          : null,
        React.createElement(Text, { key: 'metatext', style: styles.metaText }, metaParts.join('  ·  ')),
      ]),
      ...body,
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

  const contentPage = React.createElement(Page, { size: 'A4', style: styles.page }, [
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
  ])

  const doc = React.createElement(Document, {}, [coverPage, contentPage])

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
