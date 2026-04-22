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
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="cursor-pointer animate-in fade-in-0 slide-in-from-top-1 duration-200"
    >
      <TaskChip task={task} linkedEntry={linkedEntry} />
    </div>
  )
}

export const DraggableTask = memo(DraggableTaskImpl)
