import { memo } from 'react'
import { Link2 } from 'lucide-react'
import type { CalendarEntry, Task } from '@/types'
import { PlatformBadge } from '@/lib/platformBrand'
import {
  TASK_STATUS_BORDER, TASK_TYPE_CHIP, TASK_PRIORITY_DOT, TASK_PRIORITY_LABEL,
} from '@/lib/statusTokens'
import { assigneeInitial, dueMeta } from './taskConstants'

interface TaskChipProps {
  task: Task
  linkedEntry?: CalendarEntry
  isDragging?: boolean
}

function TaskChipImpl({ task, linkedEntry, isDragging }: TaskChipProps) {
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

  // Hover lift + transition-all was compounding with dnd-kit's transform while
  // the cursor passed over other cards mid-drag, producing visible stutter.
  // Suppress both while this card is being dragged, and drop -translate-y
  // everywhere else — keep the border/shadow hover feedback only.
  return (
    <div
      className={`rounded-md border border-border border-l-[3px] ${TASK_STATUS_BORDER[task.status]} ${urgencyTint} px-2 py-1.5 space-y-1.5 shadow-[0_1px_0_0_color-mix(in_oklch,white_50%,transparent)_inset] dark:shadow-none ${
        isDragging
          ? ''
          : 'transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-[1px] hover:border-foreground/15 hover:shadow-[0_4px_10px_-4px_color-mix(in_oklch,black_12%,transparent),0_1px_0_0_color-mix(in_oklch,white_60%,transparent)_inset] active:translate-y-0 active:shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-300'
      } ${
        isDone ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-xs text-foreground leading-snug line-clamp-2 flex-1 flex items-center gap-1">
          {linkedEntry && (
            <Link2
              className="h-3 w-3 shrink-0 text-muted-foreground"
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

export const TaskChip = memo(TaskChipImpl)
