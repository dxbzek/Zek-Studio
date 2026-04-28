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

interface ExportInput {
  brandName: string
  monthLabel: string  // e.g. "April 2026"
  groups: EntryGroup[]
}

// Builds and downloads a multi-entry .docx for a calendar month. Dynamically
// imports `docx` so the ~200KB only ships to clients who export.
export async function exportCalendarToWord({ brandName, monthLabel, groups }: ExportInput): Promise<void> {
  const docx = await import('docx')
  const {
    Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType,
    ExternalHyperlink, ShadingType,
  } = docx

  function dayHeader(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, color: '555555', size: 20, allCaps: true })],
    })
  }

  // Group entries by date
  const byDate = new Map<string, EntryGroup[]>()
  for (const g of groups) {
    const d = g.representative.scheduled_date
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(g)
  }
  const dates = Array.from(byDate.keys()).sort()

  const docChildren: InstanceType<typeof Paragraph>[] = []

  // Title block
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'CONTENT CALENDAR', color: '888888', size: 18, allCaps: true })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
      children: [new TextRun({ text: `${brandName} · ${monthLabel}`, bold: true, size: 36 })],
    }),
    new Paragraph({
      spacing: { after: 280 },
      children: [
        new TextRun({
          text: `${groups.length} ${groups.length === 1 ? 'entry' : 'entries'} · generated ${format(new Date(), 'MMM d, yyyy')}`,
          color: '777777',
          size: 20,
        }),
      ],
    }),
  )

  if (dates.length === 0) {
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: 'No entries scheduled for this month.', italics: true, color: '999999', size: 22 })],
    }))
  }

  for (const d of dates) {
    docChildren.push(dayHeader(format(parseISO(d), 'EEEE · MMM d')))

    const dayGroups = byDate.get(d) ?? []
    for (const g of dayGroups) {
      const r: CalendarEntry = g.representative
      const fmt = r.format as ContentFormat | null
      const beats = lineBeats(r.script ?? '')
      const links = extractLinks(`${r.script ?? ''}\n${r.notes ?? ''}`)

      // Title with optional format pill (text only — docx doesn't render
      // arbitrary inline blocks like HTML, but we can approximate with a
      // shaded text run).
      const titleRuns: InstanceType<typeof TextRun>[] = []
      if (fmt) {
        titleRuns.push(new TextRun({
          text: ` ${formatLabel(fmt).toUpperCase()} `,
          bold: true,
          color: 'FFFFFF',
          size: 18,
          shading: { type: ShadingType.SOLID, color: FORMAT_HEX[fmt], fill: FORMAT_HEX[fmt] },
        }))
        titleRuns.push(new TextRun({ text: '  ', size: 22 }))
      }
      titleRuns.push(new TextRun({ text: r.title, bold: true, size: 26 }))

      docChildren.push(
        new Paragraph({
          spacing: { before: 180, after: 60 },
          children: titleRuns,
        }),
      )

      // Meta line
      const metaParts = [
        themeLabel(r.content_type),
        platformsLabel(g.platforms),
        r.status.charAt(0).toUpperCase() + r.status.slice(1),
      ]
      if (r.assigned_talent) metaParts.push(`Talent: ${r.assigned_talent}`)
      docChildren.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: metaParts.join(' · '), color: '666666', size: 20 })],
        }),
      )

      // Script beats
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

      // Notes
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

      // Links
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

  // Footer note
  docChildren.push(
    new Paragraph({
      spacing: { before: 320 },
      border: { top: { color: 'EEEEEE', space: 1, style: 'single', size: 6 } },
      children: [
        new TextRun({
          text: `Exported from Zek Studio on ${format(new Date(), 'MMM d, yyyy · HH:mm')}.`,
          color: '999999',
          italics: true,
          size: 18,
        }),
      ],
    }),
  )

  const doc = new Document({
    creator: 'Zek Studio',
    title: `${brandName} · ${monthLabel}`,
    sections: [{ properties: {}, children: docChildren }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFilename(`${brandName}_${monthLabel}_calendar`)}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
