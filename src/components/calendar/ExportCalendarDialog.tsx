import { useEffect, useMemo, useState } from 'react'
import {
  format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from 'date-fns'
import { FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CONTENT_FORMATS, PLATFORMS } from '@/types'
import type {
  CalendarEntry, CalendarStatus, ContentFormat, Platform,
} from '@/types'
import { groupEntries, type EntryGroup } from './entryGroups'

type RangeKind = 'this_week' | 'this_month' | 'custom'
type GroupBy = 'date' | 'format' | 'talent'

export type ExportSections = {
  groupBy: GroupBy
  sections: { heading: string; entries: EntryGroup[] }[]
  rangeLabel: string
  brandName: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  brandId: string
  brandName: string
  // The currently-viewed month, used as the default for "This month".
  viewYear: number
  viewMonth: number
  // Active filter state from the calendar page; used when "Use current
  // filters" is on so the export matches what's on screen.
  filterPlatforms: Platform[]
  filterStatus: CalendarStatus | 'all'
  searchQuery: string
}

// Reused from useCalendar. We keep it in sync there but inline here so the
// dialog's one-shot fetch doesn't drag in the rest of the hook.
const ENTRY_COLUMNS =
  'id, brand_id, platform, content_type, title, body, script, notes, format, scheduled_date, ' +
  'status, generated_content_id, campaign_id, pillar_id, ' +
  'approval_status, approval_note, assigned_editor, assigned_shooter, ' +
  'assigned_talent, character, created_at, updated_at'

function emailHandle(email: string): string {
  return email.includes('@') ? email.split('@')[0] : email
}

function formatLabel(value: ContentFormat): string {
  return CONTENT_FORMATS.find((f) => f.value === value)?.label ?? value
}

const FORMAT_ORDER: ContentFormat[] = ['reel', 'carousel', 'static', 'emergency_backup']

function buildSections(
  entries: CalendarEntry[],
  groupBy: GroupBy,
): { heading: string; entries: EntryGroup[] }[] {
  const groups = groupEntries(entries)

  if (groupBy === 'date') {
    const byDate = new Map<string, EntryGroup[]>()
    for (const g of groups) {
      const d = g.representative.scheduled_date
      if (!byDate.has(d)) byDate.set(d, [])
      byDate.get(d)!.push(g)
    }
    return Array.from(byDate.keys())
      .sort()
      .map((d) => ({
        heading: format(parseISO(d), 'EEEE · MMM d'),
        entries: byDate.get(d)!,
      }))
  }

  if (groupBy === 'format') {
    const byFormat = new Map<ContentFormat | 'unset', EntryGroup[]>()
    for (const g of groups) {
      const f = (g.representative.format as ContentFormat | null) ?? 'unset'
      if (!byFormat.has(f)) byFormat.set(f, [])
      byFormat.get(f)!.push(g)
    }
    const sections: { heading: string; entries: EntryGroup[] }[] = []
    for (const f of FORMAT_ORDER) {
      const list = byFormat.get(f)
      if (list && list.length > 0) {
        list.sort((a, b) => a.representative.scheduled_date.localeCompare(b.representative.scheduled_date))
        sections.push({ heading: formatLabel(f), entries: list })
      }
    }
    const unset = byFormat.get('unset')
    if (unset && unset.length > 0) {
      unset.sort((a, b) => a.representative.scheduled_date.localeCompare(b.representative.scheduled_date))
      sections.push({ heading: 'Format unset', entries: unset })
    }
    return sections
  }

  // groupBy === 'talent'
  const byTalent = new Map<string, EntryGroup[]>()
  for (const g of groups) {
    const t = g.representative.assigned_talent
    const key = t && t.length > 0 ? emailHandle(t) : 'Unassigned'
    if (!byTalent.has(key)) byTalent.set(key, [])
    byTalent.get(key)!.push(g)
  }
  const headings = Array.from(byTalent.keys()).sort((a, b) => {
    if (a === 'Unassigned') return 1
    if (b === 'Unassigned') return -1
    return a.localeCompare(b)
  })
  return headings.map((h) => {
    const list = byTalent.get(h)!
    list.sort((a, b) => a.representative.scheduled_date.localeCompare(b.representative.scheduled_date))
    return { heading: h, entries: list }
  })
}

export function ExportCalendarDialog({
  open, onOpenChange, brandId, brandName, viewYear, viewMonth,
  filterPlatforms, filterStatus, searchQuery,
}: Props) {
  const [rangeKind, setRangeKind] = useState<RangeKind>('this_month')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [useFilters, setUseFilters] = useState(false)
  const [excludeDrafts, setExcludeDrafts] = useState(false)
  const [groupBy, setGroupBy] = useState<GroupBy>('date')
  const [busy, setBusy] = useState<'pdf' | 'word' | null>(null)

  // Reset to sensible defaults each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setRangeKind('this_month')
    setUseFilters(false)
    setExcludeDrafts(false)
    setGroupBy('date')
    setBusy(null)
    const monthStart = format(startOfMonth(new Date(viewYear, viewMonth)), 'yyyy-MM-dd')
    const monthEnd   = format(endOfMonth(new Date(viewYear, viewMonth)), 'yyyy-MM-dd')
    setCustomStart(monthStart)
    setCustomEnd(monthEnd)
  }, [open, viewYear, viewMonth])

  const range = useMemo(() => {
    const today = new Date()
    if (rangeKind === 'this_week') {
      const start = startOfWeek(today, { weekStartsOn: 0 })
      const end = endOfWeek(today, { weekStartsOn: 0 })
      return {
        startISO: format(start, 'yyyy-MM-dd'),
        endISO: format(end, 'yyyy-MM-dd'),
        label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
      }
    }
    if (rangeKind === 'this_month') {
      const m = new Date(viewYear, viewMonth)
      return {
        startISO: format(startOfMonth(m), 'yyyy-MM-dd'),
        endISO: format(endOfMonth(m), 'yyyy-MM-dd'),
        label: format(m, 'MMMM yyyy'),
      }
    }
    // custom
    const valid = customStart && customEnd && customStart <= customEnd
    if (!valid) return null
    return {
      startISO: customStart,
      endISO: customEnd,
      label: `${format(parseISO(customStart), 'MMM d, yyyy')} – ${format(parseISO(customEnd), 'MMM d, yyyy')}`,
    }
  }, [rangeKind, viewYear, viewMonth, customStart, customEnd])

  const filterSummary = useMemo(() => {
    if (!useFilters) return null
    const parts: string[] = []
    const allPlatforms = PLATFORMS.length
    if (filterPlatforms.length > 0 && filterPlatforms.length < allPlatforms) {
      parts.push(filterPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', '))
    }
    if (filterStatus !== 'all') parts.push(filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1))
    if (searchQuery.trim()) parts.push(`"${searchQuery.trim()}"`)
    return parts.length > 0 ? parts.join(' · ') : 'No filters active'
  }, [useFilters, filterPlatforms, filterStatus, searchQuery])

  async function loadEntries(): Promise<CalendarEntry[]> {
    if (!range) throw new Error('Pick a valid date range')
    const { data, error } = await supabase
      .from('calendar_entries')
      .select(ENTRY_COLUMNS)
      .eq('brand_id', brandId)
      .gte('scheduled_date', range.startISO)
      .lte('scheduled_date', range.endISO)
      .order('scheduled_date', { ascending: true })
    if (error) throw error
    let entries = (data ?? []) as unknown as CalendarEntry[]
    if (useFilters) {
      const allPlatforms = PLATFORMS.length
      if (filterPlatforms.length > 0 && filterPlatforms.length < allPlatforms) {
        entries = entries.filter((e) => filterPlatforms.includes(e.platform))
      }
      if (filterStatus !== 'all') {
        entries = entries.filter((e) => e.status === filterStatus)
      }
      const q = searchQuery.trim().toLowerCase()
      if (q) {
        entries = entries.filter((e) =>
          e.title.toLowerCase().includes(q) ||
          (e.body ?? '').toLowerCase().includes(q) ||
          (e.script ?? '').toLowerCase().includes(q) ||
          (e.notes ?? '').toLowerCase().includes(q) ||
          e.content_type.toLowerCase().includes(q),
        )
      }
    }
    if (excludeDrafts) entries = entries.filter((e) => e.status !== 'draft')
    return entries
  }

  function buildPayload(entries: CalendarEntry[]): ExportSections {
    return {
      groupBy,
      sections: buildSections(entries, groupBy),
      rangeLabel: range?.label ?? '',
      brandName,
    }
  }

  async function handleExport(kind: 'pdf' | 'word') {
    if (!range) {
      toast.error('Pick a valid date range')
      return
    }
    setBusy(kind)
    try {
      const entries = await loadEntries()
      const payload = buildPayload(entries)
      if (kind === 'pdf') {
        const { exportCalendarToPdf } = await import('@/lib/exportCalendarToPdf')
        await exportCalendarToPdf(payload)
        toast.success('PDF downloaded')
      } else {
        const { exportCalendarToWord } = await import('@/lib/exportCalendarToWord')
        await exportCalendarToWord(payload)
        toast.success('Word document downloaded')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error("Couldn't export", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Export calendar</DialogTitle>
          <DialogDescription>
            Pick a range, choose a grouping, and download the brief as PDF or Word.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Range */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Range</legend>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="range" checked={rangeKind === 'this_week'}
                  onChange={() => setRangeKind('this_week')} />
                This week
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="range" checked={rangeKind === 'this_month'}
                  onChange={() => setRangeKind('this_month')} />
                This month
                <span className="text-muted-foreground text-xs">
                  ({format(new Date(viewYear, viewMonth), 'MMMM yyyy')})
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="range" checked={rangeKind === 'custom'}
                  onChange={() => setRangeKind('custom')} />
                Custom
              </label>
              {rangeKind === 'custom' && (
                <div className="ml-6 flex items-center gap-2 pt-1">
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" />
                  <span className="text-muted-foreground text-xs">to</span>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" />
                </div>
              )}
            </div>
          </fieldset>

          {/* Filter / draft toggles */}
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={useFilters} onChange={(e) => setUseFilters(e.target.checked)} />
              <span>
                Use current filters
                {filterSummary && (
                  <span className="block text-xs text-muted-foreground">{filterSummary}</span>
                )}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={excludeDrafts} onChange={(e) => setExcludeDrafts(e.target.checked)} />
              Exclude drafts
            </label>
          </div>

          {/* Group by */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Group by</legend>
            <div className="flex gap-1.5">
              {(['date', 'format', 'talent'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    groupBy === g
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={!!busy}>
            Cancel
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport('word')} disabled={!!busy}>
            {busy === 'word' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
            {busy === 'word' ? 'Building Word…' : 'Export Word'}
          </Button>
          <Button size="sm" onClick={() => handleExport('pdf')} disabled={!!busy}>
            {busy === 'pdf' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
            {busy === 'pdf' ? 'Building PDF…' : 'Export PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
