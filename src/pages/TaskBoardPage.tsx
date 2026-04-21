import { useState, useMemo, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  pointerWithin, rectIntersection, useDroppable, useDraggable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO, differenceInHours, isPast, startOfWeek } from 'date-fns'
import {
  Plus, AlertCircle, Circle, Loader2, Clock, CheckCircle2, Link2,
  FileText, Camera, CheckCheck, LifeBuoy, MoreHorizontal, Search, X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/formatting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { PlatformBadge } from '@/lib/platformBrand'
import { useActiveBrand } from '@/stores/activeBrand'
import { useTasks } from '@/hooks/useTasks'
import { useTeam } from '@/hooks/useTeam'
import {
  TASK_STATUS_BORDER, TASK_STATUS_CHIP,
  TASK_STATUS_COLUMN_TINT, TASK_STATUS_ACCENT, TASK_STATUS_ICON_COLOR,
  TASK_STATUS_DOT,
  TASK_TYPE_CHIP, TASK_PRIORITY_DOT, TASK_PRIORITY_CHIP, TASK_PRIORITY_LABEL,
} from '@/lib/statusTokens'
import type {
  Task, TaskStatus, TaskType, TaskPriority, TaskInsert, CalendarEntry,
} from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const COLUMNS: {
  id: TaskStatus
  label: string
  icon: typeof Circle
  empty: string
}[] = [
  { id: 'todo',        label: 'To Do',       icon: Circle,        empty: 'Nothing queued' },
  { id: 'in_progress', label: 'In Progress', icon: Loader2,       empty: 'Pick something up →' },
  { id: 'scheduled',   label: 'Scheduled',   icon: Clock,         empty: 'Drop here to schedule' },
  { id: 'done',        label: 'Done',        icon: CheckCircle2,  empty: 'Ship something 🚀' },
]

function dueMeta(due: string | null): { label: string; tone: string } | null {
  if (!due) return null
  try {
    const d = parseISO(due)
    const hours = differenceInHours(d, new Date())
    const label = format(d, 'MMM d')
    if (isPast(d) && hours < 0) return { label, tone: 'text-red-600 dark:text-red-400' }
    if (hours <= 48) return { label, tone: 'text-amber-600 dark:text-amber-400' }
    return { label, tone: 'text-muted-foreground' }
  } catch {
    return null
  }
}

function assigneeInitial(email: string): string {
  return (email.split('@')[0][0] ?? '?').toUpperCase()
}

const TASK_TYPES: { value: TaskType; label: string; icon: typeof Circle }[] = [
  { value: 'content',  label: 'Content',          icon: FileText },
  { value: 'shoot',    label: 'Photo/Video Shoot', icon: Camera },
  { value: 'approval', label: 'Approval',         icon: CheckCheck },
  { value: 'backup',   label: 'Backup Plan',      icon: LifeBuoy },
  { value: 'other',    label: 'Other',            icon: MoreHorizontal },
]

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaskChip({
  task,
  linkedEntry,
}: {
  task: Task
  linkedEntry?: CalendarEntry
}) {
  const due = dueMeta(task.due_date)
  const handle = task.assignee_email ? task.assignee_email.split('@')[0] : null
  const isDone = task.status === 'done'
  const isOverdue = due?.tone.includes('red')
  const isDueSoon = due?.tone.includes('amber') && !isDone
  const isHighPriority = task.priority === 'high' && !isDone

  const urgencyTint = isOverdue
    ? 'bg-red-500/[0.04]'
    : isDueSoon
    ? 'bg-amber-500/[0.04]'
    : 'bg-card'

  return (
    <div
      className={`rounded border border-border border-l-4 ${TASK_STATUS_BORDER[task.status]} ${urgencyTint} px-2 py-1.5 space-y-1.5 transition-all hover:border-border/80 hover:shadow-sm ${
        isDone ? 'opacity-75' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-xs text-foreground leading-snug line-clamp-2 flex-1 flex items-center gap-1">
          {linkedEntry && (
            <Link2
              className="h-3 w-3 shrink-0 text-muted-foreground/70"
              aria-label="Linked to calendar entry"
            />
          )}
          {task.title}
        </span>
        <span
          aria-label={TASK_PRIORITY_LABEL[task.priority]}
          title={TASK_PRIORITY_LABEL[task.priority]}
          className={`h-2 w-2 rounded-full mt-0.5 shrink-0 ${TASK_PRIORITY_DOT[task.priority]} ${
            isHighPriority ? 'animate-pulse' : ''
          }`}
        />
      </div>
      <div className="flex items-center gap-1.5">
        {linkedEntry ? (
          <PlatformBadge platform={linkedEntry.platform} size="xs" />
        ) : (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TASK_TYPE_CHIP[task.type]}`}>
            {task.type}
          </span>
        )}
        {due && (
          <span className={`text-[10.5px] font-mono tabular-nums ${due.tone}`}>
            {due.label}
          </span>
        )}
        {handle && (
          <span className="ml-auto flex items-center gap-1 min-w-0" title={task.assignee_email ?? ''}>
            <span className="h-4 w-4 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-semibold">
              {assigneeInitial(task.assignee_email!)}
            </span>
            <span className="text-[10.5px] text-muted-foreground truncate">{handle}</span>
          </span>
        )}
      </div>
    </div>
  )
}

