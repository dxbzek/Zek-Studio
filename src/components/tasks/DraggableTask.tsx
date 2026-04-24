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
  // - transition: null disables the 250ms CSS slide that neighbors play when
  //   they shift out of the way — the slide was where the visible stutter
  //   came from because it compounds with dnd-kit's own transform updates.
  //   With it off, slots snap instantly and the DragOverlay is the only
  //   thing animating (which it does smoothly via transform).
  // - animateLayoutChanges:false prevents the same 250ms sliding on
  //   add/remove events too.
  // - The dragged card's original slot is hidden entirely (opacity:0) so
  //   only the DragOverlay follows the cursor — no double image.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', status: task.status },
    animateLayoutChanges: () => false,
    transition: null,
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
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
