import { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors,
  pointerWithin, rectIntersection,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { parseISO, startOfWeek } from 'date-fns'
import { AlertCircle, Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/formatting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { useActiveBrand } from '@/stores/activeBrand'
import { useTasks } from '@/hooks/useTasks'
import { useTeam } from '@/hooks/useTeam'
import {
  TASK_STATUS_DOT,
} from '@/lib/statusTokens'
import type { CalendarEntry, Task, TaskPriority, TaskStatus } from '@/types'
import { COLUMNS, TASK_TYPES } from '@/components/tasks/taskConstants'
import { TaskChip } from '@/components/tasks/TaskChip'
import { TaskColumn } from '@/components/tasks/TaskColumn'
import { TaskDrawer } from '@/components/tasks/TaskDrawer'

interface TaskBoardPageProps {
  isSpecialist?: boolean
}

export default function TaskBoardPage({ isSpecialist = false }: TaskBoardPageProps) {
  const { activeBrand } = useActiveBrand()

  // Both owner & specialist operate on the active brand's tasks.
  // RLS (migration 019) scopes specialists to brands they're team_members of.
  const { tasks: rawTasks, createTask, updateTask, deleteTask } = useTasks(activeBrand?.id ?? null)
  const { members } = useTeam(activeBrand?.id ?? null)

  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<'created_asc' | 'created_desc' | 'due_asc' | 'priority' | 'title'>('created_asc')

  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const collisionMissLogged = useRef(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo')
  // Focus-return: remember what opened the drawer so focus lands there on close.
  const lastTriggerRef = useRef<HTMLElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const allTasks = rawTasks.data ?? []

  // Fetch linked calendar entries so the card can show platform badges.
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
    const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }
    const sorted = [...result]
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'due_asc': {
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return a.due_date.localeCompare(b.due_date)
        }
        case 'priority':
          return priorityRank[a.priority] - priorityRank[b.priority]
        case 'title':
          return a.title.localeCompare(b.title)
        case 'created_desc':
          return b.created_at.localeCompare(a.created_at)
        case 'created_asc':
        default:
          return a.created_at.localeCompare(b.created_at)
      }
    })
    return sorted
  }, [allTasks, filterAssignee, filterType, searchQuery, sortBy])

  function tasksForColumn(status: TaskStatus) {
    const cols = filteredTasks.filter((t) => t.status === status)
    // Done column: most-recently-moved first so a just-dragged card lands at top.
    if (status === 'done') {
      return [...cols].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    }
    return cols
  }

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

  const openCreate = useCallback((status: TaskStatus = 'todo') => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDrawerMode('create')
    setEditingTask(null)
    setDefaultStatus(status)
    setDrawerOpen(true)
  }, [])

  const openEdit = useCallback((task: Task) => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDrawerMode('edit')
    setEditingTask(task)
    setDefaultStatus(task.status)
    setDrawerOpen(true)
  }, [])

  const handleDrawerOpenChange = useCallback((open: boolean) => {
    setDrawerOpen(open)
    // Restore focus to the element that triggered the drawer, after close.
    if (!open) {
      const el = lastTriggerRef.current
      if (el && document.contains(el)) {
        requestAnimationFrame(() => el.focus())
      }
    }
  }, [])

  const handleQuickAdd = useCallback(async (status: TaskStatus, title: string) => {
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
  }, [activeBrand, createTask])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingTask(allTasks.find((t) => t.id === event.active.id) ?? null)
  }, [allTasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
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
  }, [allTasks, updateTask])

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

      {/* Stats ribbon */}
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

      {/* Filter bar */}
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
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[120px] max-w-[180px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_asc">Oldest first</SelectItem>
              <SelectItem value="created_desc">Newest first</SelectItem>
              <SelectItem value="due_asc">Due date (soonest)</SelectItem>
              <SelectItem value="priority">Priority (high first)</SelectItem>
              <SelectItem value="title">Title (A–Z)</SelectItem>
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
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 pt-4 flex flex-col">
        <DndContext
          sensors={sensors}
          // pointerWithin: drop target = whichever column the pointer is inside.
          // Fall back to rectIntersection so a card whose cursor sits in the
          // inter-column gap still resolves to the nearest overlapping column.
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
          <div className="flex-1 min-h-0 overflow-x-auto pb-1 relative">
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
            <div className="relative flex gap-4 h-full">
              {COLUMNS.map((col) => (
                <div key={col.id} className="w-[280px] shrink-0 h-full">
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

      <TaskDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        mode={drawerMode}
        task={editingTask}
        defaultStatus={defaultStatus}
        members={members.data ?? []}
        linkedEntry={editingTask?.calendar_entry_id ? entryById.get(editingTask.calendar_entry_id) : undefined}
        linkedEntryLoading={linkedEntries.isLoading}
        isSpecialist={isSpecialist}
        brandId={activeBrand.id}
        saving={createTask.isPending || updateTask.isPending}
        deleting={deleteTask.isPending}
        onCreate={(payload) => createTask.mutateAsync(payload)}
        onUpdate={(id, patch) => updateTask.mutateAsync({ id, patch })}
        onDelete={(id) => deleteTask.mutateAsync(id)}
      />
    </div>
  )
}
