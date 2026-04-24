import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { CalendarEntry, Task } from '@/types'
import { TaskChip } from './TaskChip'

interface DraggableTaskProps {
  task: Task
  linkedEntry?: CalendarEntry
  onClick: () => void
}

function DraggableTaskImpl({ task, linkedEntry, onClick }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  // willChange: transform hints the compositor so CSS.Translate updates don't
  // repaint. Without it, dragging a card while other chips are mid-hover
  // (transition-all) produces visible stutter.
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
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
