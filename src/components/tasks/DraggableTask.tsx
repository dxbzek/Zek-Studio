import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CalendarEntry, Task } from '@/types'
import { TaskChip } from './TaskChip'

interface DraggableTaskProps {
  task: Task
  linkedEntry?: CalendarEntry
  onClick: () => void
}

function DraggableTaskImpl({ task, linkedEntry, onClick }: DraggableTaskProps) {
  // useSortable handles both same-column reordering and cross-column drops.
  // - animateLayoutChanges: false stops sibling cards from CSS-animating to
  //   their new slots; without it the moving neighbor ghosts into the
  //   dragged card's old position (what produced the blurry overlap).
  // - The dragged card itself is hidden entirely (opacity 0 + pointer-events
  //   none) so only the DragOverlay follows the cursor — no double image.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', status: task.status },
    animateLayoutChanges: () => false,
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        pointerEvents: isDragging ? 'none' : undefined,
        willChange: isDragging ? 'transform' : undefined,
      }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="cursor-pointer touch-none"
    >
      <TaskChip task={task} linkedEntry={linkedEntry} isDragging={isDragging} />
    </div>
  )
}

export const DraggableTask = memo(DraggableTaskImpl)
