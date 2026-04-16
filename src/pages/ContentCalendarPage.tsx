import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActiveBrand } from '@/stores/activeBrand'
import { useCalendar, useGeneratedContent } from '@/hooks/useCalendar'
import { useTeam } from '@/hooks/useTeam'
import { useTasks } from '@/hooks/useTasks'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useContentPillars } from '@/hooks/useContentPillars'
import { PLATFORMS } from '@/types'
import type {
  CalendarEntry,
  CalendarEntryInsert,
  CalendarStatus,
  Platform,
  ContentType,
  ApprovalStatus,
  ContentPillar,
} from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_CHIP_COLORS: Record<Platform, string> = {
  instagram: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  tiktok:    'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  facebook:  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  linkedin:  'bg-blue-800/10 text-blue-800 dark:text-blue-300',
  youtube:   'bg-red-500/10 text-red-600 dark:text-red-400',
}

const STATUS_COLORS: Record<CalendarStatus, string> = {
  draft:     'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  scheduled: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

const STATUS_BORDER_COLORS: Record<CalendarStatus, string> = {
  draft:     'border-l-zinc-400',
  scheduled: 'border-l-amber-400',
  published: 'border-l-emerald-500',
}

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'hook',    label: 'Hook'    },
  { value: 'caption', label: 'Caption' },
  { value: 'idea',    label: 'Idea'    },
]

const STATUSES: { value: CalendarStatus; label: string }[] = [
  { value: 'draft',     label: 'Draft'     },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
]

const PILLAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#64748b', '#0f172a',
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onClick,
}: {
  entry: CalendarEntry
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: entry.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
      }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-pointer rounded border border-border border-l-4 ${STATUS_BORDER_COLORS[entry.status]} bg-card px-2 py-1 text-xs hover:bg-accent transition-colors select-none`}
    >
      <span
        className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium mr-1 ${PLATFORM_CHIP_COLORS[entry.platform]}`}
      >
        {entry.platform}
      </span>
      {entry.approval_status === 'pending_review' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1 shrink-0 align-middle" />
      )}
      {entry.approval_status === 'approved' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 shrink-0 align-middle" />
      )}
      {entry.approval_status === 'rejected' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1 shrink-0 align-middle" />
      )}
      <span className="text-foreground line-clamp-1">{entry.title}</span>
    </div>
  )
}

function EntryCardOverlay({ entry }: { entry: CalendarEntry }) {
  return (
    <div
      className={`rounded border border-border border-l-4 ${STATUS_BORDER_COLORS[entry.status]} bg-card px-2 py-1 text-xs shadow-lg`}
    >
      <span
        className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium mr-1 ${PLATFORM_CHIP_COLORS[entry.platform]}`}
      >
        {entry.platform}
      </span>
      <span className="text-foreground line-clamp-1">{entry.title}</span>
    </div>
  )
}

function DayCell({
  day,
  entries,
  isCurrentMonth,
  tall,
  onCardClick,
  onAddClick,
}: {
  day: Date
  entries: CalendarEntry[]
  isCurrentMonth: boolean
  tall?: boolean
  onCardClick: (entry: CalendarEntry) => void
  onAddClick: () => void
}) {
  const dateStr = format(day, 'yyyy-MM-dd')
  const { isOver, setNodeRef } = useDroppable({ id: dateStr })
  const todayFlag = isSameDay(day, new Date())
  const MAX_VISIBLE = 3

  return (
    <div
      ref={setNodeRef}
      className={`group border-b border-r border-border p-1.5 flex flex-col gap-1 transition-colors ${tall ? 'min-h-[200px]' : 'min-h-[110px]'} ${!isCurrentMonth ? 'bg-muted/20' : ''} ${isOver ? 'bg-primary/5' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${todayFlag ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {format(day, 'd')}
        </span>
        {isCurrentMonth && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddClick() }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-sm leading-none px-1 rounded hover:bg-accent transition-opacity"
          >
            +
          </button>
        )}
      </div>
      {entries.slice(0, MAX_VISIBLE).map((entry) => (
        <EntryCard key={entry.id} entry={entry} onClick={() => onCardClick(entry)} />
      ))}
      {entries.length > MAX_VISIBLE && (
        <span className="text-[10px] text-muted-foreground px-1">
          +{entries.length - MAX_VISIBLE} more
        </span>
      )}
    </div>
  )
}

