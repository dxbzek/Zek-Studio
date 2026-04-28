import { format, parseISO } from 'date-fns'
import { CONTENT_FORMATS, CONTENT_THEMES } from '@/types'
import type { CalendarEntry, ContentFormat, ContentTheme, Platform } from '@/types'

const URL_RE = /https?:\/\/[^\s<>"'()\[\]]+/gi

function extractLinks(text: string): string[] {
  const matches = text.match(URL_RE) ?? []
  const cleaned = matches.map((u) => u.replace(/[.,;:!?]+$/, '')).filter(Boolean)
  return Array.from(new Set(cleaned))
}

function formatLabel(value: ContentFormat | null): string {
  if (!value) return '—'
  return CONTENT_FORMATS.find((f) => f.value === value)?.label ?? value
}

function themeLabel(value: string): string {
  return CONTENT_THEMES.find((t) => t.value === value as ContentTheme)?.label ?? value
}

function safeFilename(s: string): string {
  return s.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'calendar-entry'
}

interface ExportInput {
  entry: CalendarEntry
  platforms: Platform[]
}

// Builds and downloads a .docx for a single calendar entry. The `docx`
// package is dynamically imported so its ~200KB only ships to clients who
// actually export — keeps the calendar bundle slim.
export async function exportEntryToWord({ entry, platforms }: ExportInput): Promise<void> {
  const docx = await import('docx')
  const {
    Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, ExternalHyperlink, BorderStyle,
  } = docx

  const beats = (entry.script ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const links = extractLinks(`${entry.script ?? ''}\n${entry.notes ?? ''}`)
  const dateLabel = format(parseISO(entry.scheduled_date), 'EEEE, MMM d, yyyy')

  function metaRow(label: string, value: string): InstanceType<typeof TableRow> {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: '555555', size: 20 })] })],
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: 'EEEEEE' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'EEEEEE' },
            left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
        }),
        new TableCell({
          width: { size: 72, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 22 })] })],
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: 'EEEEEE' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'EEEEEE' },
            left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
        }),
      ],
    })
  }

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      metaRow('Date',         dateLabel),
      metaRow('Format',       formatLabel(entry.format)),
      metaRow('Content type', themeLabel(entry.content_type)),
      metaRow('Platforms',    platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')),
      metaRow('Status',       entry.status.charAt(0).toUpperCase() + entry.status.slice(1)),
      ...(entry.assigned_talent ? [metaRow('Talent', entry.assigned_talent)] : []),
    ],
  })

  function sectionHeading(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text, bold: true, color: '333333', size: 22 })],
    })
  }

  const children: InstanceType<typeof Paragraph>[] = []

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [new TextRun({ text: dateLabel.toUpperCase(), color: '888888', size: 18 })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 220 },
      children: [new TextRun({ text: entry.title, bold: true, size: 40 })],
    }),
  )

  // Table goes in the doc body directly (Document children accepts both)
  const docChildren: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    ...children,
    metaTable,
  ]

  if (beats.length > 0) {
    docChildren.push(sectionHeading('Script'))
    beats.forEach((line, idx) => {
      docChildren.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${idx + 1}.  `, bold: true, color: '888888', size: 22 }),
            new TextRun({ text: line, size: 22 }),
          ],
        }),
      )
    })
  }

  if (entry.notes && entry.notes.trim().length > 0) {
    docChildren.push(sectionHeading('Notes'))
    entry.notes.split('\n').forEach((line) => {
      docChildren.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: line, size: 22 })],
        }),
      )
    })
  }

  if (links.length > 0) {
    docChildren.push(sectionHeading('Reference links'))
    links.forEach((url) => {
      docChildren.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new ExternalHyperlink({
              link: url,
              children: [new TextRun({ text: url, color: '2563EB', underline: {}, size: 22 })],
            }),
          ],
        }),
      )
    })
  }

  const doc = new Document({
    creator: 'Zek Studio',
    title: entry.title,
    sections: [{ properties: {}, children: docChildren }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFilename(entry.title)}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
