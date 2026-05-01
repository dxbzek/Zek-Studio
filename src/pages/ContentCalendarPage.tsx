import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  eachDayOfInterval,
  format,
  isSameMonth,
  parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Download, FileText, Keyboard, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { useActiveBrand } from '@/stores/activeBrand'
import { useUiState } from '@/stores/uiState'
import { useCalendar } from '@/hooks/useCalendar'
import { useTeam } from '@/hooks/useTeam'
import { useTasks } from '@/hooks/useTasks'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useContentPillars } from '@/hooks/useContentPillars'
import { useGenerator } from '@/hooks/useGenerator'
import { CONTENT_FORMATS, PLATFORMS } from '@/types'
import { PlatformPill } from '@/lib/platformBrand'
import {
  CALENDAR_STATUS_CHIP, CONTENT_FORMAT_SOLID,
} from '@/lib/statusTokens'
import type {
  CalendarEntry,
  CalendarEntryInsert,
  CalendarStatus,
  ContentFormat,
  ContentPillar,
  ContentTheme,
  ContentType,
  GeneratorPlatform,
  Platform,
} from '@/types'
import { EntryCardOverlay } from '@/components/calendar/EntryCard'
import { DayCell } from '@/components/calendar/DayCell'
import {
  EntryDrawer,
  type EntryFormValues,
} from '@/components/calendar/EntryDrawer'
import { ExportCalendarDialog } from '@/components/calendar/ExportCalendarDialog'
import { exportCalendarToPdf } from '@/lib/exportCalendarToPdf'
import { exportCalendarToWord } from '@/lib/exportCalendarToWord'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog as ShortcutsDialog,
  DialogContent as ShortcutsDialogContent,
  DialogDescription as ShortcutsDialogDescription,
  DialogHeader as ShortcutsDialogHeader,
  DialogTitle as ShortcutsDialogTitle,
} from '@/components/ui/dialog'
import { PillarConfigDrawer } from '@/components/calendar/PillarConfigDrawer'
import {
  deriveTaskStatus,
  groupEntries,
  STATUSES,
  type EntryGroup,
} from '@/components/calendar/entryGroups'
import { useDraggable } from '@dnd-kit/core'

// Draggable chip in the Emergency Backup lane. Drop it onto a day cell to
// "deploy" the backup (re-dates the entry and flips its format off
// emergency_backup). Pointer activation distance is enough to keep
// click→edit working when the user just wants to open the drawer.
function EmergencyChip({ group, onClick }: { group: EntryGroup; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `emergency:${group.id}`,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? 'scale(1.05)' : undefined,
      }}
      className="shrink-0 max-w-[200px] truncate px-2 py-0.5 rounded-md text-[11px] border border-red-500/20 bg-card hover:bg-red-500/[0.08] hover:border-red-500/40 hover:-translate-y-px hover:shadow-[0_3px_10px_-3px_rgba(239,68,68,0.25)] active:translate-y-0 transition-[transform,box-shadow,background-color,border-color,opacity] duration-150 cursor-grab active:cursor-grabbing"
      title={`Drag onto a day to deploy · ${group.representative.title}`}
    >
      {group.representative.title}
    </button>
  )
}