function GeneratedContentPreview({ id }: { id: string }) {
  const { data, isLoading } = useGeneratedContent(id)
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading source…</p>
  if (!data) return null
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Generated from
      </p>
      <p className="text-sm text-foreground">{data.brief}</p>
      <div className="flex gap-1.5 flex-wrap mt-1">
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {data.type}
        </span>
        <span className={`text-[11px] px-1.5 py-0.5 rounded ${PLATFORM_CHIP_COLORS[data.platform as Platform]}`}>
          {data.platform}
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ContentCalendarPage() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()

  // ── Navigation ────────────────────────────────────────────────────────────
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

  // ── Data ──────────────────────────────────────────────────────────────────
  const { entries, createEntry, updateEntry, deleteEntry } = useCalendar(
    activeBrand?.id ?? null,
    viewYear,
    viewMonth,
  )
  const { members } = useTeam(activeBrand?.id ?? null)
  const { createTask } = useTasks(activeBrand?.id ?? null)
  const { campaigns } = useCampaigns(activeBrand?.id ?? null)
  const { pillars, createPillar, deletePillar } = useContentPillars(activeBrand?.id ?? null)

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterPlatforms, setFilterPlatforms] = useState<Platform[]>([])
  const [filterStatus, setFilterStatus]       = useState<CalendarStatus | 'all'>('all')

  const filteredEntries = useMemo(() => {
    let result = entries.data ?? []
    if (filterPlatforms.length > 0)
      result = result.filter((e) => filterPlatforms.includes(e.platform))
    if (filterStatus !== 'all')
      result = result.filter((e) => e.status === filterStatus)
    return result
  }, [entries.data, filterPlatforms, filterStatus])

  const entriesForDay = (day: Date) =>
    filteredEntries.filter((e) => e.scheduled_date === format(day, 'yyyy-MM-dd'))

  // ── Grid ──────────────────────────────────────────────────────────────────
  const firstDay  = startOfMonth(new Date(viewYear, viewMonth))
  const monthDays = eachDayOfInterval({
    start: startOfWeek(firstDay, { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(firstDay), { weekStartsOn: 0 }),
  })
  const weekAnchor = isSameMonth(today, firstDay) ? today : firstDay
  const weekStart  = startOfWeek(weekAnchor, { weekStartsOn: 0 })
  const weekDays   = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  const gridDays   = viewMode === 'month' ? monthDays : weekDays

  // ── Pillar distribution ───────────────────────────────────────────────────
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

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )
  const [draggingEntry, setDraggingEntry] = useState<CalendarEntry | null>(null)

  function handleDragStart(event: DragStartEvent) {
    setDraggingEntry(
      (entries.data ?? []).find((e) => e.id === event.active.id) ?? null,
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingEntry(null)
    const { active, over } = event
    if (!over) return
    const targetDate = over.id as string
    const entry = (entries.data ?? []).find((e) => e.id === active.id)
    if (!entry || entry.scheduled_date === targetDate) return
    updateEntry.mutate({ id: entry.id, patch: { scheduled_date: targetDate } })
  }

  // ── Entry drawer ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen]           = useState(false)
  const [drawerMode, setDrawerMode]           = useState<'create' | 'edit'>('create')
  const [editingEntry, setEditingEntry]       = useState<CalendarEntry | null>(null)
  const [formTitle, setFormTitle]             = useState('')
  const [formBody, setFormBody]               = useState('')
  const [formDate, setFormDate]               = useState('')
  const [formPlatform, setFormPlatform]       = useState<Platform>('instagram')
  const [formContentType, setFormContentType] = useState<ContentType>('hook')
  const [formStatus, setFormStatus]           = useState<CalendarStatus>('draft')
  const [formAssigneeEmail, setFormAssigneeEmail] = useState('')
  const [formCampaignId, setFormCampaignId]   = useState<string | null>(null)
  const [formPillarId, setFormPillarId]       = useState<string | null>(null)
  const [formApprovalStatus, setFormApprovalStatus] = useState<ApprovalStatus | null>(null)

  function openCreate(date?: string) {
    setDrawerMode('create'); setEditingEntry(null)
    setFormTitle(''); setFormBody('')
    setFormDate(date ?? format(new Date(), 'yyyy-MM-dd'))
    setFormPlatform('instagram'); setFormContentType('hook'); setFormStatus('draft')
    setFormAssigneeEmail(''); setFormCampaignId(null); setFormPillarId(null); setFormApprovalStatus(null)
    setDrawerOpen(true)
  }

  function openEdit(entry: CalendarEntry) {
    setDrawerMode('edit'); setEditingEntry(entry)
    setFormTitle(entry.title); setFormBody(entry.body ?? '')
    setFormDate(entry.scheduled_date); setFormPlatform(entry.platform)
    setFormContentType(entry.content_type); setFormStatus(entry.status)
    setFormAssigneeEmail('')
    setFormCampaignId(entry.campaign_id ?? null)
    setFormPillarId(entry.pillar_id ?? null)
    setFormApprovalStatus(entry.approval_status ?? null)
    setDrawerOpen(true)
  }

  async function handleSave() {
    if (!formTitle.trim() || !formDate) {
      toast.error('Title and date are required')
      return
    }
    try {
      if (drawerMode === 'create') {
        const entry = await createEntry.mutateAsync({
          brand_id: activeBrand!.id,
          platform: formPlatform,
          content_type: formContentType,
          title: formTitle.trim(),
          body: formBody.trim() || null,
          scheduled_date: formDate,
          status: formStatus,
          generated_content_id: null,
          campaign_id: formCampaignId,
          pillar_id: formPillarId,
          approval_status: formApprovalStatus,
          approval_note: null,
        } as CalendarEntryInsert)

        if (formAssigneeEmail && entry) {
          const assigneeId = (members.data ?? []).find(
            (m) => m.email === formAssigneeEmail,
          )?.user_id ?? null
          await createTask.mutateAsync({
            brand_id: activeBrand!.id,
            title: formTitle.trim(),
            description: null,
            type: 'content',
            status: 'todo',
            priority: 'medium',
            assignee_id: assigneeId,
            assignee_email: formAssigneeEmail,
            calendar_entry_id: entry.id,
            due_date: formDate,
            created_by: null,
          })
        }

        toast.success('Entry created')
      } else {
        await updateEntry.mutateAsync({
          id: editingEntry!.id,
          patch: {
            platform: formPlatform,
            content_type: formContentType,
            title: formTitle.trim(),
            body: formBody.trim() || null,
            scheduled_date: formDate,
            status: formStatus,
            campaign_id: formCampaignId,
            pillar_id: formPillarId,
            approval_status: formApprovalStatus,
          },
        })
        toast.success('Entry saved')
      }
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to save', { description: (err as Error).message })
    }
  }

  async function handleDelete() {
    try {
      await deleteEntry.mutateAsync(editingEntry!.id)
      toast.success('Entry deleted')
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to delete', { description: (err as Error).message })
    }
  }

  // ── Pillar configure drawer ───────────────────────────────────────────────
  const [pillarDrawerOpen, setPillarDrawerOpen] = useState(false)
  const [newPillarLabel, setNewPillarLabel]     = useState('')
  const [newPillarColor, setNewPillarColor]     = useState('#6366f1')
  const [newPillarPct, setNewPillarPct]         = useState(20)

  async function handleAddPillar() {
    if (!newPillarLabel.trim() || !activeBrand) return
    try {
      await createPillar.mutateAsync({
        brand_id: activeBrand.id,
        label: newPillarLabel.trim(),
        target_pct: newPillarPct,
        color: newPillarColor,
      })
      setNewPillarLabel(''); setNewPillarPct(20); setNewPillarColor('#6366f1')
      toast.success('Pillar added')
    } catch (err) {
      toast.error('Failed to add pillar', { description: (err as Error).message })
    }
  }

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!activeBrand) {
    return (
      <div className="p-6 text-muted-foreground">
        Select a brand to view the calendar.
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Content Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{activeBrand.name}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/campaigns')}>Campaigns</Button>
        <Button size="sm" onClick={() => openCreate()}>New Entry</Button>
      </div>

      {/* Filter bar */}
      <div className="px-6 pb-3 flex items-center gap-2 flex-wrap border-b border-border shrink-0">
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
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterPlatforms.includes(p.value)
                ? `${PLATFORM_CHIP_COLORS[p.value]} border-transparent`
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        {(['all', 'draft', 'scheduled', 'published'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? s === 'all'
                  ? 'bg-foreground text-background border-transparent'
                  : `${STATUS_COLORS[s as CalendarStatus]} border-transparent`
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Pillar distribution bar */}
      {pillarDist.length > 0 && (
        <div className="px-6 py-2 border-b border-border bg-muted/20 shrink-0">
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
      <div className="px-6 py-3 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold min-w-[140px] text-center">
          {format(new Date(viewYear, viewMonth), 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
          className="ml-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
        >
          Today
        </button>
        {pillarDist.length === 0 && (
          <button
            type="button"
            onClick={() => setPillarDrawerOpen(true)}
            className="ml-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded px-2 py-0.5 transition-colors"
          >
            + Configure Pillars
          </button>
        )}
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
      <div className="grid grid-cols-7 border-b border-border px-6 shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2 text-xs font-medium text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
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
                entries={entriesForDay(day)}
                isCurrentMonth={isSameMonth(day, new Date(viewYear, viewMonth))}
                tall={viewMode === 'week'}
                onCardClick={openEdit}
                onAddClick={() => openCreate(format(day, 'yyyy-MM-dd'))}
              />
            ))}
          </div>
          <DragOverlay>
            {draggingEntry && <EntryCardOverlay entry={draggingEntry} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Entry drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>
              {drawerMode === 'create' ? 'New Entry' : 'Edit Entry'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Entry title…"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Content{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={5}
                className="resize-none"
                placeholder="Full caption, hook text, or idea…"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Scheduled date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Platform</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormPlatform(p.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      formPlatform === p.value
                        ? `${PLATFORM_CHIP_COLORS[p.value]} border-transparent`
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Content type</label>
              <div className="flex gap-1.5">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setFormContentType(ct.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      formContentType === ct.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <div className="flex gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setFormStatus(s.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      formStatus === s.value
                        ? `${STATUS_COLORS[s.value]} border-transparent`
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Campaign selector */}
            {(campaigns.data ?? []).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Campaign{' '}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <Select
                  value={formCampaignId ?? '__none__'}
                  onValueChange={(v) => setFormCampaignId(v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(campaigns.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Pillar selector */}
            {(pillars.data ?? []).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Pillar{' '}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormPillarId(null)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      !formPillarId
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    None
                  </button>
                  {(pillars.data ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormPillarId(p.id)}
                      style={
                        formPillarId === p.id
                          ? { backgroundColor: p.color, color: 'white', borderColor: p.color }
                          : {}
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        formPillarId !== p.id ? 'border-border text-muted-foreground hover:text-foreground' : ''
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Client Approval (edit mode only) */}
            {drawerMode === 'edit' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Client Approval</label>
                <div className="flex gap-1.5 flex-wrap">
                  {(
                    [null, 'pending_review', 'approved', 'rejected'] as const
                  ).map((s) => (
                    <button
                      key={s ?? '__none__'}
                      type="button"
                      onClick={() => setFormApprovalStatus(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        formApprovalStatus === s
                          ? s === 'approved'
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : s === 'rejected'
                            ? 'bg-red-500 text-white border-red-500'
                            : s === 'pending_review'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-foreground text-background border-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s === null
                        ? 'None'
                        : s === 'pending_review'
                        ? 'Pending Review'
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assign to (create mode) */}
            {drawerMode === 'create' && (members.data ?? []).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Assign to{' '}
                  <span className="text-muted-foreground font-normal">(optional — creates a task)</span>
                </label>
                <Select
                  value={formAssigneeEmail || '__none__'}
                  onValueChange={(v) => setFormAssigneeEmail(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {(members.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.email}>{m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {drawerMode === 'edit' && editingEntry?.generated_content_id && (
              <GeneratedContentPreview id={editingEntry.generated_content_id} />
            )}
          </div>

          <SheetFooter className="border-t border-border px-6 py-4 flex-row gap-2">
            {drawerMode === 'edit' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteEntry.isPending}
              >
                Delete
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrawerOpen(false)}
              className="ml-auto"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={createEntry.isPending || updateEntry.isPending}
            >
              {createEntry.isPending || updateEntry.isPending ? 'Saving…' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Pillar configure drawer */}
      <Sheet open={pillarDrawerOpen} onOpenChange={setPillarDrawerOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>Configure Pillars</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Existing pillars */}
            {(pillars.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No pillars yet. Add one below.</p>
            ) : (
              <div className="space-y-2">
                {(pillars.data ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ background: p.color }}
                    />
                    <span className="text-sm font-medium flex-1">{p.label}</span>
                    <span className="text-xs text-muted-foreground">{p.target_pct}% target</span>
                    <button
                      type="button"
                      onClick={() => deletePillar.mutate(p.id)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">Add Pillar</p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Label</label>
                <Input
                  value={newPillarLabel}
                  onChange={(e) => setNewPillarLabel(e.target.value)}
                  placeholder="e.g. Educational, Promotional"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Target % of posts</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newPillarPct}
                  onChange={(e) => setNewPillarPct(Number(e.target.value))}
                  className="h-8 text-sm w-24"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PILLAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewPillarColor(c)}
                      style={{ background: c }}
                      className={`h-6 w-6 rounded-full transition-all duration-150 ${
                        newPillarColor === c
                          ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110'
                          : 'hover:scale-110 opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleAddPillar}
                disabled={!newPillarLabel.trim() || createPillar.isPending}
              >
                {createPillar.isPending ? 'Adding…' : 'Add Pillar'}
              </Button>
            </div>
          </div>
          <SheetFooter className="border-t border-border px-6 py-4">
            <Button variant="outline" size="sm" onClick={() => setPillarDrawerOpen(false)} className="ml-auto">
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
