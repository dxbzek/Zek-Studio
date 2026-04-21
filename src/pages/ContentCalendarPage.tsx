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
import { ChevronLeft, ChevronRight, Trash2, Copy, Search, X } from 'lucide-react'
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
import { useCalendar, useGeneratedContent } from '@/hooks/useCalendar'
import { useTeam } from '@/hooks/useTeam'
import { useTasks } from '@/hooks/useTasks'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useContentPillars } from '@/hooks/useContentPillars'
import { PLATFORMS, CONTENT_THEMES } from '@/types'
import { PlatformBadge, PlatformPill, PLATFORM_BRAND } from '@/lib/platformBrand'
import type {
  CalendarEntry,
  CalendarEntryInsert,
  CalendarStatus,
  Platform,
  ContentType,
  ContentTheme,
  ApprovalStatus,
  ContentPillar,
} from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const CONTENT_TYPES = CONTENT_THEMES

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

const AGENTS = ['Edna', 'Nikhil', 'Imran', 'Khuram', 'Ibrahim', 'Elliot', 'Keeley']

function emailHandle(email: string) {
  return email.split('@')[0]
}

// ─── Entry grouping ───────────────────────────────────────────────────────────

type EntryGroup = {
  id: string               // representative entry id (used as DnD id)
  representative: CalendarEntry
  entries: CalendarEntry[]
  platforms: Platform[]
}