export function ContentCalendarPage() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()

  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  // Month grid is 7 × 6 cells — unreadable below md: (each cell ~55px on a
  // phone). Default to week on first paint if we're small, and auto-switch
  // as the viewport crosses the breakpoint. The user can still pick month
  // on mobile if they want to; we just don't force it on them by default.
  const [viewMode, setViewMode] = useState<'month' | 'week'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? 'week'
      : 'month'
  )
  // Bulk-edit selection. Tracks group ids (representative entry ids); on
  // commit, each selected group expands to all its per-platform siblings.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false)
  // Surface select-mode to the AppShell so the mobile FAB can hide while
  // the bulk-edit bar is visible — they share the bottom-right area.
  const setUiSelectMode = useUiState((s) => s.setCalendarSelectMode)
  useEffect(() => {
    setUiSelectMode(selectMode)
    return () => setUiSelectMode(false)
  }, [selectMode, setUiSelectMode])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setViewMode(e.matches ? 'week' : 'month')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11) }
    else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0) }
    else setViewMonth((m) => m + 1)
  }

  const { entries, createEntry, updateEntry, deleteEntry } = useCalendar(
    activeBrand?.id ?? null,
    viewYear,
    viewMonth,
  )

  // Emergency Backup library — evergreen fallback content. Lives in its own
  // lane above the grid, not in the dated calendar. Fetched separately so
  // it spans all months (not just the currently-visible window).
  const emergencyBackups = useQuery({
    queryKey: ['emergency-backup', activeBrand?.id],
    queryFn: async () => {
      if (!activeBrand) return [] as CalendarEntry[]
      const { data, error } = await supabase
        .from('calendar_entries')
        .select('id, brand_id, platform, content_type, title, body, script, notes, format, reference_image_url, scheduled_date, status, generated_content_id, campaign_id, pillar_id, approval_status, approval_note, assigned_editor, assigned_shooter, assigned_talent, character, created_at, updated_at')
        .eq('brand_id', activeBrand.id)
        .eq('format', 'emergency_backup')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as CalendarEntry[]
    },
    enabled: !!activeBrand,
    staleTime: 60_000,
  })
  const emergencyGroups = useMemo(
    () => groupEntries(emergencyBackups.data ?? []),
    [emergencyBackups.data],
  )
  const { members } = useTeam(activeBrand?.id ?? null)
  const { tasks, createTask, updateTask } = useTasks(activeBrand?.id ?? null)
  const { campaigns } = useCampaigns(activeBrand?.id ?? null)
  const { pillars, createPillar, deletePillar } = useContentPillars(activeBrand?.id ?? null)
  const { generate: generateContent } = useGenerator(activeBrand?.id ?? null)

  const teamMembers = members.data ?? []

  const [filterPlatforms, setFilterPlatforms] = useState<Platform[]>(() => PLATFORMS.map((p) => p.value))
  const [filterStatus, setFilterStatus]       = useState<CalendarStatus | 'all'>('all')
  const [filterFormat, setFilterFormat]       = useState<ContentFormat | 'all'>('all')
  const [search, setSearch]                   = useState('')
  // Defer the search filter so each keystroke doesn't re-run filteredEntries
  // synchronously. The input updates instantly; the calendar grid catches up
  // on the next idle frame.
  const deferredSearch = useDeferredValue(search)

  const filteredEntries = useMemo(() => {
    let result = entries.data ?? []
    if (filterPlatforms.length > 0)
      result = result.filter((e) => filterPlatforms.includes(e.platform))
    if (filterStatus !== 'all')
      result = result.filter((e) => e.status === filterStatus)
    if (filterFormat !== 'all')
      result = result.filter((e) => e.format === filterFormat)
    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase()
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (e.body ?? '').toLowerCase().includes(q) ||
        (e.script ?? '').toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q) ||
        e.content_type.toLowerCase().includes(q),
      )
    }
    return result
  }, [entries.data, filterPlatforms, filterStatus, filterFormat, deferredSearch])

  const allGroups = useMemo(() => groupEntries(filteredEntries), [filteredEntries])
  // Emergency Backup entries live in their own lane above the grid — they're
  // evergreen fallback content, not tied to a specific publish date. Pull
  // them out of the dated grid so the grid stays clean. Exception: if the
  // user explicitly filters to format=emergency_backup, show them on the
  // grid so the filter behaves as expected.
  const dateGridGroups = useMemo(() => (
    filterFormat === 'emergency_backup'
      ? allGroups
      : allGroups.filter((g) => g.representative.format !== 'emergency_backup')
  ), [allGroups, filterFormat])
  // Bucket groups by their scheduled_date once instead of running an
  // O(groups) filter for each of the 42 day cells on every render. Cuts
  // selection-toggle / drag-tick re-render cost from ~2k filter ops on a
  // 50-entry brand to a constant-time Map lookup.
  const groupsByDate = useMemo(() => {
    const m = new Map<string, EntryGroup[]>()
    for (const g of dateGridGroups) {
      const key = g.representative.scheduled_date
      const list = m.get(key)
      if (list) list.push(g)
      else m.set(key, [g])
    }
    return m
  }, [dateGridGroups])
  const groupsForDay = (day: Date) => groupsByDate.get(format(day, 'yyyy-MM-dd')) ?? []

  const firstDay  = startOfMonth(new Date(viewYear, viewMonth))
  const monthDays = eachDayOfInterval({
    start: startOfWeek(firstDay, { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(firstDay), { weekStartsOn: 0 }),
  })
  const weekAnchor = isSameMonth(today, firstDay) ? today : firstDay
  const weekStart  = startOfWeek(weekAnchor, { weekStartsOn: 0 })
  const weekDays   = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  const gridDays   = viewMode === 'month' ? monthDays : weekDays

  // Format mix this month — used by the mini-chart in the toolbar so
  // planners can balance the cadence at a glance.
  const formatMix = useMemo(() => {
    const monthEntries = (entries.data ?? []).filter((e) => {
      try { return isSameMonth(parseISO(e.scheduled_date), new Date(viewYear, viewMonth)) }
      catch { return false }
    })
    const counts = { reel: 0, carousel: 0, static: 0, emergency_backup: 0, unset: 0 }
    for (const e of monthEntries) {
      const f = (e.format as ContentFormat | null) ?? 'unset'
      counts[f] = (counts[f] ?? 0) + 1
    }
    const total = monthEntries.length
    return { total, counts }
  }, [entries.data, viewYear, viewMonth])

  const pillarDist = useMemo(() => {
    if ((pillars.data ?? []).length === 0) return []
    const monthEntries = (entries.data ?? []).filter((e) => {
      try { return isSameMonth(parseISO(e.scheduled_date), new Date(viewYear, viewMonth)) }
      catch { return false }
    })
    const total = monthEntries.length
    return (pillars.data ?? []).map((p: ContentPillar) => {
      const count = monthEntries.filter((e) => e.pillar_id === p.id).length
      return { ...p, count, actual_pct: total > 0 ? Math.round((count / total) * 100) : 0 }
    })
  }, [pillars.data, entries.data, viewYear, viewMonth])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const [draggingGroup, setDraggingGroup] = useState<EntryGroup | null>(null)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id)
    if (id.startsWith('emergency:')) {
      const groupId = id.slice('emergency:'.length)
      setDraggingGroup(emergencyGroups.find((g) => g.id === groupId) ?? null)
      return
    }
    setDraggingGroup(allGroups.find((g) => g.id === id) ?? null)
  }, [allGroups, emergencyGroups])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setDraggingGroup(null)
    const { active, over } = event
    if (!over) return
    const targetDate = over.id as string
    const activeId = String(active.id)

    // Emergency Backup → day cell. The user is "deploying" a backup: set
    // its date to the target day and flip format off emergency_backup so
    // it shows up in the dated grid. Default to 'static' since most
    // backups are static or short carousels.
    if (activeId.startsWith('emergency:')) {
      const groupId = activeId.slice('emergency:'.length)
      const group = emergencyGroups.find((g) => g.id === groupId)
      if (!group) return
      const originalDate = group.representative.scheduled_date
      const settled = await Promise.allSettled(
        group.entries.map((e) =>
          updateEntry.mutateAsync({
            id: e.id,
            patch: { scheduled_date: targetDate, format: 'static' },
          }),
        ),
      )
      const failures = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failures.length === 0) {
        toast.success(`Backup deployed to ${format(parseISO(targetDate), 'MMM d')}`)
      } else {
        await Promise.allSettled(
          group.entries.map((e) =>
            updateEntry.mutateAsync({
              id: e.id,
              patch: { scheduled_date: originalDate, format: 'emergency_backup' },
            }),
          ),
        )
        toast.error('Could not deploy backup', { description: failures[0].reason instanceof Error ? failures[0].reason.message : 'Try again' })
      }
      return
    }

    const group = allGroups.find((g) => g.id === activeId)
    if (!group || group.representative.scheduled_date === targetDate) return

    // Multi-platform entries are separate rows (one per platform). Promise.all
    // can partial-succeed — leaving half the group on the new date and half on
    // the old. Track which succeeded, and on any rejection roll the winners
    // back to the original date so the calendar never shows a split group.
    const originalDate = group.representative.scheduled_date
    const settled = await Promise.allSettled(
      group.entries.map((e) =>
        updateEntry.mutateAsync({ id: e.id, patch: { scheduled_date: targetDate } }),
      ),
    )
    const failures = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failures.length === 0) {
      toast.success('Entry rescheduled')
      return
    }
    // Partial failure — roll back the ones that succeeded.
    const succeededIds = settled
      .map((r, i) => (r.status === 'fulfilled' ? group.entries[i].id : null))
      .filter((id): id is string => id !== null)
    await Promise.allSettled(
      succeededIds.map((id) =>
        updateEntry.mutateAsync({ id, patch: { scheduled_date: originalDate } }),
      ),
    )
    toast.error('Failed to reschedule', {
      description: (failures[0].reason as Error | undefined)?.message
        ?? `${failures.length} of ${group.entries.length} platforms failed; the move was rolled back.`,
    })
  }, [allGroups, updateEntry])

  const [drawerOpen, setDrawerOpen]               = useState(false)
  const [drawerMode, setDrawerMode]               = useState<'create' | 'edit'>('create')
  const [editingGroup, setEditingGroup]           = useState<EntryGroup | null>(null)
  const [defaultDate, setDefaultDate]             = useState<string | undefined>(undefined)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  // Quick-action delete from the ⋯ menu uses its own AlertDialog so the
  // confirmation matches the rest of the app instead of a native window.confirm.
  const [quickDeleteGroup, setQuickDeleteGroup] = useState<EntryGroup | null>(null)
  const [quickDeleteBusy, setQuickDeleteBusy] = useState(false)
  const lastTriggerRef = useRef<HTMLElement | null>(null)

  const [defaultFormat, setDefaultFormat] = useState<ContentFormat | null>(null)
  const openCreate = useCallback((date?: string, fmt?: ContentFormat | null) => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDrawerMode('create')
    setEditingGroup(null)
    setDefaultDate(date)
    setDefaultFormat(fmt ?? null)
    setDrawerOpen(true)
  }, [])

  const openEdit = useCallback((group: EntryGroup) => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDrawerMode('edit')
    setEditingGroup(group)
    setDefaultDate(undefined)
    setDrawerOpen(true)
  }, [])

  const handleDrawerOpenChange = useCallback((open: boolean) => {
    setDrawerOpen(open)
    if (!open) {
      const el = lastTriggerRef.current
      if (el && document.contains(el)) {
        requestAnimationFrame(() => el.focus())
      }
    }
  }, [])

  // Shared (non per-platform) fields. Combined with a per-platform
  // variant in buildPayloadFor() below.
  function sharedPayload(v: EntryFormValues) {
    return {
      content_type: v.contentType as ContentType,
      title: v.title.trim(),
      reference_image_url: v.referenceImageUrl.trim() || null,
      scheduled_date: v.date,
      status: v.status,
      campaign_id: v.campaignId,
      pillar_id: v.pillarId,
      approval_status: v.approvalStatus,
      approval_note: v.approvalNote.trim() || null,
      assigned_editor: null,
      assigned_shooter: null,
      assigned_talent: v.talent || null,
      character: v.character || null,
    }
  }

  // Per-platform script / notes / format are pulled from the form's
  // variants record. Falls back to empty when a variant is missing —
  // shouldn't happen in practice because the drawer initializes a
  // variant for every selected platform.
  function buildPayloadFor(v: EntryFormValues, platform: Platform) {
    const variant = v.variants[platform] ?? { script: '', notes: '', format: null }
    return {
      ...sharedPayload(v),
      script: variant.script.trim() || null,
      notes:  variant.notes.trim()  || null,
      format: variant.format,
    }
  }

  async function handleSave(v: EntryFormValues) {
    if (!v.title.trim() || !v.date) {
      toast.error('Title and date are required')
      return
    }
    try {
      // formTalent may be an agent name or a team-member email — try to resolve.
      const specialist = v.talent || ''
      const specialistId = specialist
        ? teamMembers.find((m) => m.email === specialist)?.user_id ?? null
        : null

      if (drawerMode === 'create') {
        const platforms = v.platforms.length > 0 ? v.platforms : ['instagram' as Platform]

        // Fire all platform inserts in parallel. If any fail, roll back the
        // successful rows so we don't leave a partial group.
        const results = await Promise.allSettled(
          platforms.map((plat) =>
            createEntry.mutateAsync({
              brand_id: activeBrand!.id,
              ...buildPayloadFor(v, plat),
              platform: plat,
              generated_content_id: null,
            } as CalendarEntryInsert),
          ),
        )
        const created: CalendarEntry[] = []
        const failed: { platform: Platform; reason: unknown }[] = []
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') created.push(r.value)
          else failed.push({ platform: platforms[i], reason: r.reason })
        })

        if (failed.length > 0) {
          await Promise.allSettled(created.map((e) => deleteEntry.mutateAsync(e.id)))
          const first = failed[0].reason
          throw first instanceof Error
            ? first
            : new Error(`Failed to create entry for ${failed.map((f) => f.platform).join(', ')}`)
        }

        // Every calendar entry gets a linked task — assignee optional.
        // Description carries the script so specialists see the brief on
        // their task without round-tripping back to the calendar.
        const firstEntry = created[0] ?? null
        if (firstEntry) {
          // Task description carries the linked entry's script. Use the
          // platform that became the linked row (firstEntry.platform) so
          // the description matches what's saved against that calendar row.
          const taskScript = v.variants[firstEntry.platform as Platform]?.script.trim() || null
          await createTask.mutateAsync({
            brand_id: activeBrand!.id,
            title: v.title.trim(),
            description: taskScript,
            type: 'content',
            status: deriveTaskStatus(v.status),
            priority: 'medium',
            assignee_id: specialistId,
            assignee_email: specialist || null,
            calendar_entry_id: firstEntry.id,
            due_date: v.date,
            created_by: null,
          })
        }

        toast.success(platforms.length > 1 ? `${platforms.length} entries created` : 'Entry created')
      } else {
        const group = editingGroup!
        const currentPlatforms = group.platforms
        const toUpdate = v.platforms.filter((p) => currentPlatforms.includes(p))
        const toAdd    = v.platforms.filter((p) => !currentPlatforms.includes(p))
        const toRemove = currentPlatforms.filter((p) => !v.platforms.includes(p))

        for (const plat of toUpdate) {
          const e = group.entries.find((e) => e.platform === plat)
          if (e) await updateEntry.mutateAsync({ id: e.id, patch: buildPayloadFor(v, plat) })
        }
        for (const plat of toAdd) {
          await createEntry.mutateAsync({
            brand_id: activeBrand!.id,
            ...buildPayloadFor(v, plat),
            platform: plat,
            generated_content_id: group.representative.generated_content_id,
          } as CalendarEntryInsert)
        }
        for (const plat of toRemove) {
          const e = group.entries.find((e) => e.platform === plat)
          if (e) await deleteEntry.mutateAsync(e.id)
        }

        const repId = group.representative.id
        // Match on any entry in the group (rep can shift between edits) to
        // avoid creating a duplicate task.
        const groupEntryIds = new Set(group.entries.map((e) => e.id))
        const existingTask = (tasks.data ?? []).find((t) =>
          t.calendar_entry_id ? groupEntryIds.has(t.calendar_entry_id) : false,
        )
        const derivedStatus = deriveTaskStatus(v.status)
        // Task description tracks the representative's variant — the rep
        // is the row the task is linked to (or will be linked to).
        const repPlatform = group.representative.platform as Platform
        const taskScript = v.variants[repPlatform]?.script.trim() || null
        if (existingTask) {
          await updateTask.mutateAsync({
            id: existingTask.id,
            patch: {
              title: v.title.trim(),
              description: taskScript,
              status: derivedStatus,
              assignee_id: specialistId,
              assignee_email: specialist || null,
              due_date: v.date,
            },
          })
        } else {
          await createTask.mutateAsync({
            brand_id: activeBrand!.id,
            title: v.title.trim(),
            description: taskScript,
            type: 'content',
            status: derivedStatus,
            priority: 'medium',
            assignee_id: specialistId,
            assignee_email: specialist || null,
            calendar_entry_id: repId,
            due_date: v.date,
            created_by: null,
          })
        }

        toast.success('Entry saved')
      }
      handleDrawerOpenChange(false)
    } catch (err) {
      toast.error('Failed to save', { description: (err as Error).message })
    }
  }

  async function confirmAndDelete() {
    setConfirmDeleteOpen(false)
    if (!editingGroup) return
    try {
      await Promise.all(editingGroup.entries.map((e) => deleteEntry.mutateAsync(e.id)))
      toast.success('Entry deleted')
      handleDrawerOpenChange(false)
    } catch (err) {
      toast.error('Failed to delete', { description: (err as Error).message })
    }
  }

  // ── Bulk-edit handlers ─────────────────────────────────────────────────
  const toggleSelect = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // Day-level toggle: selects or deselects every group on a given day in
  // one click. Driven from the day-number checkbox in DayCell.
  const toggleSelectDay = useCallback((groupIds: string[], to: 'select' | 'deselect') => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (to === 'select') groupIds.forEach((id) => next.add(id))
      else groupIds.forEach((id) => next.delete(id))
      return next
    })
  }, [])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedGroupIds(new Set())
  }, [])

  // Flatten selected group ids → all the per-platform sibling entries, so
  // bulk ops hit every physical row the UI's logical "card" represents.
  const selectedEntries = useMemo(() => {
    if (selectedGroupIds.size === 0) return [] as CalendarEntry[]
    return allGroups
      .filter((g) => selectedGroupIds.has(g.id))
      .flatMap((g) => g.entries)
  }, [allGroups, selectedGroupIds])

  const handleBulkStatus = useCallback(async (status: CalendarStatus) => {
    if (selectedEntries.length === 0) return
    setBulkBusy(true)
    try {
      await Promise.all(selectedEntries.map((e) =>
        updateEntry.mutateAsync({ id: e.id, patch: { status } }),
      ))
      toast.success(`Marked ${selectedEntries.length} entries as ${status}`)
      exitSelectMode()
    } catch (err) {
      toast.error('Bulk update failed', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBulkBusy(false)
    }
  }, [selectedEntries, updateEntry, exitSelectMode])

  const handleBulkDate = useCallback(async (newDate: string) => {
    if (selectedEntries.length === 0 || !newDate) return
    setBulkBusy(true)
    try {
      await Promise.all(selectedEntries.map((e) =>
        updateEntry.mutateAsync({ id: e.id, patch: { scheduled_date: newDate } }),
      ))
      toast.success(`Moved ${selectedEntries.length} entries to ${newDate}`)
      exitSelectMode()
    } catch (err) {
      toast.error('Bulk date change failed', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBulkBusy(false)
    }
  }, [selectedEntries, updateEntry, exitSelectMode])

  const handleBulkDelete = useCallback(async () => {
    if (selectedEntries.length === 0) return
    setBulkBusy(true)
    try {
      await Promise.all(selectedEntries.map((e) => deleteEntry.mutateAsync(e.id)))
      toast.success(`Deleted ${selectedEntries.length} entries`)
      setBulkConfirmDelete(false)
      exitSelectMode()
    } catch (err) {
      toast.error('Bulk delete failed', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBulkBusy(false)
    }
  }, [selectedEntries, deleteEntry, exitSelectMode])

  // Bulk export — wraps every selected group into a single date-grouped
  // ExportSections object and pipes it through the same helpers used by the
  // calendar-level export dialog. Groups are bucketed by scheduled_date so
  // the resulting doc reads chronologically.
  const [bulkExporting, setBulkExporting] = useState<'pdf' | 'word' | null>(null)
  const handleBulkExport = useCallback(async (kind: 'pdf' | 'word') => {
    if (!activeBrand || selectedGroupIds.size === 0) return
    const groups = allGroups.filter((g) => selectedGroupIds.has(g.id))
    if (groups.length === 0) return
    setBulkExporting(kind)
    try {
      const byDate = new Map<string, typeof groups>()
      for (const g of groups) {
        const date = g.representative.scheduled_date
        const list = byDate.get(date) ?? []
        list.push(g)
        byDate.set(date, list)
      }
      const sortedDates = Array.from(byDate.keys()).sort()
      const sections = sortedDates.map((d) => ({
        heading: format(parseISO(d), 'EEE, MMM d'),
        entries: byDate.get(d)!,
      }))
      const rangeLabel = sortedDates.length === 1
        ? format(parseISO(sortedDates[0]), 'MMM d, yyyy')
        : `${format(parseISO(sortedDates[0]), 'MMM d')} – ${format(parseISO(sortedDates[sortedDates.length - 1]), 'MMM d, yyyy')}`
      const args = {
        brandName: activeBrand.name,
        rangeLabel,
        groupBy: 'date' as const,
        sections,
      }
      if (kind === 'pdf') await exportCalendarToPdf(args)
      else await exportCalendarToWord(args)
      toast.success(`Exported ${groups.length} ${groups.length === 1 ? 'entry' : 'entries'}`)
    } catch (err) {
      toast.error('Export failed', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBulkExporting(null)
    }
  }, [activeBrand, allGroups, selectedGroupIds])

  // Bridge the drawer's Generate button to the AI generator. The drawer
  // knows the per-post info (title, platform, theme, format); the calendar
  // page supplies brand + tone defaults.
  const handleGenerateCaption = useCallback(async (args: {
    title: string
    platform: Platform
    theme: ContentTheme
    format: ContentFormat | null
  }): Promise<string | null> => {
    // Platform → GeneratorPlatform mapping. Generator has 4 buckets; calendar
    // has 6. Instagram/Facebook/Twitter all route through 'meta' (which is
    // short-form social copy); LinkedIn/YouTube/TikTok map 1:1.
    const generatorPlatform: GeneratorPlatform =
      args.platform === 'linkedin' ? 'linkedin' :
      args.platform === 'youtube' ? 'youtube' :
      args.platform === 'tiktok' ? 'tiktok' : 'meta'
    // Format hint stitched into the brief so the model produces the right
    // shape — line-by-line beats for a reel, sweep-able slides for a
    // carousel, single-image copy for a static, etc.
    const formatHint =
      args.format === 'reel' ?
        'Output as a 30–40 second short-form video script. One line per beat (hook, talking point, talking point, CTA). Voiceover-ready, conversational.' :
      args.format === 'carousel' ?
        'Output as a multi-slide carousel (5–8 slides max). Label each line "Slide N:" and keep each slide one tight idea, 1–2 sentences max.' :
      args.format === 'static' ?
        'Output as a single-image post. One short, hook-first caption. No slide structure, no script.' :
      args.format === 'emergency_backup' ?
        'Output as evergreen fallback content. Static or short carousel (max 4 slides). Avoid time-bound references — this can run any week.' :
        ''
    const brief = formatHint
      ? `${args.title}\n\nFormat brief: ${formatHint}`
      : args.title
    const result = await generateContent.mutateAsync({
      theme: args.theme,
      platform: generatorPlatform,
      tone: 'professional',
      source: { type: 'manual', brief },
    })
    // Generator returns an array of variants; first variant is the one the
    // user sees on the Generator page as the primary.
    return result.output?.[0] ?? null
  }, [generateContent])

  // Quick-action handler for the ⋯ menu on each entry card. Each action
  // operates on every row in the group (multi-platform entries are stored
  // as separate rows that we keep in sync).
  const handleQuickAction = useCallback(async (group: EntryGroup, action: 'mark-published' | 'mark-scheduled' | 'move-plus-1d' | 'move-plus-7d' | 'delete') => {
    try {
      if (action === 'delete') {
        // Opens the AlertDialog at the bottom of the page; actual delete
        // runs from handleConfirmQuickDelete after the user confirms.
        setQuickDeleteGroup(group)
        return
      }
      if (action === 'mark-published' || action === 'mark-scheduled') {
        const status: CalendarStatus = action === 'mark-published' ? 'published' : 'scheduled'
        await Promise.all(group.entries.map((e) => updateEntry.mutateAsync({ id: e.id, patch: { status } })))
        toast.success(action === 'mark-published' ? 'Marked Published' : 'Marked Scheduled')
        return
      }
      // move-plus-Nd
      const days = action === 'move-plus-1d' ? 1 : 7
      const newDate = format(addDays(parseISO(group.representative.scheduled_date), days), 'yyyy-MM-dd')
      await Promise.all(group.entries.map((e) => updateEntry.mutateAsync({ id: e.id, patch: { scheduled_date: newDate } })))
      toast.success(`Moved to ${format(parseISO(newDate), 'MMM d')}`)
    } catch (err) {
      toast.error('Action failed', { description: err instanceof Error ? err.message : String(err) })
    }
  }, [updateEntry])

  const handleConfirmQuickDelete = useCallback(async () => {
    if (!quickDeleteGroup) return
    setQuickDeleteBusy(true)
    try {
      await Promise.all(quickDeleteGroup.entries.map((e) => deleteEntry.mutateAsync(e.id)))
      toast.success('Entry deleted')
      setQuickDeleteGroup(null)
    } catch (err) {
      toast.error('Delete failed', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setQuickDeleteBusy(false)
    }
  }, [quickDeleteGroup, deleteEntry])

  async function handleDuplicate() {
    if (!editingGroup || !activeBrand) return
    try {
      const copies: CalendarEntry[] = []
      for (const e of editingGroup.entries) {
        const copy = await createEntry.mutateAsync({
          brand_id: activeBrand.id,
          platform: e.platform,
          content_type: e.content_type,
          title: `${e.title} (copy)`,
          body: e.body,
          script: e.script,
          notes: e.notes,
          format: e.format,
          reference_image_url: e.reference_image_url,
          scheduled_date: e.scheduled_date,
          status: 'draft',
          generated_content_id: null,
          campaign_id: e.campaign_id,
          pillar_id: e.pillar_id,
          approval_status: null,
          approval_note: null,
          assigned_editor: null,
          assigned_shooter: null,
          assigned_talent: e.assigned_talent,
          character: e.character,
        } as CalendarEntryInsert)
        copies.push(copy)
      }

      const firstCopy = copies[0]
      if (firstCopy) {
        const assignedEmail = firstCopy.assigned_talent ?? null
        const assignedId = assignedEmail
          ? teamMembers.find((m) => m.email === assignedEmail)?.user_id ?? null
          : null
        await createTask.mutateAsync({
          brand_id: activeBrand.id,
          title: firstCopy.title,
          description: null,
          type: 'content',
          status: deriveTaskStatus('draft'),
          priority: 'medium',
          assignee_id: assignedId,
          assignee_email: assignedEmail,
          calendar_entry_id: firstCopy.id,
          due_date: firstCopy.scheduled_date,
          created_by: null,
        })
      }

      // Reopen the drawer on the duplicate so the user can rename it.
      if (copies.length > 0) {
        const newGroup: EntryGroup = {
          id: copies[0].id,
          representative: copies[0],
          entries: copies,
          platforms: copies.map((c) => c.platform),
        }
        openEdit(newGroup)
      } else {
        handleDrawerOpenChange(false)
      }

      toast.success('Entry duplicated — rename and save')
    } catch (err) {
      toast.error('Failed to duplicate', { description: (err as Error).message })
    }
  }

  // Pillar drawer
  const [pillarDrawerOpen, setPillarDrawerOpen] = useState(false)

  // ── Calendar export ───────────────────────────────────────────────────────
  // Dialog with range / filter / group-by options. The actual fetch and
  // helper invocation live in ExportCalendarDialog.
  const [exportOpen, setExportOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // ? opens the keyboard shortcuts dialog. Skipped when typing in an
  // input/textarea/contenteditable so search and entry forms don't fire it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      setShortcutsOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleAddPillar = useCallback(async (input: { label: string; target_pct: number; color: string }) => {
    if (!activeBrand) return
    await createPillar.mutateAsync({
      brand_id: activeBrand.id,
      label: input.label,
      target_pct: input.target_pct,
      color: input.color,
    })
  }, [activeBrand, createPillar])

  const handleDeletePillar = useCallback(async (id: string) => {
    await deletePillar.mutateAsync(id)
  }, [deletePillar])

  if (!activeBrand) return <NoBrandSelected />

  const saving =
    createEntry.isPending ||
    updateEntry.isPending ||
    createTask.isPending ||
    updateTask.isPending

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="eyebrow mb-1.5">Create</div>
          <h1 className="font-heading font-medium leading-[1.05] tracking-tight text-[22px] sm:text-[30px] truncate">Content Calendar</h1>
          <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-1 truncate">{activeBrand.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pillarDist.length === 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
              onClick={() => setPillarDrawerOpen(true)}
            >
              Configure pillars
            </Button>
          )}
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/campaigns')}>Campaigns</Button>
          <Button size="sm" onClick={() => openCreate()}>New</Button>
        </div>
      </div>

      {/* Filter bar — visuals first. No eyebrow labels; the chip styling
          carries the meaning. Three groups separated by thin dividers:
          platforms · status · format. */}
      <div
        className="relative px-4 sm:px-6 pb-3 flex items-center gap-1.5 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-x-visible border-b border-border shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)] sm:[mask-image:none]">
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() =>
              setFilterPlatforms((prev) =>
                prev.includes(p.value)
                  ? prev.filter((x) => x !== p.value)
                  : [...prev, p.value],
              )
            }
            aria-pressed={filterPlatforms.includes(p.value)}
            aria-label={`Filter: ${p.label}`}
            className="rounded-full border border-transparent hover:opacity-90 transition-opacity shrink-0"
          >
            <PlatformPill platform={p.value} label={p.label} active={filterPlatforms.includes(p.value)} />
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1.5 shrink-0" />
        {(['all', 'draft', 'scheduled', 'published'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            aria-pressed={filterStatus === s}
            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-150 hover:-translate-y-px active:translate-y-0 active:scale-95 ${
              filterStatus === s
                ? s === 'all'
                  ? 'bg-foreground text-background border-transparent shadow-sm'
                  : `${CALENDAR_STATUS_CHIP[s as CalendarStatus]} border-transparent shadow-sm`
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1.5 shrink-0" />
        <button
          type="button"
          onClick={() => setFilterFormat('all')}
          aria-pressed={filterFormat === 'all'}
          className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-150 hover:-translate-y-px active:translate-y-0 active:scale-95 ${
            filterFormat === 'all'
              ? 'bg-foreground text-background border-transparent shadow-sm'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
          }`}
        >
          All
        </button>
        {CONTENT_FORMATS.map((f) => {
          const dotColor: Record<typeof f.value, string> = {
            reel: 'bg-purple-500',
            carousel: 'bg-blue-500',
            static: 'bg-emerald-500',
            emergency_backup: 'bg-red-500',
          }
          const active = filterFormat === f.value
          return (
            <button
              key={f.value}
              type="button"
              title={f.desc}
              onClick={() => setFilterFormat((prev) => prev === f.value ? 'all' : f.value)}
              aria-pressed={active}
              aria-label={`Filter: ${f.label}`}
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-150 hover:-translate-y-px active:translate-y-0 active:scale-95 ${
                active
                  ? `${CONTENT_FORMAT_SOLID[f.value]} border-transparent shadow-sm`
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white/80' : dotColor[f.value]}`} aria-hidden />
              {f.label}
            </button>
          )
        })}
        <div className="sm:ml-auto relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-7 pl-8 pr-7 w-36 sm:w-44 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Pillar distribution bar — live gauges showing this month's actual
          share vs target per pillar. Bar fill = actual, vertical tick = target. */}
      {pillarDist.length > 0 && (
        <div className="px-4 sm:px-6 py-2 border-b border-border bg-muted/20 shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            {pillarDist.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5" title={`${p.count} entries this month`}>
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="text-xs text-muted-foreground">{p.label}</span>
                <div className="relative h-1.5 w-16 sm:w-20 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, p.actual_pct)}%`, background: p.color }}
                  />
                  <div
                    className="absolute inset-y-[-2px] w-px bg-foreground/50"
                    style={{ left: `${Math.min(100, p.target_pct)}%` }}
                    aria-hidden
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums" style={{ color: p.color }}>
                  {p.actual_pct}%
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">/ {p.target_pct}%</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPillarDrawerOpen(true)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded px-2 py-0.5 transition-colors"
            >
              Configure Pillars
            </button>
          </div>
        </div>
      )}

      {/* Calendar nav + view toggle */}
      <div className="px-4 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Previous month"
          className="p-1 rounded hover:bg-accent transition-all duration-150 active:scale-90"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span
          key={`${viewYear}-${viewMonth}`}
          className="font-heading text-[15px] sm:text-base font-medium tracking-tight min-w-[110px] sm:min-w-[140px] text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
        >
          {format(new Date(viewYear, viewMonth), 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          className="p-1 rounded hover:bg-accent transition-all duration-150 active:scale-90"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
          className="ml-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-all duration-150 hover:border-foreground/40 hover:bg-accent/40 active:scale-95"
        >
          Today
        </button>
        {/* Format mix mini-chart — stacked bar showing this month's
            reel/carousel/static/backup balance. Segments animate width on
            month change. */}
        {formatMix.total > 0 && (
          <div
            className="hidden md:flex ml-2 items-center gap-2 text-[11px] text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
            title={`Reels ${formatMix.counts.reel} · Carousels ${formatMix.counts.carousel} · Street Interviews ${formatMix.counts.static} · Backup ${formatMix.counts.emergency_backup}${formatMix.counts.unset > 0 ? ` · Unset ${formatMix.counts.unset}` : ''}`}
          >
            <div className="flex h-2 w-36 rounded-full overflow-hidden border border-border bg-muted/60 shadow-inner">
              {(['reel', 'carousel', 'static', 'emergency_backup', 'unset'] as const).map((k) => {
                const w = formatMix.total ? (formatMix.counts[k] / formatMix.total) * 100 : 0
                if (w === 0) return null
                const bg =
                  k === 'reel' ? 'bg-purple-500' :
                  k === 'carousel' ? 'bg-blue-500' :
                  k === 'static' ? 'bg-emerald-500' :
                  k === 'emergency_backup' ? 'bg-red-500' :
                  'bg-zinc-400'
                return <div
                  key={k}
                  className={`h-full ${bg} transition-[width] duration-500 ease-out`}
                  style={{ width: `${w}%` }}
                />
              })}
            </div>
            <span className="tabular-nums font-medium">{formatMix.total}</span>
          </div>
        )}
        {!selectMode && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-all duration-150 hover:border-foreground/40 hover:bg-accent/40 active:scale-95"
              title="Keyboard shortcuts (press ? to toggle)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="h-3 w-3" aria-hidden />
            </button>
            <Button
              type="button"
              size="xs"
              onClick={() => setExportOpen(true)}
              title="Export the calendar as PDF or Word"
            >
              <Download className="h-3 w-3" aria-hidden />
              Export
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (selectMode) exitSelectMode()
            else setSelectMode(true)
          }}
          className={`${selectMode ? 'ml-auto' : ''} text-xs border rounded px-2 py-0.5 transition-colors ${
            selectMode
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(['month', 'week'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === m
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Emergency Backup lane — evergreen fallback content. One-line strip.
          Each chip is draggable: drop it onto a day to "deploy" the backup
          (re-dates the entry and flips format off emergency_backup). */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      {filterFormat === 'all' && (
        <div className="border-b border-border bg-red-500/[0.03] px-4 sm:px-6 py-1.5 shrink-0 flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 dark:text-red-400" title="Evergreen fallback content. Static or carousel, max 4 slides. Drag a chip onto any day to deploy.">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
            Backup
            <span className="text-muted-foreground font-normal">{emergencyGroups.length}</span>
          </span>
          {emergencyGroups.map((g) => (
            <EmergencyChip key={g.id} group={g} onClick={() => openEdit(g)} />
          ))}
          <button
            type="button"
            onClick={() => openCreate(format(today, 'yyyy-MM-dd'), 'emergency_backup')}
            className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium border border-dashed border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/[0.08] transition-colors"
            title="Create a new emergency backup entry"
          >
            + New
          </button>
        </div>
      )}

      {/* Empty / first-run state — a thin advisory above the grid when the
          current month/filters yield nothing to render. Two flavors:
          - filters active and trimmed to zero → offer a Clear filters button
          - no entries at all this month → orientation hint */}
      {(() => {
        const filtersActive =
          filterPlatforms.length !== PLATFORMS.length ||
          filterStatus !== 'all' ||
          filterFormat !== 'all' ||
          search.trim().length > 0
        const monthHasAnyNonEmergency = (entries.data ?? []).some(
          (e) => e.format !== 'emergency_backup',
        )
        if (dateGridGroups.length > 0) return null
        if (filtersActive && monthHasAnyNonEmergency) {
          return (
            <div className="px-4 sm:px-6 py-2 border-b border-border bg-muted/30 shrink-0 flex items-center gap-3 text-xs motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200">
              <span className="text-muted-foreground">No entries match the current filters.</span>
              <button
                type="button"
                onClick={() => {
                  setFilterPlatforms(PLATFORMS.map((p) => p.value))
                  setFilterStatus('all')
                  setFilterFormat('all')
                  setSearch('')
                }}
                className="text-foreground font-medium hover:underline transition-colors"
              >
                Clear filters
              </button>
            </div>
          )
        }
        if (!monthHasAnyNonEmergency) {
          return (
            <div className="px-4 sm:px-6 py-2 border-b border-border bg-muted/20 shrink-0 text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200">
              No posts scheduled in {format(new Date(viewYear, viewMonth), 'MMMM yyyy')}. Click any day to draft your first.
            </div>
          )
        }
        return null
      })()}

      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-border px-4 sm:px-6 shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground text-center">
            <span className="sm:hidden">{d.slice(0,1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
        <div
          key={`${viewYear}-${viewMonth}`}
          className="grid grid-cols-7 border-l border-t border-border motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
        >
          {gridDays.map((day) => (
            <DayCell
              key={format(day, 'yyyy-MM-dd')}
              day={day}
              groups={groupsForDay(day)}
              isCurrentMonth={isSameMonth(day, new Date(viewYear, viewMonth))}
              tall={viewMode === 'week'}
              onGroupClick={openEdit}
              onAddClick={() => openCreate(format(day, 'yyyy-MM-dd'))}
              selectMode={selectMode}
              selectedGroupIds={selectedGroupIds}
              onToggleSelect={toggleSelect}
              onToggleSelectDay={toggleSelectDay}
              onQuickAction={handleQuickAction}
            />
          ))}
        </div>
        <DragOverlay>
          {draggingGroup && <EntryCardOverlay group={draggingGroup} />}
        </DragOverlay>
      </div>
      </DndContext>

      <EntryDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        mode={drawerMode}
        group={editingGroup}
        defaultDate={defaultDate}
        defaultFormat={defaultFormat}
        members={teamMembers}
        campaigns={campaigns.data ?? []}
        pillars={pillars.data ?? []}
        saving={saving}
        deleting={deleteEntry.isPending}
        onSave={handleSave}
        onDelete={() => setConfirmDeleteOpen(true)}
        onDuplicate={handleDuplicate}
        duplicating={createEntry.isPending}
        onGenerateCaption={handleGenerateCaption}
      />

      <PillarConfigDrawer
        open={pillarDrawerOpen}
        onOpenChange={setPillarDrawerOpen}
        pillars={pillars.data ?? []}
        creating={createPillar.isPending}
        onAdd={handleAddPillar}
        onDelete={handleDeletePillar}
      />

      {/* Bulk-edit action bar — visible the moment select mode is on so all
          actions (Export, Move, Status, Delete) are discoverable. Buttons
          are disabled with a hint until at least one entry is selected. */}
      {selectMode && (() => {
        const hasSelection = selectedGroupIds.size > 0
        const disabledAll = !hasSelection || bulkBusy
        return (
        <div
          style={{ bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}
          className="premium-card fixed left-1/2 -translate-x-1/2 z-40 ring-1 ring-border/80 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap max-w-[calc(100vw-2rem)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
        >
          <span className={`text-xs font-medium tabular-nums ${hasSelection ? 'text-foreground' : 'text-muted-foreground'}`}>
            {hasSelection
              ? <>{selectedEntries.length} selected</>
              : 'Select entries to act on them'}
          </span>
          <div className="h-4 w-px bg-border" />
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={disabledAll}
              onClick={() => handleBulkStatus(s.value)}
              className="text-xs px-2 py-0.5 rounded border border-border hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {s.label}
            </button>
          ))}
          <div className="h-4 w-px bg-border" />
          <label className={`text-xs flex items-center gap-1 ${disabledAll ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
            Move to
            <input
              type="date"
              disabled={disabledAll}
              onChange={(e) => {
                if (e.target.value) handleBulkDate(e.target.value)
              }}
              className="h-6 rounded border border-border bg-transparent px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
            />
          </label>
          <div className="h-4 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={disabledAll || !!bulkExporting}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-foreground/20 bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                title={hasSelection ? 'Export selected entries' : 'Select entries first'}
              >
                {bulkExporting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                {bulkExporting ? 'Exporting…' : 'Export'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem onSelect={() => handleBulkExport('pdf')}>
                <FileText className="h-3.5 w-3.5" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleBulkExport('word')}>
                <FileText className="h-3.5 w-3.5" />
                Export as Word
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            disabled={disabledAll}
            onClick={() => setBulkConfirmDelete(true)}
            className="text-xs px-2 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={exitSelectMode}
            className="text-xs px-2 py-0.5 rounded border border-border hover:bg-accent transition-colors ml-1"
          >
            Done
          </button>
        </div>
        )
      })()}

      {activeBrand && (
        <ExportCalendarDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          brandId={activeBrand.id}
          brandName={activeBrand.name}
          viewYear={viewYear}
          viewMonth={viewMonth}
          filterPlatforms={filterPlatforms}
          filterStatus={filterStatus}
          searchQuery={search}
        />
      )}

      {/* Keyboard shortcuts cheat sheet — opened by the ? key or the
          keyboard icon in the toolbar. */}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <ShortcutsDialogContent className="sm:max-w-md">
          <ShortcutsDialogHeader>
            <ShortcutsDialogTitle>Keyboard shortcuts</ShortcutsDialogTitle>
            <ShortcutsDialogDescription>
              Quick keys for the calendar surface. Press <kbd className="px-1 rounded bg-muted text-foreground">?</kbd> from anywhere to reopen.
            </ShortcutsDialogDescription>
          </ShortcutsDialogHeader>
          <div className="space-y-2 text-sm">
            {[
              { keys: ['Click any day'], desc: 'Draft a new entry on that date' },
              { keys: ['Click an entry'], desc: 'Open the editor' },
              { keys: ['⌘', 'Enter'], desc: 'Save in editor' },
              { keys: ['Esc'], desc: 'Close editor (with discard guard)' },
              { keys: ['?'], desc: 'Toggle this cheat sheet' },
            ].map((row) => (
              <div key={row.desc} className="flex items-center justify-between gap-3 border-b border-border last:border-b-0 pb-2 last:pb-0">
                <span className="text-muted-foreground">{row.desc}</span>
                <div className="flex items-center gap-1">
                  {row.keys.map((k) => (
                    <kbd key={k} className="px-1.5 py-0.5 rounded border border-border bg-muted text-foreground text-[11px] font-mono">{k}</kbd>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground pt-2">
              Inside an entry: drag a card onto a different day to reschedule. Drag an Emergency Backup chip onto a day to deploy it. Right-side ⋯ menu on each card has Mark Published / Move +1d / Move +1w / Delete.
            </div>
          </div>
        </ShortcutsDialogContent>
      </ShortcutsDialog>

      <AlertDialog open={bulkConfirmDelete} onOpenChange={setBulkConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedEntries.length} entries?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Linked tasks remain and will need manual cleanup.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={bulkBusy}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!quickDeleteGroup}
        onOpenChange={(o) => { if (!o) setQuickDeleteGroup(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {quickDeleteGroup ? `"${quickDeleteGroup.representative.title}"` : 'entry'}?
            </AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={quickDeleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmQuickDelete}
              disabled={quickDeleteBusy}
            >
              {quickDeleteBusy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this calendar entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmAndDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
