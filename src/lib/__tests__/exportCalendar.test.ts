// Smoke-test for the PDF + Word calendar exports. The Word export crashed
// once on an exotic docx prop — this fixture mirrors the shape we produce
// in real usage so a regression in either renderer surfaces in CI / `npm
// test` instead of in front of a user clicking Export.

import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { CalendarEntry, Platform } from '@/types'
import type { EntryGroup } from '@/components/calendar/entryGroups'
import { exportCalendarToWord } from '@/lib/exportCalendarToWord'
import { exportCalendarToPdf } from '@/lib/exportCalendarToPdf'

function makeEntry(overrides: Partial<CalendarEntry>): CalendarEntry {
  return {
    id: crypto.randomUUID(),
    brand_id: 'brand-1',
    platform: 'instagram' as Platform,
    content_type: 'post',
    title: 'Sample entry',
    body: null,
    script: 'Beat 1\nBeat 2\nVisit https://example.com for more.',
    notes: 'Shoot notes here.',
    format: 'reel',
    reference_image_url: null,
    scheduled_date: '2026-05-10',
    status: 'draft',
    generated_content_id: null,
    campaign_id: null,
    pillar_id: null,
    approval_status: null,
    approval_note: null,
    assigned_editor: null,
    assigned_shooter: null,
    assigned_talent: null,
    character: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

function makeGroup(entries: CalendarEntry[]): EntryGroup {
  return {
    id: entries[0].id,
    representative: entries[0],
    entries,
    platforms: entries.map((e) => e.platform),
  }
}

const fixture = {
  brandName: 'ERE Homes',
  rangeLabel: 'May 2026',
  groupBy: 'date' as const,
  sections: [
    {
      heading: 'Wed, May 6',
      entries: [
        makeGroup([
          makeEntry({ platform: 'instagram', format: 'reel', title: 'Penthouse tour' }),
          makeEntry({ platform: 'tiktok', format: 'reel', title: 'Penthouse tour' }),
        ]),
        makeGroup([
          makeEntry({
            platform: 'linkedin',
            format: 'static',
            title: 'Market update',
            script: null,
            notes: null,
          }),
        ]),
      ],
    },
    {
      heading: 'Fri, May 8',
      entries: [
        makeGroup([
          makeEntry({
            platform: 'instagram',
            format: 'carousel',
            title: 'Q2 launches',
            script: 'Slide 1: Headline\nSlide 2: Numbers\nSlide 3: CTA',
          }),
        ]),
      ],
    },
  ],
}

beforeEach(() => {
  // jsdom doesn't implement createObjectURL — stub it so the export's
  // `<a href={url} download>` flow doesn't throw before we get to assert.
  if (!URL.createObjectURL) {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:stub',
      revokeObjectURL: () => {},
    })
  }
  // Anchor.click is a no-op in jsdom but doesn't throw — leave it.
})

describe('calendar exports', () => {
  it('builds a Word doc without throwing', async () => {
    await expect(exportCalendarToWord(fixture)).resolves.toBeUndefined()
  })

  it('builds a PDF doc without throwing', async () => {
    await expect(exportCalendarToPdf(fixture)).resolves.toBeUndefined()
  })
})
