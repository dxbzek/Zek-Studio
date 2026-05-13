import type { CalendarEntry, CalendarStatus, Platform } from '@/types'

export type EntryGroup = {
  /** representative entry id (used as the DnD draggable id) */
  id: string
  representative: CalendarEntry
  entries: CalendarEntry[]
  platforms: Platform[]
}

export function groupEntries(entries: CalendarEntry[]): EntryGroup[] {
  const map = new Map<string, CalendarEntry[]>()
  for (const e of entries) {
    const key = `${e.title.toLowerCase().trim()}__${e.scheduled_date}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.values()).map((grp) => {
    // Prefer a non-LinkedIn entry as representative so the format badge
    // reflects the short-form video format (reel/carousel) rather than
    // LinkedIn's static format.
    const rep = grp.find((e) => e.platform !== 'linkedin') ?? grp[0]
    return {
      id: rep.id,
      representative: rep,
      entries: grp,
      platforms: grp.map((e) => e.platform),
    }
  })
}

export const STATUSES: { value: CalendarStatus; label: string }[] = [
  { value: 'draft',     label: 'Draft'     },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
]

export const PILLAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#64748b', '#0f172a',
]

/** Map calendar entry status → task status for the linked auto-task. */
export function deriveTaskStatus(
  calendarStatus: CalendarStatus,
): 'todo' | 'in_progress' | 'scheduled' | 'done' {
  if (calendarStatus === 'published') return 'done'
  if (calendarStatus === 'scheduled') return 'scheduled'
  return 'todo'
}

export function emailHandle(email: string): string {
  return email.split('@')[0]
}

export const MAX_PLATFORM_BADGES = 3
