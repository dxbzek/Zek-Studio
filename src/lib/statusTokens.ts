import type { CalendarStatus, TaskStatus } from '@/types'

// Unified status palette. "Scheduled" uses the same amber across Calendar and
// Tasks so the concept reads the same on either surface. Todo maps to the
// draft-zinc; in_progress uses indigo to distinguish it from amber "scheduled"
// without colliding with the approval palette. Done = emerald = published.

export const CALENDAR_STATUS_CHIP: Record<CalendarStatus, string> = {
  draft:     'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  scheduled: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export const CALENDAR_STATUS_BORDER: Record<CalendarStatus, string> = {
  draft:     'border-l-zinc-400',
  scheduled: 'border-l-amber-400',
  published: 'border-l-emerald-500',
}

export const CALENDAR_STATUS_DOT: Record<CalendarStatus, string> = {
  draft:     'bg-zinc-400',
  scheduled: 'bg-amber-400',
  published: 'bg-emerald-500',
}

export const TASK_STATUS_CHIP: Record<TaskStatus, string> = {
  todo:        'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  in_progress: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  scheduled:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  done:        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export const TASK_STATUS_BORDER: Record<TaskStatus, string> = {
  todo:        'border-l-zinc-400',
  in_progress: 'border-l-indigo-400',
  scheduled:   'border-l-amber-400',
  done:        'border-l-emerald-500',
}

export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  todo:        'bg-zinc-400',
  in_progress: 'bg-indigo-400',
  scheduled:   'bg-amber-400',
  done:        'bg-emerald-500',
}

// Column-level tokens for the Task Board (faint column fill + top accent +
// icon color). Kept separate from the chip/dot palette so we can tune
// column density independently of the card.
export const TASK_STATUS_COLUMN_TINT: Record<TaskStatus, string> = {
  todo:        'bg-zinc-500/[0.04]',
  in_progress: 'bg-indigo-500/[0.05]',
  scheduled:   'bg-amber-500/[0.05]',
  done:        'bg-emerald-500/[0.05]',
}

export const TASK_STATUS_ACCENT: Record<TaskStatus, string> = {
  todo:        'border-t-zinc-400/60',
  in_progress: 'border-t-indigo-400/70',
  scheduled:   'border-t-amber-400/80',
  done:        'border-t-emerald-500/80',
}

export const TASK_STATUS_ICON_COLOR: Record<TaskStatus, string> = {
  todo:        'text-zinc-500 dark:text-zinc-400',
  in_progress: 'text-indigo-500 dark:text-indigo-400',
  scheduled:   'text-amber-500 dark:text-amber-400',
  done:        'text-emerald-600 dark:text-emerald-400',
}
