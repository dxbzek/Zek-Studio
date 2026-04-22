import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
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
import { useCalendar } from '@/hooks/useCalendar'
import { useTeam } from '@/hooks/useTeam'
import { useTasks } from '@/hooks/useTasks'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useContentPillars } from '@/hooks/useContentPillars'
import { PLATFORMS } from '@/types'
import { PlatformPill } from '@/lib/platformBrand'
import {
  CALENDAR_STATUS_CHIP,
} from '@/lib/statusTokens'
import type {
  CalendarEntry,
  CalendarEntryInsert,
  CalendarStatus,
  ContentPillar,
  ContentType,
  Platform,
} from '@/types'
import { EntryCardOverlay } from '@/components/calendar/EntryCard'
import { DayCell } from '@/components/calendar/DayCell'
import {
  EntryDrawer,
  type EntryFormValues,
} from '@/components/calendar/EntryDrawer'
import { PillarConfigDrawer } from '@/components/calendar/PillarConfigDrawer'
import {
  deriveTaskStatus,
  groupEntries,
  type EntryGroup,
} from '@/components/calendar/entryGroups'

export function ContentCalendarPage() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()

  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewMode, setViewMode]   = useState<'month' | 'week'>('month')

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
  const { members } = useTeam(activeBrand?.id ?? null)
  const { tasks, createTask, updateTask } = useTasks(activeBrand?.id ?? null)
  const { campaigns } = useCampaigns(activeBrand?.id ?? null)
  const { pillars, createPillar, deletePillar } = useContentPillars(activeBrand?.id ?? null)

  const teamMembers = members.data ?? []

  const [filterPlatforms, setFilterPlatforms] = useState<Platform[]>([])
  const [filterStatus, setFilterStatus]       = useState<CalendarStatus | 'all'>('all')
  const [search, setSearch]                   = useState('')

  const filteredEntries = useMemo(() => {
    let result = entries.data ?? []
    if (filterPlatforms.length > 0)
      result = result.filter((e) => filterPlatforms.includes(e.platform))
    if (filterStatus !== 'all')
      result = result.filter((e) => e.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (e.body ?? '').toLowerCase().includes(q) ||
        e.content_type.toLowerCase().includes(q),
      )
    }
    return result
  }, [entries.data, filterPlatforms, filterStatus, search])

  const allGroups = useMemo(() => groupEntries(filteredEntries), [filteredEntries])
  const groupsForDay = (day: Date) =>
    allGroups.filter((g) => g.representative.scheduled_date === format(day, 'yyyy-MM-dd'))

  const firstDay  = startOfMonth(new Date(viewYear, viewMonth))
  const monthDays = eachDayOfInterval({
    start: startOfWeek(firstDay, { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(firstDay), { weekStartsOn: 0 }),
  })
  const weekAnchor = isSameMonth(today, firstDay) ? today : firstDay
  const weekStart  = startOfWeek(weekAnchor, { weekStartsOn: 0 })
  const weekDays   = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  const gridDays   = viewMode === 'month' ? monthDays : weekDays

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
    setDraggingGroup(allGroups.find((g) => g.id === event.active.id) ?? null)
  }, [allGroups])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingGroup(null)
    const { active, over } = event
    if (!over) return
    const targetDate = over.id as string
    const group = allGroups.find((g) => g.id === active.id)
    if (!group || group.representative.scheduled_date === targetDate) return
    Promise.all(
      group.entries.map((e) =>
        updateEntry.mutateAsync({ id: e.id, patch: { scheduled_date: targetDate } }),
      ),
    )
      .then(() => toast.success('Entry rescheduled'))
      .catch((err) => toast.error('Failed to reschedule', { description: (err as Error).message }))
  }, [allGroups, updateEntry])

  const [drawerOpen, setDrawerOpen]               = useState(false)
  const [drawerMode, setDrawerMode]               = useState<'create' | 'edit'>('create')
  const [editingGroup, setEditingGroup]           = useState<EntryGroup | null>(null)
  const [defaultDate, setDefaultDate]             = useState<string | undefined>(undefined)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const lastTriggerRef = useRef<HTMLElement | null>(null)

  const openCreate = useCallback((date?: string) => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDrawerMode('create')
    setEditingGroup(null)
    setDefaultDate(date)
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

  function buildCommonPayload(v: EntryFormValues) {
    return {
      content_type: v.contentType as ContentType,
      title: v.title.trim(),
      body: v.body.trim() || null,
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
              ...buildCommonPayload(v),
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
        const firstEntry = created[0] ?? null
        if (firstEntry) {
          await createTask.mutateAsync({
            brand_id: activeBrand!.id,
            title: v.title.trim(),
            description: null,
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
          if (e) await updateEntry.mutateAsync({ id: e.id, patch: buildCommonPayload(v) })
        }
        for (const plat of toAdd) {
          await createEntry.mutateAsync({
            brand_id: activeBrand!.id,
            ...buildCommonPayload(v),
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
        if (existingTask) {
          await updateTask.mutateAsync({
            id: existingTask.id,
            patch: {
              title: v.title.trim(),
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
            description: null,
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

      {/* Filter bar */}
      <div
        className="relative px-4 sm:px-6 pb-3 flex items-center gap-1.5 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-x-visible border-b border-border shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)] sm:[mask-image:none]">
        <span className="shrink-0 eyebrow mr-1 hidden sm:inline">Platforms</span>
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
            className="rounded-full border border-transparent hover:opacity-90 transition-opacity shrink-0"
          >
            <PlatformPill platform={p.value} label={p.label} active={filterPlatforms.includes(p.value)} />
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-2 shrink-0" />
        <span className="shrink-0 eyebrow mr-1 hidden sm:inline">Status</span>
        {(['all', 'draft', 'scheduled', 'published'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? s === 'all'
                  ? 'bg-foreground text-background border-transparent'
                  : `${CALENDAR_STATUS_CHIP[s as CalendarStatus]} border-transparent`
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
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

      {/* Pillar distribution bar */}
      {pillarDist.length > 0 && (
        <div className="px-4 sm:px-6 py-2 border-b border-border bg-muted/20 shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Pillars:</span>
            {pillarDist.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="text-xs text-muted-foreground">{p.label}</span>
                <span className="text-xs font-semibold" style={{ color: p.color }}>
                  {p.actual_pct}%
                </span>
                <span className="text-xs text-muted-foreground">/ {p.target_pct}% target</span>
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
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="font-heading text-[15px] sm:text-base font-medium tracking-tight min-w-[110px] sm:min-w-[140px] text-center">
          {format(new Date(viewYear, viewMonth), 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
          className="ml-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
        >
          Today
        </button>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-0.5">
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-7 border-l border-t border-border">
            {gridDays.map((day) => (
              <DayCell
                key={format(day, 'yyyy-MM-dd')}
                day={day}
                groups={groupsForDay(day)}
                isCurrentMonth={isSameMonth(day, new Date(viewYear, viewMonth))}
                tall={viewMode === 'week'}
                onGroupClick={openEdit}
                onAddClick={() => openCreate(format(day, 'yyyy-MM-dd'))}
              />
            ))}
          </div>
          <DragOverlay>
            {draggingGroup && <EntryCardOverlay group={draggingGroup} />}
          </DragOverlay>
        </DndContext>
      </div>

      <EntryDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        mode={drawerMode}
        group={editingGroup}
        defaultDate={defaultDate}
        members={teamMembers}
        campaigns={campaigns.data ?? []}
        pillars={pillars.data ?? []}
        saving={saving}
        deleting={deleteEntry.isPending}
        onSave={handleSave}
        onDelete={() => setConfirmDeleteOpen(true)}
        onDuplicate={handleDuplicate}
        duplicating={createEntry.isPending}
      />

      <PillarConfigDrawer
        open={pillarDrawerOpen}
        onOpenChange={setPillarDrawerOpen}
        pillars={pillars.data ?? []}
        creating={createPillar.isPending}
        onAdd={handleAddPillar}
        onDelete={handleDeletePillar}
      />

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
