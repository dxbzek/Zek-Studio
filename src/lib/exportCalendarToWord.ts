import { format, parseISO } from 'date-fns'
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

  // Editorial color palette — matches the PDF export so a brand exporting
  // both formats sees the same calm tone.
  const INK = '1A1A1A'
  const MUTED = '6B6B6B'
  const FAINT = '9A9A9A'
  const LINK = '1F4ED8'

  function sectionH(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 480, after: 200 },
      border: { bottom: { color: 'D9D9D9', space: 6, style: 'single', size: 6 } },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, color: MUTED, size: 20, characterSpacing: 60, allCaps: true })],
    })
  }

  const cover = computeCoverStats(sections)
  const docChildren: InstanceType<typeof Paragraph>[] = []

  // ── Cover page ───────────────────────────────────────────────────────────
  docChildren.push(
    new Paragraph({
      spacing: { before: 1600, after: 200 },
      children: [new TextRun({ text: 'CONTENT CALENDAR', color: FAINT, size: 18, characterSpacing: 96, allCaps: true })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
      children: [new TextRun({ text: brandName, bold: true, size: 80, color: INK })],
    }),
    new Paragraph({
      spacing: { after: 600 },
      children: [new TextRun({ text: rangeLabel, size: 28, color: MUTED })],
    }),
  )

  function statSection(label: string, lines: { name: string; count: number; hex: string }[]) {
    docChildren.push(new Paragraph({
      spacing: { before: 320, after: 100 },
      children: [new TextRun({ text: label.toUpperCase(), color: MUTED, size: 16, characterSpacing: 80, allCaps: true, bold: true })],
    }))
    for (const l of lines) {
      if (l.count === 0) continue
      docChildren.push(new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: '●  ',
            color: l.hex,
            size: 24,
            bold: true,
          }),
          new TextRun({ text: l.name, size: 22, color: INK }),
          new TextRun({ text: '   ', size: 22 }),
          new TextRun({ text: String(l.count), size: 22, bold: true, color: INK }),
        ],
      }))
    }
  }

  // Total entries headline
  docChildren.push(new Paragraph({
    spacing: { before: 120, after: 80 },
    children: [new TextRun({ text: 'TOTAL ENTRIES', color: MUTED, size: 16, characterSpacing: 80, allCaps: true, bold: true })],
  }))
  docChildren.push(new Paragraph({
    spacing: { after: 280 },
    children: [new TextRun({ text: String(cover.total), bold: true, size: 72, color: INK })],
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
    spacing: { before: 480 },
    children: [
      new TextRun({ text: `Grouped by ${groupBy} · generated ${format(new Date(), 'MMM d, yyyy')}`, color: FAINT, italics: true, size: 18 }),
    ],
  }))

  // Force a page break so content starts on its own page.
  docChildren.push(new Paragraph({
    children: [new PageBreak()],
  }))

  // ── Content page header ──────────────────────────────────────────────────
  docChildren.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: 'CONTENT CALENDAR', color: FAINT, size: 16, characterSpacing: 80, allCaps: true })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 320 },
      children: [new TextRun({ text: `${brandName} · ${rangeLabel}`, bold: true, size: 36, color: INK })],
    }),
  )

  if (sections.length === 0) {
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: 'No entries match the selected range and filters.', italics: true, color: FAINT, size: 22 })],
    }))
  }

  for (const s of sections) {
    docChildren.push(sectionH(s.heading))

    // Render the script / notes / links portion for one row. Used once
    // for the collapsed (uniform) case and once per platform when the
    // group's variants differ.
    function pushRowBody(r: CalendarEntry) {
      const beats = lineBeats(r.script ?? '')
      const links = extractLinks(`${r.script ?? ''}\n${r.notes ?? ''}`)

      if (beats.length > 0) {
        docChildren.push(new Paragraph({
          spacing: { before: 140, after: 80 },
          children: [new TextRun({ text: 'SCRIPT', bold: true, color: MUTED, size: 16, characterSpacing: 60, allCaps: true })],
        }))
        beats.forEach((line, idx) => {
          docChildren.push(
            new Paragraph({
              spacing: { after: 80, line: 320 },
              indent: { left: 280 },
              children: [
                new TextRun({ text: `${idx + 1}.  `, bold: true, color: FAINT, size: 22 }),
                new TextRun({ text: line, size: 24, color: INK }),
              ],
            }),
          )
        })
      }

      if (r.notes && r.notes.trim().length > 0) {
        docChildren.push(new Paragraph({
          spacing: { before: 140, after: 80 },
          children: [new TextRun({ text: 'NOTES', bold: true, color: MUTED, size: 16, characterSpacing: 60, allCaps: true })],
        }))
        r.notes.split('\n').forEach((line) => {
          docChildren.push(
            new Paragraph({
              spacing: { after: 60, line: 320 },
              indent: { left: 280 },
              children: [new TextRun({ text: line, size: 24, color: INK })],
            }),
          )
        })
      }

      if (links.length > 0) {
        docChildren.push(new Paragraph({
          spacing: { before: 140, after: 80 },
          children: [new TextRun({ text: 'LINKS', bold: true, color: MUTED, size: 16, characterSpacing: 60, allCaps: true })],
        }))
        links.forEach((url) => {
          docChildren.push(
            new Paragraph({
              spacing: { after: 60 },
              indent: { left: 280 },
              children: [
                new ExternalHyperlink({
                  link: url,
                  children: [new TextRun({ text: url, color: LINK, underline: {}, size: 20 })],
                }),
              ],
            }),
          )
        })
      }
    }

    for (const g of s.entries) {
      const r: CalendarEntry = g.representative
      const fmt = r.format as ContentFormat | null
      const variants = hasPlatformVariants(g)

      // Title row. When copy is uniform, show the format pill inline.
      // When variants differ, drop the pill here — each variant gets its
      // own header below so platform/format always agree.
      const titleRuns: InstanceType<typeof TextRun>[] = []
      if (fmt && !variants) {
        titleRuns.push(new TextRun({
          text: ` ${formatLabel(fmt).toUpperCase()} `,
          bold: true, color: 'FFFFFF', size: 16, characterSpacing: 40,
          shading: { type: ShadingType.SOLID, color: FORMAT_HEX[fmt], fill: FORMAT_HEX[fmt] },
        }))
        titleRuns.push(new TextRun({ text: '   ', size: 28 }))
      }
      titleRuns.push(new TextRun({ text: r.title, bold: true, size: 32, color: INK }))

      docChildren.push(
        new Paragraph({
          spacing: { before: 360, after: 80, line: 280 },
          // Quiet top divider between entries — replaces the visual noise
          // of a colored bar in the body.
          border: { top: { color: 'EFEFEF', space: 12, style: 'single', size: 4 } },
          children: titleRuns,
        }),
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
          spacing: { after: 120 },
          children: [new TextRun({ text: metaParts.join('   ·   '), color: MUTED, size: 20 })],
        }),
      )

      if (variants) {
        // Per-platform sub-blocks under the same title/meta. Each gets a
        // small platform header (with that platform's format pill) and
        // its own script / notes / links.
        for (const e of g.entries) {
          const efmt = e.format as ContentFormat | null
          const headerRuns: InstanceType<typeof TextRun>[] = [
            new TextRun({
              text: ` ${platformsLabel([e.platform]).toUpperCase()} `,
              bold: true, color: 'FFFFFF', size: 14, characterSpacing: 40,
              shading: { type: ShadingType.SOLID, color: efmt ? FORMAT_HEX[efmt] : '9CA3AF', fill: efmt ? FORMAT_HEX[efmt] : '9CA3AF' },
            }),
          ]
          if (efmt) {
            headerRuns.push(new TextRun({ text: '    ', size: 20 }))
            headerRuns.push(new TextRun({ text: formatLabel(efmt), color: MUTED, size: 18 }))
          }
          docChildren.push(new Paragraph({ spacing: { before: 200, after: 60 }, children: headerRuns }))
          pushRowBody(e)
        }
      } else {
        pushRowBody(r)
      }
    }
  }

  const doc = new Document({
    creator: 'Zek Studio',
    title: `${brandName} · ${rangeLabel}`,
    // Calibri reads cleaner than the default Times New Roman at the body
    // sizes we use. Docx default body is 11pt = size 22 (half-points).
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: INK },
        },
      },
    },
    sections: [{
      // Generous page margins so the doc breathes — 1.1in left/right,
      // 1in top/bottom. docx uses twentieths-of-a-point (1in = 1440).
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1584, right: 1584 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', color: FAINT, size: 16, characterSpacing: 40 }),
              new TextRun({ children: [PageNumber.CURRENT], color: FAINT, size: 16 }),
              new TextRun({ text: '  of  ', color: FAINT, size: 16, characterSpacing: 40 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], color: FAINT, size: 16 }),
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
