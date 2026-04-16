import { useState, useMemo } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, useDroppable, useDraggable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO } from 'date-fns'
import { Plus, CalendarDays, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useActiveBrand } from '@/stores/activeBrand'
import { useTasks, useMyTasks } from '@/hooks/useTasks'
import { useTeam } from '@/hooks/useTeam'
import type { Task, TaskStatus, TaskType, TaskPriority, TaskInsert } from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done',        label: 'Done' },
]

const TYPE_COLORS: Record<TaskType, string> = {
  content:  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  shoot:    'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  approval: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  backup:   'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  other:    'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low:    'bg-zinc-400',
  medium: 'bg-amber-400',
  high:   'bg-rose-500',
}

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'content',  label: 'Content' },
  { value: 'shoot',    label: 'Photo/Video Shoot' },
  { value: 'approval', label: 'Approval' },
  { value: 'backup',   label: 'Backup Plan' },
  { value: 'other',    label: 'Other' },
]

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaskChip({ task }: { task: Task }) {
  return (
    <div className={`rounded border border-border bg-card px-2 py-1.5 space-y-1.5`}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs text-foreground leading-snug line-clamp-2 flex-1">
          {task.title}
        </span>
        <span className={`h-2 w-2 rounded-full mt-0.5 shrink-0 ${PRIORITY_COLORS[task.priority]}`} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[task.type]}`}>
          {task.type}
        </span>
        {task.assignee_email && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
            {task.assignee_email.split('@')[0]}
          </span>
        )}
        {task.due_date && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <CalendarDays className="h-2.5 w-2.5" />
            {format(parseISO(task.due_date), 'MMM d')}
          </span>
        )}
      </div>
    </div>
  )
}

function DraggableTask({ task, onClick }: { task: Task; onClick: () => void }) {
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
      <TaskChip task={task} />
    </div>
  )
}

function TaskColumn({
  column,
  tasks,
  onCardClick,
  onAddClick,
  isSpecialist,
}: {
  column: { id: TaskStatus; label: string }
  tasks: Task[]
  onCardClick: (t: Task) => void
  onAddClick: () => void
  isSpecialist: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id })
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 min-h-[200px] p-3 rounded-xl border border-border transition-colors ${
        isOver ? 'bg-primary/5 border-primary/30' : 'bg-muted/20'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-foreground">{column.label}</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
          {tasks.length}
        </span>
      </div>
      {tasks.map((task) => (
        <DraggableTask key={task.id} task={task} onClick={() => onCardClick(task)} />
      ))}
      {!isSpecialist && (
        <button
          type="button"
          onClick={onAddClick}
          className="mt-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 px-1 rounded hover:bg-accent transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add task
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

  // Owner uses useTasks, specialist uses useMyTasks
  const ownerHook = useTasks(isSpecialist ? null : (activeBrand?.id ?? null))
  const specialistHook = useMyTasks()
  const { tasks: rawTasks, updateTask } = isSpecialist ? specialistHook : ownerHook
  const { createTask, deleteTask } = ownerHook

  const { members } = useTeam(isSpecialist ? null : (activeBrand?.id ?? null))

  // Filters (owner only)
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  // Drag
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)

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

  const filteredTasks = useMemo(() => {
    let result = allTasks
    if (filterAssignee !== 'all') result = result.filter((t) => t.assignee_email === filterAssignee)
    if (filterType !== 'all') result = result.filter((t) => t.type === filterType)
    return result
  }, [allTasks, filterAssignee, filterType])

  function tasksForColumn(status: TaskStatus) {
    return filteredTasks.filter((t) => t.status === status)
  }

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
        await (ownerHook as ReturnType<typeof useTasks>).updateTask.mutateAsync({
          id: editingTask!.id,
          patch: {
            title: formTitle.trim(),
            description: formDesc.trim() || null,
            type: formType,
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
      toast.error('Failed to save task', { description: (err as Error).message })
    }
  }

  async function handleDelete() {
    try {
      await deleteTask.mutateAsync(editingTask!.id)
      toast.success('Task deleted')
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to delete', { description: (err as Error).message })
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingTask(allTasks.find((t) => t.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTask(null)
    const { active, over } = event
    if (!over) return
    const targetStatus = over.id as TaskStatus
    const task = allTasks.find((t) => t.id === active.id)
    if (!task || task.status === targetStatus) return
    updateTask.mutate({ id: task.id, patch: { status: targetStatus } })
  }

  // Specialist has no brand, guard differently
  if (!isSpecialist && !activeBrand) {
    return (
      <div className="p-6 text-muted-foreground">
        Select a brand to view the task board.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          {!isSpecialist && activeBrand && (
            <p className="text-sm text-muted-foreground mt-0.5">{activeBrand.name}</p>
          )}
          {isSpecialist && (
            <p className="text-sm text-muted-foreground mt-0.5">Your assigned tasks</p>
          )}
        </div>
        {!isSpecialist && (
          <Button size="sm" onClick={() => openCreate()}>
            New Task
          </Button>
        )}
      </div>

      {/* Filter bar — owner only */}
      {!isSpecialist && (
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap border-b border-border shrink-0">
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[130px]">
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
            <SelectTrigger className="h-7 text-xs w-auto min-w-[110px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TASK_TYPES.map((tt) => (
                <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-3 gap-4 min-w-[600px]">
            {COLUMNS.map((col) => (
              <TaskColumn
                key={col.id}
                column={col}
                tasks={tasksForColumn(col.id)}
                onCardClick={isSpecialist ? openEdit : openEdit}
                onAddClick={() => openCreate(col.id)}
                isSpecialist={isSpecialist}
              />
            ))}
          </div>
          <DragOverlay>
            {draggingTask && (
              <div className="shadow-lg rounded border border-border bg-card px-2 py-1.5">
                <TaskChip task={draggingTask} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {rawTasks.isLoading && (
          <p className="text-sm text-muted-foreground mt-4">Loading tasks...</p>
        )}
        {!rawTasks.isLoading && allTasks.length === 0 && (
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
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {TASK_TYPES.map((tt) => (
                  <button
                    key={tt.value}
                    type="button"
                    disabled={isSpecialist}
                    onClick={() => setFormType(tt.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      formType === tt.value
                        ? `${TYPE_COLORS[tt.value]} border-transparent`
                        : 'border-border text-muted-foreground'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {tt.label}
                  </button>
                ))}
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
                        ? 'bg-primary text-primary-foreground border-primary'
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
              <input
                type="date"
                value={formDue}
                onChange={(e) => setFormDue(e.target.value)}
                disabled={isSpecialist}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
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
            {/* Show status selector for specialist (they can change status) */}
            {isSpecialist && drawerMode === 'edit' && editingTask && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <div className="flex gap-1.5">
                  {COLUMNS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => updateTask.mutate({ id: editingTask.id, patch: { status: col.id } })}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        editingTask.status === col.id
                          ? 'bg-primary text-primary-foreground border-primary'
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
                disabled={createTask.isPending || (ownerHook as ReturnType<typeof useTasks>).updateTask.isPending}
              >
                {createTask.isPending || (ownerHook as ReturnType<typeof useTasks>).updateTask.isPending ? 'Saving…' : 'Save'}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
