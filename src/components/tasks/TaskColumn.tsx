import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import type { CalendarEntry, Task } from '@/types'
import {
  TASK_STATUS_ACCENT, TASK_STATUS_CHIP, TASK_STATUS_COLUMN_TINT, TASK_STATUS_ICON_COLOR,
} from '@/lib/statusTokens'
import { DraggableTask } from './DraggableTask'
import { QuickAddTask } from './QuickAddTask'
import type { COLUMNS } from './taskConstants'

interface TaskColumnProps {
  column: (typeof COLUMNS)[number]
  tasks: Task[]
  entryById: Map<string, CalendarEntry>
  onCardClick: (t: Task) => void
  onAddClick: () => void
  onQuickAdd: (title: string) => void
  isSpecialist: boolean
}

// Not memoized on purpose: parent passes fresh inline closures for
// onAddClick/onQuickAdd (they capture column.id), so memo would never hit. The
// real win is memoizing the *cards* (DraggableTask/TaskChip), which get stable
// identity via keyed children.
export function TaskColumn({
  column, tasks, entryById, onCardClick, onAddClick, onQuickAdd, isSpecialist,
}: TaskColumnProps) {
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