function DraggableTask({
  task,
  linkedEntry,
  onClick,
}: {
  task: Task
  linkedEntry?: CalendarEntry
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="cursor-pointer"
    >
      <TaskChip task={task} linkedEntry={linkedEntry} />
    </div>
  )
}

function QuickAddTask({
  onAdd,
  disabled,
}: {
  onAdd: (title: string) => void
  disabled?: boolean
}) {
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-1.5 rounded border border-dashed border-border bg-background/40 px-1.5 py-1 focus-within:border-primary/60 focus-within:bg-background transition-colors">
      <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            onAdd(title.trim())
            setTitle('')
            inputRef.current?.blur()
          } else if (e.key === 'Escape') {
            setTitle('')
            inputRef.current?.blur()
          }
        }}
        placeholder="Add task…"
        disabled={disabled}
        className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none py-0.5 disabled:opacity-50"
      />
    </div>
  )
}

function TaskColumn({
  column,
  tasks,
  entryById,
  onCardClick,
  onAddClick,
  onQuickAdd,
  isSpecialist,
}: {
  column: { id: TaskStatus; label: string; icon: typeof Circle; empty: string }
  tasks: Task[]
  entryById: Map<string, CalendarEntry>
  onCardClick: (t: Task) => void
  onAddClick: () => void
  onQuickAdd: (title: string) => void
  isSpecialist: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id })
  const Icon = column.icon
  const isEmpty = tasks.length === 0
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 min-h-[200px] p-3 rounded-xl border border-border border-t-2 ${TASK_STATUS_ACCENT[column.id]} transition-colors ${
        isOver
          ? 'bg-primary/5 border-primary/30'
          : TASK_STATUS_COLUMN_TINT[column.id]
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5">
          <Icon
            className={`h-3.5 w-3.5 ${TASK_STATUS_ICON_COLOR[column.id]} ${
              column.id === 'in_progress' ? 'animate-spin [animation-duration:4s]' : ''
            }`}
          />
          <span className="text-sm font-semibold text-foreground">{column.label}</span>
        </span>
        <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-medium tabular-nums ${TASK_STATUS_CHIP[column.id]}`}>
          {tasks.length}
        </span>
      </div>
      {!isSpecialist && <QuickAddTask onAdd={onQuickAdd} />}
      {tasks.map((task) => (
        <DraggableTask
          key={task.id}
          task={task}
          linkedEntry={task.calendar_entry_id ? entryById.get(task.calendar_entry_id) : undefined}
          onClick={() => onCardClick(task)}
        />
      ))}
      {isEmpty && (
        <div className="rounded border border-dashed border-border/60 px-2 py-3 text-[11px] text-muted-foreground/70 text-center leading-snug">
          {column.empty}
        </div>
      )}
      {!isSpecialist && (
        <button
          type="button"
          onClick={onAddClick}
          className="mt-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground py-1 px-1 rounded hover:bg-accent transition-colors"
        >
          <Plus className="h-3 w-3" />
          With details…
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TaskBoardPageProps {
  isSpecialist?: boolean
}

export default function TaskBoardPage({ isSpecialist = false }: TaskBoardPageProps) {
  const { activeBrand } = useActiveBrand()

  // Both owner & specialist operate on the active brand's tasks.
  // RLS (migration 019) scopes specialists to brands they're team_members of.
  const { tasks: rawTasks, createTask, updateTask, deleteTask } = useTasks(activeBrand?.id ?? null)

  const { members } = useTeam(activeBrand?.id ?? null)

  // Filters (owner only)
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Drag
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const collisionMissLogged = useRef(false)

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo')

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formType, setFormType] = useState<TaskType>('content')
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium')
  const [formDue, setFormDue] = useState('')
  const [formAssigneeEmail, setFormAssigneeEmail] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const allTasks = rawTasks.data ?? []

  // Fetch the calendar entries linked to these tasks so the card can show
  // platform badges. Scoped by ID list so it's a single cheap query regardless
  // of how far back the Done column stretches.
  const linkedEntryIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of allTasks) if (t.calendar_entry_id) ids.add(t.calendar_entry_id)
    return Array.from(ids).sort()
  }, [allTasks])

  const linkedEntries = useQuery({
    queryKey: ['task-linked-calendar', activeBrand?.id, linkedEntryIds],
    queryFn: async () => {
      if (linkedEntryIds.length === 0) return [] as CalendarEntry[]
      const { data, error } = await supabase
        .from('calendar_entries')
        .select('*')
        .in('id', linkedEntryIds)
      if (error) throw error
      return (data ?? []) as CalendarEntry[]
    },
    enabled: !!activeBrand && linkedEntryIds.length > 0,
    staleTime: 60_000,
  })

  const entryById = useMemo(() => {
    const map = new Map<string, CalendarEntry>()
    for (const e of linkedEntries.data ?? []) map.set(e.id, e)
    return map
  }, [linkedEntries.data])

  const filteredTasks = useMemo(() => {
    let result = allTasks
    if (filterAssignee !== 'all') result = result.filter((t) => t.assignee_email === filterAssignee)
    if (filterType !== 'all') result = result.filter((t) => t.type === filterType)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q),
      )
    }
    return result
  }, [allTasks, filterAssignee, filterType, searchQuery])

  function tasksForColumn(status: TaskStatus) {
    return filteredTasks.filter((t) => t.status === status)
  }

  // Stats for the ribbon — counts per column + "shipped this week".
  const statusCounts = useMemo(() => {
    const counts: Record<TaskStatus, number> = { todo: 0, in_progress: 0, scheduled: 0, done: 0 }
    for (const t of filteredTasks) counts[t.status]++
    return counts
  }, [filteredTasks])

  const shippedThisWeek = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    return filteredTasks.filter((t) => {
      if (t.status !== 'done') return false
      const ref = t.due_date ?? null
      if (!ref) return false
      try {
        return parseISO(ref) >= weekStart
      } catch {
        return false
      }
    }).length
  }, [filteredTasks])

  function openCreate(status: TaskStatus = 'todo') {
    setDrawerMode('create')
    setEditingTask(null)
    setDefaultStatus(status)
    setFormTitle('')
    setFormDesc('')
    setFormType('content')
    setFormPriority('medium')
    setFormDue('')
    setFormAssigneeEmail('')
    setDrawerOpen(true)
  }

  function openEdit(task: Task) {
    setDrawerMode('edit')
    setEditingTask(task)
    setDefaultStatus(task.status)
    setFormTitle(task.title)
    setFormDesc(task.description ?? '')
    setFormType(task.type)
    setFormPriority(task.priority)
    setFormDue(task.due_date ?? '')
    setFormAssigneeEmail(task.assignee_email ?? '')
    setDrawerOpen(true)
  }

  async function handleSave() {
    if (!formTitle.trim()) { toast.error('Title is required'); return }
    try {
      const assigneeId = formAssigneeEmail
        ? (members.data ?? []).find((m) => m.email === formAssigneeEmail)?.user_id ?? null
        : null

      if (drawerMode === 'create') {
        const payload: TaskInsert = {
          brand_id: activeBrand!.id,
          title: formTitle.trim(),
          description: formDesc.trim() || null,
          type: formType,
          status: defaultStatus,
          priority: formPriority,
          assignee_id: assigneeId,
          assignee_email: formAssigneeEmail || null,
          calendar_entry_id: null,
          due_date: formDue || null,
          created_by: null,
        }
        await createTask.mutateAsync(payload)
        toast.success('Task created')
      } else {
        await updateTask.mutateAsync({
          id: editingTask!.id,
          patch: {
            title: formTitle.trim(),
            description: formDesc.trim() || null,
            type: formType,
            status: defaultStatus,
            priority: formPriority,
            assignee_id: assigneeId,
            assignee_email: formAssigneeEmail || null,
            due_date: formDue || null,
          },
        })
        toast.success('Task saved')
      }
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to save task', { description: errorMessage(err) })
    }
  }

  async function handleQuickAdd(status: TaskStatus, title: string) {
    if (!activeBrand) return
    try {
      await createTask.mutateAsync({
        brand_id: activeBrand.id,
        title,
        description: null,
        type: 'content',
        status,
        priority: 'medium',
        assignee_id: null,
        assignee_email: null,
        calendar_entry_id: null,
        due_date: null,
        created_by: null,
      })
      toast.success('Task added')
    } catch (err) {
      toast.error('Failed to add task', { description: errorMessage(err) })
    }
  }

  async function handleDelete() {
    try {
      await deleteTask.mutateAsync(editingTask!.id)
      toast.success('Task deleted')
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to delete', { description: errorMessage(err) })
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingTask(allTasks.find((t) => t.id === event.active.id) ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingTask(null)
    const { active, over } = event
    if (!over) return
    const targetStatus = over.id as TaskStatus
    const task = allTasks.find((t) => t.id === active.id)
    if (!task || task.status === targetStatus) return
    const targetLabel = COLUMNS.find((c) => c.id === targetStatus)?.label ?? targetStatus
    try {
      await updateTask.mutateAsync({ id: task.id, patch: { status: targetStatus } })
      toast.success(`Moved to ${targetLabel}`)
    } catch (err) {
      toast.error('Move failed', { description: errorMessage(err) })
    }
  }

  if (!activeBrand) return <NoBrandSelected />

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="eyebrow mb-1.5">Collaborate</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>Tasks</h1>
          {activeBrand && (
            <p className="text-[13px] text-muted-foreground mt-1">{activeBrand.name}</p>
          )}
        </div>
        {!isSpecialist && (
          <Button size="sm" onClick={() => openCreate()}>
            New Task
          </Button>
        )}
      </div>

      {/* Stats ribbon — at-a-glance counts per column + shipped-this-week */}
      <div className="px-6 pb-3 flex items-center gap-4 flex-wrap text-xs text-muted-foreground shrink-0">
        {COLUMNS.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${TASK_STATUS_DOT[c.id]}`} />
            <span className="tabular-nums font-medium text-foreground">{statusCounts[c.id]}</span>
            <span>{c.label}</span>
          </span>
        ))}
        <span className="ml-auto text-[11px]">
          Shipped this week:{' '}
          <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
            {shippedThisWeek}
          </span>
        </span>
      </div>

      {/* Filter bar — owner only */}
      {!isSpecialist && (
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap border-b border-border shrink-0">
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[100px] max-w-[160px]">
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {(members.data ?? []).map((m) => (
                <SelectItem key={m.id} value={m.email}>{m.email.split('@')[0]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[90px] max-w-[140px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TASK_TYPES.map((tt) => (
                <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="h-7 text-xs pl-7 pr-7"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        <DndContext
          sensors={sensors}
          // pointerWithin: drop target = whichever column the pointer is inside.
          // Fall back to rectIntersection so a card whose cursor sits in the
          // inter-column gap still resolves to the nearest overlapping column
          // (otherwise the drop is a no-op). Avoid closestCenter — a long Done
          // column shifts its "center" far from the drop point and hijacks all
          // drops to whichever column has the topmost center.
          collisionDetection={(args) => {
            const within = pointerWithin(args)
            if (within.length > 0) return within
            const rect = rectIntersection(args)
            if (rect.length === 0 && !collisionMissLogged.current) {
              collisionMissLogged.current = true
              console.warn('[TaskBoard] collisionDetection returned no targets — drops will no-op')
            }
            return rect
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-1 relative">
            {/* Dotted-grid backdrop — holds the board together when columns are
                empty; disappears behind dense content. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 text-foreground/40 dark:text-foreground/30"
              style={{
                backgroundImage:
                  'radial-gradient(circle, currentColor 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                opacity: 0.08,
              }}
            />
            <div className="relative flex gap-4">
              {COLUMNS.map((col) => (
                <div key={col.id} className="w-[280px] shrink-0">
                  <TaskColumn
                    column={col}
                    tasks={tasksForColumn(col.id)}
                    entryById={entryById}
                    onCardClick={openEdit}
                    onAddClick={() => openCreate(col.id)}
                    onQuickAdd={(title) => handleQuickAdd(col.id, title)}
                    isSpecialist={isSpecialist}
                  />
                </div>
              ))}
            </div>
          </div>
          <DragOverlay>
            {draggingTask && (
              <div className="shadow-lg rounded border border-border bg-card px-2 py-1.5">
                <TaskChip
                  task={draggingTask}
                  linkedEntry={
                    draggingTask.calendar_entry_id
                      ? entryById.get(draggingTask.calendar_entry_id)
                      : undefined
                  }
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {rawTasks.isLoading && (
          <p className="text-sm text-muted-foreground mt-4">Loading tasks...</p>
        )}
        {!rawTasks.isLoading && rawTasks.isError && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Couldn't load tasks. {errorMessage(rawTasks.error, 'Unknown error.')}
            </p>
            <Button size="sm" variant="outline" onClick={() => rawTasks.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!rawTasks.isLoading && !rawTasks.isError && allTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {isSpecialist ? 'No tasks assigned to you yet.' : 'No tasks yet. Create your first task.'}
            </p>
          </div>
        )}
      </div>

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 p-0 sm:max-w-md"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isSpecialist && formTitle.trim()) {
              e.preventDefault()
              handleSave()
            }
          }}
        >
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>{drawerMode === 'create' ? 'New Task' : 'Edit Task'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Task title…"
                disabled={isSpecialist}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="Additional details…"
                disabled={isSpecialist}
              />
            </div>
            {!isSpecialist && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLUMNS.map((col) => {
                    const Icon = col.icon
                    const active = defaultStatus === col.id
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setDefaultStatus(col.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          active
                            ? `${TASK_STATUS_CHIP[col.id]} border-transparent`
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {col.label}
                      </button>
                    )
                  })}
                </div>
                {defaultStatus === 'scheduled' && (
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Scheduled tasks don't appear on the calendar.{' '}
                    <Link
                      to="/calendar"
                      className="underline underline-offset-2 hover:text-foreground"
                      onClick={() => setDrawerOpen(false)}
                    >
                      Add a calendar entry →
                    </Link>
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {TASK_TYPES.map((tt) => {
                  const Icon = tt.icon
                  const active = formType === tt.value
                  return (
                    <button
                      key={tt.value}
                      type="button"
                      disabled={isSpecialist}
                      onClick={() => setFormType(tt.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? `${TASK_TYPE_CHIP[tt.value]} border-transparent`
                          : 'border-border text-muted-foreground'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Icon className="h-3 w-3" />
                      {tt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Priority</label>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    disabled={isSpecialist}
                    onClick={() => setFormPriority(p.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      formPriority === p.value
                        ? `${TASK_PRIORITY_CHIP[p.value]} border-transparent`
                        : 'border-border text-muted-foreground'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Due date</label>
              <Input
                type="date"
                value={formDue}
                onChange={(e) => setFormDue(e.target.value)}
                disabled={isSpecialist}
              />
            </div>
            {!isSpecialist && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Assign to <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Select value={formAssigneeEmail || '__none__'} onValueChange={(v) => setFormAssigneeEmail(v === '__none__' ? '' : v)}>
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
            {/* Linked calendar entry — read-only context for specialists */}
            {isSpecialist && drawerMode === 'edit' && editingTask?.calendar_entry_id && (() => {
              const linked = entryById.get(editingTask.calendar_entry_id)
              if (linked) {
                return (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
                    <PlatformBadge platform={linked.platform} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-muted-foreground leading-tight">Linked calendar entry</p>
                      <p className="text-xs text-foreground truncate">
                        {format(parseISO(linked.scheduled_date), 'MMM d')} · {linked.platform}
                      </p>
                    </div>
                    <Link
                      to="/calendar"
                      onClick={() => setDrawerOpen(false)}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
                    >
                      View →
                    </Link>
                  </div>
                )
              }
              if (linkedEntries.isLoading) {
                return (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
                      <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                )
              }
              return (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground leading-tight">Linked calendar entry</p>
                  <p className="text-xs text-muted-foreground">This entry is no longer available.</p>
                </div>
              )
            })()}
            {/* Show status selector for specialist (they can change status) */}
            {isSpecialist && drawerMode === 'edit' && editingTask && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <div className="flex gap-1.5">
                  {COLUMNS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={async () => {
                        if (editingTask.status === col.id) return
                        try {
                          await updateTask.mutateAsync({ id: editingTask.id, patch: { status: col.id } })
                          toast.success(`Status: ${col.label}`)
                        } catch (err) {
                          toast.error('Update failed', { description: errorMessage(err) })
                        }
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        editingTask.status === col.id
                          ? `${TASK_STATUS_CHIP[col.id]} border-transparent`
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <SheetFooter className="border-t border-border px-6 py-4 flex-row gap-2">
            {!isSpecialist && drawerMode === 'edit' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteTask.isPending}
              >
                Delete
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)} className="ml-auto">
              {isSpecialist ? 'Close' : 'Cancel'}
            </Button>
            {!isSpecialist && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!formTitle.trim() || createTask.isPending || updateTask.isPending}
              >
                {createTask.isPending || updateTask.isPending ? 'Saving…' : 'Save'}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
