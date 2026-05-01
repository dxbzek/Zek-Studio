import { format, parseISO } from 'date-fns'
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
  if (!value) return '—'
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

const FORMAT_HEX: Record<ContentFormat, string> = {
  reel:             'A855F7',
  carousel:         '3B82F6',
  static:           '10B981',
  emergency_backup: 'EF4444',
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

export async function exportCalendarToWord({ brandName, rangeLabel, sections, groupBy }: ExportSections): Promise<void> {
  const docx = await import('docx')
  const {
    Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType,
    ExternalHyperlink, ShadingType, Footer, PageNumber, PageBreak,
  } = docx

  function sectionH(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, color: '555555', size: 20, allCaps: true })],
    })
  }

  const cover = computeCoverStats(sections)
  const docChildren: InstanceType<typeof Paragraph>[] = []

  // ── Cover page ───────────────────────────────────────────────────────────
  docChildren.push(
    new Paragraph({
      spacing: { before: 1200, after: 120 },
      children: [new TextRun({ text: 'CONTENT CALENDAR', color: '888888', size: 22, allCaps: true })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 80 },
      children: [new TextRun({ text: brandName, bold: true, size: 60 })],
    }),
    new Paragraph({
      spacing: { after: 480 },
      children: [new TextRun({ text: rangeLabel, size: 28, color: '555555' })],
    }),
  )

  function statSection(label: string, lines: { name: string; count: number; hex: string }[]) {
    docChildren.push(new Paragraph({
      spacing: { before: 240, after: 60 },
      children: [new TextRun({ text: label.toUpperCase(), color: '666666', size: 18, allCaps: true, bold: true })],
    }))
    for (const l of lines) {
      if (l.count === 0) continue
      docChildren.push(new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: '  ●  ',
            color: l.hex,
            size: 28,
            bold: true,
          }),
          new TextRun({ text: l.name, size: 22 }),
          new TextRun({ text: '  ', size: 22 }),
          new TextRun({ text: String(l.count), size: 22, bold: true, color: '222222' }),
        ],
      }))
    }
  }

  // Total entries headline
  docChildren.push(new Paragraph({
    spacing: { before: 120, after: 40 },
    children: [new TextRun({ text: 'TOTAL ENTRIES', color: '666666', size: 18, allCaps: true, bold: true })],
  }))
  docChildren.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: String(cover.total), bold: true, size: 60, color: '222222' })],
  }))

  statSection('By format', [
    { name: 'Reels',            count: cover.byFormat.reel,             hex: 'A855F7' },
    { name: 'Carousels',        count: cover.byFormat.carousel,         hex: '3B82F6' },
    { name: 'Street Interview', count: cover.byFormat.static,           hex: '10B981' },
    { name: 'Emergency Backup', count: cover.byFormat.emergency_backup, hex: 'EF4444' },
    { name: 'Format unset',     count: cover.byFormat.unset,            hex: '9CA3AF' },
  ])

  statSection('By status', [
    { name: 'Draft',     count: cover.byStatus.draft,     hex: 'A1A1AA' },
    { name: 'Scheduled', count: cover.byStatus.scheduled, hex: 'F59E0B' },
    { name: 'Published', count: cover.byStatus.published, hex: '10B981' },
  ])

  docChildren.push(new Paragraph({
    spacing: { before: 360 },
    children: [
      new TextRun({ text: `Grouped by ${groupBy} · generated ${format(new Date(), 'MMM d, yyyy')}`, color: '888888', italics: true, size: 18 }),
    ],
  }))

  // Force a page break so content starts on its own page.
  docChildren.push(new Paragraph({
    children: [new PageBreak()],
  }))

  // ── Content page header ──────────────────────────────────────────────────
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 240 },
      children: [new TextRun({ text: `${brandName} · ${rangeLabel}`, bold: true, size: 28 })],
    }),
  )

  if (sections.length === 0) {
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: 'No entries match the selected range and filters.', italics: true, color: '999999', size: 22 })],
    }))
  }

  for (const s of sections) {
    docChildren.push(sectionH(s.heading))

    for (const g of s.entries) {
      const r: CalendarEntry = g.representative
      const fmt = r.format as ContentFormat | null
      const beats = lineBeats(r.script ?? '')
      const links = extractLinks(`${r.script ?? ''}\n${r.notes ?? ''}`)

      const titleRuns: InstanceType<typeof TextRun>[] = []
      if (fmt) {
        titleRuns.push(new TextRun({
          text: ` ${formatLabel(fmt).toUpperCase()} `,
          bold: true, color: 'FFFFFF', size: 18,
          shading: { type: ShadingType.SOLID, color: FORMAT_HEX[fmt], fill: FORMAT_HEX[fmt] },
        }))
        titleRuns.push(new TextRun({ text: '  ', size: 22 }))
      }
      titleRuns.push(new TextRun({ text: r.title, bold: true, size: 26 }))

      docChildren.push(
        new Paragraph({ spacing: { before: 180, after: 60 }, children: titleRuns }),
      )

      const metaParts = [
        themeLabel(r.content_type),
        platformsLabel(g.platforms),
        r.status.charAt(0).toUpperCase() + r.status.slice(1),
      ]
      if (r.assigned_talent) metaParts.push(`Talent: ${r.assigned_talent}`)
      if (groupBy !== 'date') metaParts.unshift(format(parseISO(r.scheduled_date), 'MMM d'))

      docChildren.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: metaParts.join(' · '), color: '666666', size: 20 })],
        }),
      )

      if (beats.length > 0) {
        docChildren.push(new Paragraph({
          spacing: { before: 60, after: 40 },
          children: [new TextRun({ text: 'Script', bold: true, color: '444444', size: 20 })],
        }))
        beats.forEach((line, idx) => {
          docChildren.push(
            new Paragraph({
              spacing: { after: 40 },
              indent: { left: 240 },
              children: [
                new TextRun({ text: `${idx + 1}. `, bold: true, color: '888888', size: 22 }),
                new TextRun({ text: line, size: 22 }),
              ],
            }),
          )
        })
      }

      if (r.notes && r.notes.trim().length > 0) {
        docChildren.push(new Paragraph({
          spacing: { before: 60, after: 40 },
          children: [new TextRun({ text: 'Notes', bold: true, color: '444444', size: 20 })],
        }))
        r.notes.split('\n').forEach((line) => {
          docChildren.push(
            new Paragraph({
              spacing: { after: 40 },
              indent: { left: 240 },
              children: [new TextRun({ text: line, size: 22 })],
            }),
          )
        })
      }

      if (links.length > 0) {
        docChildren.push(new Paragraph({
          spacing: { before: 60, after: 40 },
          children: [new TextRun({ text: 'Links', bold: true, color: '444444', size: 20 })],
        }))
        links.forEach((url) => {
          docChildren.push(
            new Paragraph({
              spacing: { after: 40 },
              indent: { left: 240 },
              children: [
                new ExternalHyperlink({
                  link: url,
                  children: [new TextRun({ text: url, color: '2563EB', underline: {}, size: 20 })],
                }),
              ],
            }),
          )
        })
      }
    }
  }

  const doc = new Document({
    creator: 'Zek Studio',
    title: `${brandName} · ${rangeLabel}`,
    sections: [{
      properties: {},
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', color: '999999', size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], color: '999999', size: 18 }),
              new TextRun({ text: ' of ', color: '999999', size: 18 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], color: '999999', size: 18 }),
            ],
          })],
        }),
      },
      children: docChildren,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const stamp = format(new Date(), 'yyyy-MM-dd')
  a.download = `${safeFilename(`${brandName}_${rangeLabel}_calendar`)}_${stamp}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