function groupEntries(entries: CalendarEntry[]): EntryGroup[] {
  const map = new Map<string, CalendarEntry[]>()
  for (const e of entries) {
    const key = `${e.title.toLowerCase().trim()}__${e.scheduled_date}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.values()).map((grp) => ({
    id: grp[0].id,
    representative: grp[0],
    entries: grp,
    platforms: grp.map((e) => e.platform),
  }))
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const MAX_PLATFORM_BADGES = 3

function PlatformStack({ platforms }: { platforms: Platform[] }) {
  const visible = platforms.slice(0, MAX_PLATFORM_BADGES)
  const overflow = platforms.length - visible.length
  return (
    <div className="flex items-center">
      {visible.map((p, i) => (
        <div key={p} className={i > 0 ? '-ml-1 ring-1 ring-card rounded-sm' : ''}>
          <PlatformBadge platform={p} size="xs" />
        </div>
      ))}
      {overflow > 0 && (
        <span className="ml-1 font-mono text-[9px] font-medium text-muted-foreground tabular-nums">
          +{overflow}
        </span>
      )}
    </div>
  )
}

function EntryCard({ group, onClick }: { group: EntryGroup; onClick: () => void }) {
  const { representative: rep } = group
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: group.id })

  const approvalDot =
    rep.approval_status === 'pending_review' ? 'bg-amber-400'
    : rep.approval_status === 'approved'     ? 'bg-emerald-500'
    : rep.approval_status === 'rejected'     ? 'bg-red-500'
    : null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`cursor-pointer rounded border border-border border-l-4 ${STATUS_BORDER_COLORS[rep.status]} bg-card px-1.5 py-1 text-xs hover:bg-accent transition-colors select-none`}
    >
      <div className="flex items-center gap-1.5">
        <PlatformStack platforms={group.platforms} />
        <span className="ml-auto flex items-center gap-1 shrink-0">
          {rep.assigned_talent && <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />}
          {approvalDot && <span className={`h-1.5 w-1.5 rounded-full ${approvalDot}`} />}
        </span>
      </div>
      <span className="block text-foreground line-clamp-1 mt-0.5 text-[11px] sm:text-xs leading-tight">{rep.title}</span>
    </div>
  )
}

function EntryCardOverlay({ group }: { group: EntryGroup }) {
  const { representative: rep } = group
  return (
    <div className={`rounded border border-border border-l-4 ${STATUS_BORDER_COLORS[rep.status]} bg-card px-1.5 py-1 text-xs shadow-lg`}>
      <PlatformStack platforms={group.platforms} />
      <span className="block text-foreground line-clamp-1 mt-0.5 text-[11px] sm:text-xs leading-tight">{rep.title}</span>
    </div>
  )
}

function DayCell({
  day,
  groups,
  isCurrentMonth,
  tall,
  onGroupClick,
  onAddClick,
}: {
  day: Date
  groups: EntryGroup[]
  isCurrentMonth: boolean
  tall?: boolean
  onGroupClick: (group: EntryGroup) => void
  onAddClick: () => void
}) {
  const dateStr = format(day, 'yyyy-MM-dd')
  const { isOver, setNodeRef } = useDroppable({ id: dateStr })
  const todayFlag = isSameDay(day, new Date())
  const MAX_VISIBLE = 3

  return (
    <div
      ref={setNodeRef}
      onClick={() => { if (isCurrentMonth) onAddClick() }}
      className={`group border-b border-r border-border p-1 sm:p-1.5 flex flex-col gap-1 transition-colors ${tall ? 'min-h-[180px] sm:min-h-[200px]' : 'min-h-[80px] sm:min-h-[110px]'} ${!isCurrentMonth ? 'bg-muted/20' : 'cursor-pointer hover:bg-accent/30'} ${isOver ? 'bg-primary/5' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`font-mono text-[11px] sm:text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full tabular-nums ${todayFlag ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {format(day, 'd')}
        </span>
        {isCurrentMonth && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddClick() }}
            className="sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground text-sm leading-none h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-opacity"
            aria-label="Add entry"
          >
            +
          </button>
        )}
      </div>
      {groups.slice(0, MAX_VISIBLE).map((grp) => (
        <EntryCard key={grp.id} group={grp} onClick={() => onGroupClick(grp)} />
      ))}
      {groups.length > MAX_VISIBLE && (
        <span
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-muted-foreground px-1 font-mono tabular-nums"
        >
          +{groups.length - MAX_VISIBLE} more
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
        <span className={`text-[11px] px-1.5 py-0.5 rounded ${PLATFORM_BRAND[data.platform as Platform].chip}`}>
          {data.platform}
        </span>
      </div>
    </div>
  )
}

// ─── Role picker helper ───────────────────────────────────────────────────────

function RolePicker({
  label,
  value,
  onChange,
  members,
  dotColor,
  showAgents = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  members: { id: string; email: string }[]
  dotColor: string
  showAgents?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <label className="text-xs text-muted-foreground">{label}</label>
      </div>
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Unassigned</SelectItem>
          {showAgents && AGENTS.map((name) => (
            <SelectItem key={name} value={name}>{name}</SelectItem>
          ))}
          {members.filter((m) => !AGENTS.includes(m.email)).map((m) => (
            <SelectItem key={m.id} value={m.email}>
              {emailHandle(m.email)}
              <span className="text-muted-foreground ml-1 text-xs">({m.email})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  const { tasks, createTask, updateTask } = useTasks(activeBrand?.id ?? null)
  const { campaigns } = useCampaigns(activeBrand?.id ?? null)
  const { pillars, createPillar, deletePillar } = useContentPillars(activeBrand?.id ?? null)

  const teamMembers = members.data ?? []

  // ── Filters ───────────────────────────────────────────────────────────────
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
  const [draggingGroup, setDraggingGroup] = useState<EntryGroup | null>(null)

  function handleDragStart(event: DragStartEvent) {
    setDraggingGroup(allGroups.find((g) => g.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
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
  }

  // ── Entry drawer ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen]           = useState(false)
  const [drawerMode, setDrawerMode]           = useState<'create' | 'edit'>('create')
  const [editingGroup, setEditingGroup]       = useState<EntryGroup | null>(null)
  const [formTitle, setFormTitle]             = useState('')
  const [formBody, setFormBody]               = useState('')
  const [formDate, setFormDate]               = useState('')
  const [formPlatforms, setFormPlatforms]     = useState<Platform[]>(['instagram'])
  const [formContentType, setFormContentType] = useState<ContentTheme>('property_tour')
  const [formStatus, setFormStatus]           = useState<CalendarStatus>('draft')
  const [formCampaignId, setFormCampaignId]   = useState<string | null>(null)
  const [formPillarId, setFormPillarId]       = useState<string | null>(null)
  const [formApprovalStatus, setFormApprovalStatus] = useState<ApprovalStatus | null>(null)
  const [formApprovalNote, setFormApprovalNote]     = useState('')
  // Assigned specialist
  const [formTalent, setFormTalent]     = useState('')
  const [formCharacter, setFormCharacter] = useState<string>('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  function resetForm() {
    setFormTitle(''); setFormBody('')
    setFormDate(format(new Date(), 'yyyy-MM-dd'))
    setFormPlatforms(['instagram']); setFormContentType('property_tour'); setFormStatus('draft')
    setFormCampaignId(null); setFormPillarId(null); setFormApprovalStatus(null); setFormApprovalNote('')
    setFormTalent(''); setFormCharacter('')
  }

  function openCreate(date?: string) {
    setDrawerMode('create'); setEditingGroup(null)
    resetForm()
    if (date) setFormDate(date)
    setDrawerOpen(true)
  }

  function openEdit(group: EntryGroup) {
    const rep = group.representative
    setDrawerMode('edit'); setEditingGroup(group)
    setFormTitle(rep.title); setFormBody(rep.body ?? '')
    setFormDate(rep.scheduled_date); setFormPlatforms(group.platforms)
    setFormContentType((rep.content_type as ContentTheme) ?? 'property_tour'); setFormStatus(rep.status)
    setFormCampaignId(rep.campaign_id ?? null)
    setFormPillarId(rep.pillar_id ?? null)
    setFormApprovalStatus(rep.approval_status ?? null)
    setFormApprovalNote(rep.approval_note ?? '')
    setFormTalent(rep.assigned_talent ?? '')
    setFormCharacter(rep.character ?? '')
    setDrawerOpen(true)
  }

  function buildCommonPayload() {
    return {
      content_type: formContentType as ContentType,
      title: formTitle.trim(),
      body: formBody.trim() || null,
      scheduled_date: formDate,
      status: formStatus,
      campaign_id: formCampaignId,
      pillar_id: formPillarId,
      approval_status: formApprovalStatus,
      approval_note: formApprovalNote.trim() || null,
      assigned_editor: null,
      assigned_shooter: null,
      assigned_talent: formTalent || null,
      character: formCharacter || null,
    }
  }

  async function handleSave() {
    if (!formTitle.trim() || !formDate) {
      toast.error('Title and date are required')
      return
    }
    try {
      // Resolve assignee — formTalent may be an agent name or a team-member email
      const specialist = formTalent || ''
      const specialistId = specialist
        ? teamMembers.find((m) => m.email === specialist)?.user_id ?? null
        : null

      if (drawerMode === 'create') {
        const platforms = formPlatforms.length > 0 ? formPlatforms : ['instagram' as Platform]
        let firstEntry: CalendarEntry | null = null

        for (const plat of platforms) {
          const entry = await createEntry.mutateAsync({
            brand_id: activeBrand!.id,
            ...buildCommonPayload(),
            platform: plat,
            generated_content_id: null,
          } as CalendarEntryInsert)
          if (!firstEntry) firstEntry = entry
        }

        // Every calendar entry gets a linked task — assignee optional
        if (firstEntry) {
          const taskStatus: 'todo' | 'in_progress' | 'done' =
            formStatus === 'published' ? 'done'
            : formStatus === 'scheduled' ? 'in_progress'
            : 'todo'
          await createTask.mutateAsync({
            brand_id: activeBrand!.id,
            title: formTitle.trim(),
            description: null,
            type: 'content',
            status: taskStatus,
            priority: 'medium',
            assignee_id: specialistId,
            assignee_email: specialist || null,
            calendar_entry_id: firstEntry.id,
            due_date: formDate,
            created_by: null,
          })
        }

        toast.success(platforms.length > 1 ? `${platforms.length} entries created` : 'Entry created')
      } else {
        const group = editingGroup!
        const currentPlatforms = group.platforms
        const toUpdate = formPlatforms.filter((p) => currentPlatforms.includes(p))
        const toAdd    = formPlatforms.filter((p) => !currentPlatforms.includes(p))
        const toRemove = currentPlatforms.filter((p) => !formPlatforms.includes(p))

        for (const plat of toUpdate) {
          const e = group.entries.find((e) => e.platform === plat)
          if (e) await updateEntry.mutateAsync({ id: e.id, patch: buildCommonPayload() })
        }
        for (const plat of toAdd) {
          await createEntry.mutateAsync({
            brand_id: activeBrand!.id,
            ...buildCommonPayload(),
            platform: plat,
            generated_content_id: group.representative.generated_content_id,
          } as CalendarEntryInsert)
        }
        for (const plat of toRemove) {
          const e = group.entries.find((e) => e.platform === plat)
          if (e) await deleteEntry.mutateAsync(e.id)
        }

        const repId = group.representative.id
        const existingTask = (tasks.data ?? []).find((t) => t.calendar_entry_id === repId)
        if (specialist) {
          if (existingTask) {
            await updateTask.mutateAsync({
              id: existingTask.id,
              patch: { assignee_id: specialistId, assignee_email: specialist, due_date: formDate },
            })
          } else {
            await createTask.mutateAsync({
              brand_id: activeBrand!.id,
              title: formTitle.trim(),
              description: null,
              type: 'content',
              status: 'todo',
              priority: 'medium',
              assignee_id: specialistId,
              assignee_email: specialist,
              calendar_entry_id: repId,
              due_date: formDate,
              created_by: null,
            })
          }
        } else if (existingTask) {
          await updateTask.mutateAsync({
            id: existingTask.id,
            patch: { assignee_id: null, assignee_email: null },
          })
        }

        toast.success('Entry saved')
      }
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to save', { description: (err as Error).message })
    }
  }

  async function handleDelete() {
    try {
      await Promise.all(editingGroup!.entries.map((e) => deleteEntry.mutateAsync(e.id)))
      toast.success('Entry deleted')
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to delete', { description: (err as Error).message })
    }
  }

  async function confirmAndDelete() {
    setConfirmDeleteOpen(false)
    await handleDelete()
  }

  async function handleDuplicate() {
    if (!editingGroup || !activeBrand) return
    try {
      for (const e of editingGroup.entries) {
        await createEntry.mutateAsync({
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
      }
      toast.success('Entry duplicated')
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to duplicate', { description: (err as Error).message })
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
  if (!activeBrand) return <NoBrandSelected />

  const saving = createEntry.isPending || updateEntry.isPending

  // ── Render ────────────────────────────────────────────────────────────────
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
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/campaigns')}>Campaigns</Button>
          <Button size="sm" onClick={() => openCreate()}>New</Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 sm:px-6 pb-3 flex items-center gap-2 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-x-visible border-b border-border shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
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
        <div className="w-px h-4 bg-border mx-1 shrink-0" />
        {(['all', 'draft', 'scheduled', 'published'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? s === 'all'
                  ? 'bg-foreground text-background border-transparent'
                  : `${STATUS_COLORS[s as CalendarStatus]} border-transparent`
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
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-heading text-[15px] sm:text-base font-medium tracking-tight min-w-[110px] sm:min-w-[140px] text-center">
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

      {/* Entry drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>
              {drawerMode === 'create' ? 'New Entry' : 'Edit Entry'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Entry title…"
              />
            </div>

            {/* Caption / Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Caption / Notes{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={5}
                className="resize-none"
                placeholder="Full caption, hook text, script notes…"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Scheduled date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Platform
                {drawerMode === 'create' && (
                  <span className="text-muted-foreground font-normal text-xs ml-1">(select one or more)</span>
                )}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setFormPlatforms((prev) =>
                        prev.includes(p.value)
                          ? prev.length > 1 ? prev.filter((x) => x !== p.value) : prev
                          : [...prev, p.value],
                      )
                    }}
                    className="rounded-full hover:opacity-90 transition-opacity"
                  >
                    <PlatformPill platform={p.value} label={p.label} active={formPlatforms.includes(p.value)} />
                  </button>
                ))}
              </div>
            </div>

            {/* Content type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Content type</label>
              <div className="flex flex-wrap gap-1.5">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    title={ct.desc}
                    onClick={() => setFormContentType(ct.value as ContentTheme)}
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

            {/* Status */}
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

            {/* Client Approval */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Client Approval{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
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
              {formApprovalStatus && (
                <Textarea
                  value={formApprovalNote}
                  onChange={(e) => setFormApprovalNote(e.target.value)}
                  placeholder={
                    formApprovalStatus === 'rejected'
                      ? 'Reason for rejection…'
                      : formApprovalStatus === 'approved'
                      ? 'Approval note (optional)…'
                      : 'Note for reviewer (optional)…'
                  }
                  rows={2}
                  className="resize-none text-sm"
                />
              )}
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

            {/* Assigned Specialist */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Assigned Specialist{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
              <RolePicker
                label=""
                value={formTalent}
                onChange={setFormTalent}
                members={teamMembers}
                dotColor="bg-violet-400"
                showAgents
              />
            </div>

            {drawerMode === 'edit' && editingGroup?.representative.generated_content_id && (
              <GeneratedContentPreview id={editingGroup.representative.generated_content_id} />
            )}
          </div>

          <SheetFooter className="border-t border-border px-6 py-4 flex-row gap-2">
            {drawerMode === 'edit' && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleteEntry.isPending}
                >
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicate}
                  disabled={createEntry.isPending}
                  title="Duplicate this entry as a draft"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Duplicate
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrawerOpen(false)}
              className="ml-auto"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
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
                      onClick={() =>
                        deletePillar.mutate(p.id, {
                          onSuccess: () => toast.success('Pillar deleted'),
                          onError: (err) => toast.error('Failed to delete pillar', { description: (err as Error).message }),
                        })
                      }
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
