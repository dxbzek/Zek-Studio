import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
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
  isLoading?: boolean
}

// 3 gray placeholders sized like TaskChip. Shown only during the first fetch
// so columns don't flash "Nothing waiting here" before the data arrives.
function TaskChipSkeleton() {
  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-2.5 motion-safe:animate-pulse">
      <div className="h-3 w-2/3 rounded bg-muted-foreground/15 mb-2" />
      <div className="h-2.5 w-1/2 rounded bg-muted-foreground/10" />
    </div>
  )
}

// Not memoized on purpose: parent passes fresh inline closures for
// onAddClick/onQuickAdd (they capture column.id), so memo would never hit. The
// real win is memoizing the *cards* (DraggableTask/TaskChip), which get stable
// identity via keyed children.
export function TaskColumn({
  column, tasks, entryById, onCardClick, onAddClick, onQuickAdd, isSpecialist, isLoading,
}: TaskColumnProps) {
  // useDroppable registers the column itself as a drop target (for empty
  // columns or drops below the last card). SortableContext lets cards
  // reorder among themselves inside this column.
  const { isOver, setNodeRef } = useDroppable({ id: column.id, data: { type: 'column', status: column.id } })
  const Icon = column.icon
  const isEmpty = tasks.length === 0
  const taskIds = tasks.map((t) => t.id)
  return (
    <div
      ref={setNodeRef}
      className={`group/column relative h-full flex flex-col gap-2 p-3 rounded-xl border border-border/80 border-t-2 ${TASK_STATUS_ACCENT[column.id]} transition-all duration-200 ease-out shadow-[0_1px_2px_-1px_color-mix(in_oklch,black_6%,transparent),0_1px_0_0_color-mix(in_oklch,white_50%,transparent)_inset] dark:shadow-none ${
        isOver
          ? 'bg-primary/[0.06] border-primary/40 ring-2 ring-primary/30 ring-inset'
          : `${TASK_STATUS_COLUMN_TINT[column.id]} hover:border-border`
      }`}
    >
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="flex items-center gap-1.5">
          <Icon
            className={`h-3.5 w-3.5 ${TASK_STATUS_ICON_COLOR[column.id]} ${
              column.id === 'in_progress' ? 'animate-spin [animation-duration:4s]' : ''
            }`}
          />
          <span className="text-sm font-semibold text-foreground tracking-tight">{column.label}</span>
        </span>
        <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-semibold tabular-nums shadow-[0_1px_0_0_color-mix(in_oklch,white_30%,transparent)_inset] ${TASK_STATUS_CHIP[column.id]}`}>
          {tasks.length}
        </span>
      </div>
      {!isSpecialist && (
        <div className="shrink-0">
          <QuickAddTask onAdd={onQuickAdd} />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 -mx-1 px-1">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <DraggableTask
              key={task.id}
              task={task}
              linkedEntry={task.calendar_entry_id ? entryById.get(task.calendar_entry_id) : undefined}
              onClick={() => onCardClick(task)}
            />
          ))}
        </SortableContext>
        {isEmpty && isLoading && (
          <>
            <TaskChipSkeleton />
            <TaskChipSkeleton />
            <TaskChipSkeleton />
          </>
        )}
        {isEmpty && !isLoading && (
          <div className="rounded-md border border-dashed border-border/60 px-2 py-4 text-[11px] text-muted-foreground/70 text-center leading-snug">
            {column.empty}
          </div>
        )}
      </div>
      {!isSpecialist && (
        <button
          type="button"
          onClick={onAddClick}
          className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground py-1 px-1 rounded hover:bg-accent/60 transition-all duration-150 hover:translate-x-px"
        >
          <Plus className="h-3 w-3" />
          With details…
        </button>
      )}
    </div>
  )
}
